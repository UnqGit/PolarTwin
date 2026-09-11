"""Attach scenario events to the simulation scheduler."""

from __future__ import annotations

from collections.abc import Iterable

from twin_sim.simulation.engine import SimulationEngine

from .event import ScenarioEvent
from .handlers import EventContext, EventHandlerRegistry, default_event_registry


class ScenarioScheduler:
    def __init__(self, registry: EventHandlerRegistry | None = None) -> None:
        self.registry = registry or default_event_registry()

    def schedule(self, engine: SimulationEngine, events: Iterable[ScenarioEvent]) -> None:
        for event in sorted(events, key=lambda item: (item.timestamp, item.id)):
            engine.schedule(event.timestamp, self._dispatch, (engine, event))

    def _dispatch(self, timestamp: float, payload) -> None:
        engine, event = payload
        context = EventContext(
            graph=engine.graph,
            environment=engine.environment,
            behavior_context=engine.context,
            schedule=engine.schedule,
            causal_trace=engine.causal_trace,
            timestamp=timestamp,
            tracer=getattr(engine, "tracer", None),
        )
        self.registry.dispatch(event, context)