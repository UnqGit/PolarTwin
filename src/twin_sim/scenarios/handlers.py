"""Generic scenario handlers operating on runtime context, not topology names."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from twin_sim.behaviors import BehaviorContext
from twin_sim.model import ComponentGraph
from twin_sim.simulation.environment import EnvironmentState

from .event import ScenarioEvent


@dataclass
class EventContext:
    graph: ComponentGraph
    environment: EnvironmentState
    behavior_context: BehaviorContext
    schedule: Callable[[float, Callable[[float, Any], None], Any], None]


EventHandler = Callable[[ScenarioEvent, EventContext], None]


class EventHandlerRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, EventHandler] = {}

    def register(self, name: str, handler: EventHandler) -> None:
        if not name:
            raise ValueError("event name must not be empty")
        if name in self._handlers:
            raise ValueError(f"event handler '{name}' is already registered")
        self._handlers[name] = handler

    def dispatch(self, event: ScenarioEvent, context: EventContext) -> None:
        handler = self._handlers.get(event.event)
        if handler is None:
            raise ValueError(f"unknown scenario event '{event.event}'")
        handler(event, context)


def _environment_update(event: ScenarioEvent, context: EventContext) -> None:
    context.environment.update(event.parameters)


def _temporary_environment_update(event: ScenarioEvent, context: EventContext, values: dict[str, Any]) -> None:
    previous = {key: context.environment.get(key) for key in values}
    context.environment.update(values)
    if event.duration is not None:
        def restore(timestamp: float, payload: Any) -> None:
            context.environment.update(payload)
        context.schedule(event.timestamp + event.duration, restore, previous)


def _blizzard(event: ScenarioEvent, context: EventContext) -> None:
    parameters = event.parameters
    updates = {
        key: parameters[key]
        for key in ("temperature", "wind_speed", "connectivity", "humidity")
        if key in parameters
    }
    if "temperature_delta" in parameters:
        updates["temperature"] = context.environment.get("temperature", 0) + parameters["temperature_delta"]
    if "connectivity_loss_probability" in parameters:
        updates["connectivity"] = 1.0 - float(parameters["connectivity_loss_probability"])
    if "heating_demand_multiplier" in parameters:
        updates["heating_demand_multiplier"] = float(parameters["heating_demand_multiplier"])
    if "heating_demand" in parameters:
        updates["heating_demand"] = float(parameters["heating_demand"])
    _temporary_environment_update(event, context, updates)


def _component_state(event: ScenarioEvent, context: EventContext, available: bool, health: float) -> None:
    if not event.target or event.target not in context.graph.components:
        raise ValueError(f"event '{event.id}' references unknown component '{event.target}'")
    component = context.graph.get(event.target)
    component.runtime_state.available = available
    component.runtime_state.health = health
    if not available:
        component.runtime_state.values["running"] = False


def _failure(event: ScenarioEvent, context: EventContext) -> None:
    _component_state(event, context, False, 0.0)


def _repair(event: ScenarioEvent, context: EventContext) -> None:
    _component_state(event, context, True, 1.0)


def _network_outage(event: ScenarioEvent, context: EventContext) -> None:
    loss = float(event.parameters.get("packet_loss", 1.0))
    _temporary_environment_update(event, context, {"connectivity": max(0.0, min(1.0, 1.0 - loss))})


def _fuel_shortage(event: ScenarioEvent, context: EventContext) -> None:
    if not event.target or event.target not in context.graph.components:
        raise ValueError(f"event '{event.id}' references unknown component '{event.target}'")
    level = max(0.0, float(event.parameters.get("fuel_level", 0.0)))
    context.graph.get(event.target).runtime_state.values["fuel_level"] = level


def _manual_command(event: ScenarioEvent, context: EventContext) -> None:
    if not event.target or event.target not in context.graph.components:
        raise ValueError(f"event '{event.id}' references unknown component '{event.target}'")
    context.graph.get(event.target).runtime_state.values.update(event.parameters)


def default_event_registry() -> EventHandlerRegistry:
    registry = EventHandlerRegistry()
    registry.register("environment_change", _environment_update)
    registry.register("temperature_change", lambda event, context: _temporary_environment_update(event, context, {"temperature": event.parameters["temperature"]}))
    registry.register("blizzard", _blizzard)
    registry.register("component_failure", _failure)
    registry.register("component_repair", _repair)
    registry.register("sensor_failure", _failure)
    registry.register("network_outage", _network_outage)
    registry.register("fuel_shortage", _fuel_shortage)
    registry.register("manual_command", _manual_command)
    return registry