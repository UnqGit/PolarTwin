"""Small deterministic engine that owns lifecycle, not domain behavior."""

from __future__ import annotations

import time
from enum import Enum
from typing import Any, Callable
from collections.abc import Mapping

from twin_sim.behaviors import BehaviorContext
from twin_sim.model import ComponentGraph
from twin_sim.observability import CausalTracer
from twin_sim.telemetry import TelemetryGenerator, TelemetryMessage

from .clock import ClockMode, SimulationClock
from .environment import EnvironmentState
from .failure import apply_failure_recovery
from .randomness import RandomSource
from .propagation import propagate
from .scheduler import Callback, SimulationScheduler


class SimulationStatus(str, Enum):
    READY = "ready"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    COMPLETED = "completed"


class SimulationEngine:
    def __init__(
        self,
        graph: ComponentGraph,
        tick_interval: float = 1.0,
        time_scale: float = 1.0,
        mode: ClockMode | str = ClockMode.FAST,
        seed: int | None = None,
        sleeper: Callable[[float], None] = time.sleep,
        environment: EnvironmentState | Mapping[str, Any] | None = None,
        run_id: str = "run-default",
        debug: bool = False,
        tracer: CausalTracer | None = None,
    ) -> None:
        self.graph = graph
        self.clock = SimulationClock(tick_interval, time_scale, mode)
        self.scheduler = SimulationScheduler()
        self.random = RandomSource(seed)
        self._sleeper = sleeper
        self.environment = environment if isinstance(environment, EnvironmentState) else EnvironmentState(environment)
        self.status = SimulationStatus.READY
        self.tick_count = 0
        self.context = BehaviorContext({
            "clock": self.clock,
            "random": self.random,
            "environment": self.environment.snapshot(),
        })
        self.last_phase_order: list[str] = []
        self.causal_trace: list[dict[str, Any]] = []
        self.debug = debug
        self.tracer = tracer or CausalTracer(enabled=debug)
        self.telemetry_generator = TelemetryGenerator(run_id)
        self.telemetry: list[TelemetryMessage] = []
        for component in self.graph.components.values():
            if component.behavior is not None:
                component.behavior.initialize(component, self.context)

    @property
    def simulation_time(self) -> float:
        return self.clock.timestamp

    def schedule(self, timestamp: float, callback: Callback, payload: Any = None) -> None:
        self.scheduler.schedule(timestamp, callback, payload)

    def step(self) -> float:
        if self.status in {SimulationStatus.STOPPED, SimulationStatus.COMPLETED}:
            raise RuntimeError(f"cannot step while simulation is {self.status.value}")
        self.status = SimulationStatus.RUNNING
        timestamp = self.clock.advance()
        self.last_phase_order = []
        self.last_phase_order.append("events")
        for event in self.scheduler.pop_due(timestamp):
            event.callback(timestamp, event.payload)
        self.last_phase_order.append("environment")
        self.context.values["timestamp"] = timestamp
        self.context.values["environment"] = self.environment.snapshot()
        self.last_phase_order.append("evaluation")
        proposals: dict[str, dict[str, Any]] = {}
        for component in self.graph.components.values():
            if component.behavior is not None:
                inputs = component.runtime_state.values.get("inputs", {})
                context = BehaviorContext({**self.context.values, "inputs": inputs})
                proposals[component.name] = component.behavior.evaluate(
                    component, context, self.clock.tick_interval
                )
            else:
                proposals[component.name] = {}
        self.last_phase_order.append("propagation")
        apply_failure_recovery(self.graph, proposals, self.causal_trace, timestamp=timestamp, tracer=self.tracer)
        input_updates = propagate(self.graph, proposals)
        self.last_phase_order.append("commit")
        for name, component in self.graph.components.items():
            component.runtime_state.values.update(proposals[name])
            if input_updates[name].get("inputs"):
                component.runtime_state.values["inputs"] = input_updates[name]["inputs"]
        self.telemetry.extend(self.telemetry_generator.generate(
            self.graph,
            timestamp,
            self.environment.snapshot(),
            self.causal_trace[-5:],
        ))
        self.tick_count += 1
        self.status = SimulationStatus.PAUSED if self.status == SimulationStatus.PAUSED else SimulationStatus.RUNNING
        return timestamp

    def run(self, duration: float | None = None) -> list[float]:
        if duration is not None and duration < 0:
            raise ValueError("duration must be non-negative")
        if self.status == SimulationStatus.STOPPED:
            raise RuntimeError("cannot run a stopped simulation")
        self.status = SimulationStatus.RUNNING
        end = self.simulation_time + duration if duration is not None else None
        timestamps: list[float] = []
        while self.status == SimulationStatus.RUNNING and (end is None or self.simulation_time < end):
            if self.clock.wall_delay:
                self._sleeper(self.clock.wall_delay)
            timestamps.append(self.step())
        if end is not None and self.status == SimulationStatus.RUNNING:
            self.status = SimulationStatus.COMPLETED
        return timestamps

    def pause(self) -> None:
        if self.status == SimulationStatus.RUNNING:
            self.status = SimulationStatus.PAUSED

    def resume(self) -> None:
        if self.status in {SimulationStatus.PAUSED, SimulationStatus.READY}:
            self.status = SimulationStatus.RUNNING

    def stop(self) -> None:
        self.status = SimulationStatus.STOPPED
