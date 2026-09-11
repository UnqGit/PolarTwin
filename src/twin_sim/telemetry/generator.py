"""Generate observations from runtime state without changing that state."""

from __future__ import annotations

from typing import Any

from twin_sim.model import ComponentGraph

from .model import TelemetryMessage


def _unit(specification: dict[str, Any], quantity: str) -> str | None:
    value = specification.get("rating")
    if isinstance(value, dict) and isinstance(value.get("unit"), str):
        return value["unit"]
    value = specification.get(quantity)
    if isinstance(value, dict) and isinstance(value.get("unit"), str):
        return value["unit"]
    return None


class TelemetryGenerator:
    schema_version = "1.0"

    def __init__(self, run_id: str = "run-default") -> None:
        if not run_id:
            raise ValueError("run_id must not be empty")
        self.run_id = run_id

    def generate(
        self,
        graph: ComponentGraph,
        timestamp: float,
        environment: dict[str, Any],
        active_events: list[Any] | None = None,
    ) -> list[TelemetryMessage]:
        messages: list[TelemetryMessage] = []
        for component in graph.components.values():
            state = dict(component.runtime_state.values)
            component_info = {"name": component.name, "type": component.type, "tags": list(component.tags)}
            quality = {
                "status": "good" if component.runtime_state.available else "bad",
                "simulated": True,
                "estimated": False,
            }
            context = {"environment": dict(environment)}
            if "measurement" in state:
                quantity = str(state.get("quantity", "value"))
                measurement = {"quantity": quantity, "value": state["measurement"]}
                unit = _unit(component.specification, quantity)
                if unit is not None:
                    measurement["unit"] = unit
                messages.append(TelemetryMessage(
                    self.schema_version,
                    self.run_id,
                    timestamp,
                    component=component_info,
                    measurement=measurement,
                    quality=quality,
                    source={"component": component.name, "measures": quantity},
                    context=context,
                    active_events=active_events or [],
                ))
            else:
                state.pop("inputs", None)
                messages.append(TelemetryMessage(
                    self.schema_version,
                    self.run_id,
                    timestamp,
                    component=component_info,
                    state={**state, "health": component.runtime_state.health, "available": component.runtime_state.available},
                    quality=quality,
                    source={"component": component.name},
                    context=context,
                    active_events=active_events or [],
                ))
        return messages

    def event_message(self, timestamp: float, event: dict[str, Any], environment: dict[str, Any]) -> TelemetryMessage:
        return TelemetryMessage(
            self.schema_version,
            self.run_id,
            timestamp,
            event=dict(event),
            quality={"status": "good", "simulated": True, "estimated": False},
            context={"environment": dict(environment)},
        )