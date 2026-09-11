"""Generic failure effects and backup recovery policies."""

from __future__ import annotations

from typing import Any

from twin_sim.model import ComponentGraph


def _numeric_value(spec: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = spec.get(key, default)
    if isinstance(value, dict):
        value = value.get("value", value.get("max", default))
    return float(value) if isinstance(value, (int, float)) else default


def apply_failure_recovery(
    graph: ComponentGraph,
    proposals: dict[str, dict[str, Any]],
    causal_trace: list[dict[str, Any]],
) -> None:
    """Replace unavailable generator capacity with backups, then battery power."""
    failed_generators = [
        component
        for component in graph.components.values()
        if component.type == "generator" and not component.runtime_state.available
    ]
    if not failed_generators:
        return

    lost_capacity = sum(_numeric_value(component.specification, "rating") for component in failed_generators)
    backups = [
        component
        for component in graph.components.values()
        if component.type == "generator"
        and component.runtime_state.available
        and component.specification.get("role") == "backup"
    ]
    remaining = lost_capacity
    for backup in backups:
        rating = _numeric_value(backup.specification, "rating")
        output = min(rating, remaining)
        if output <= 0:
            continue
        proposals.setdefault(backup.name, {}).update({
            "power_output": output,
            "fuel_consumption": output * _numeric_value(backup.specification, "fuel_rate", 0.25),
            "running": True,
        })
        remaining -= output
        causal_trace.append({
            "cause": "generator_failure",
            "component": backup.name,
            "effect": "backup_generation_increased",
            "value": output,
        })

    batteries = [
        component for component in graph.components.values()
        if component.type == "battery" and component.runtime_state.available
    ]
    for battery in batteries:
        if remaining <= 0:
            break
        maximum = _numeric_value(battery.specification, "maximum_power", remaining)
        discharge = min(maximum, remaining)
        proposals.setdefault(battery.name, {}).update({"discharge_power": discharge})
        remaining -= discharge
        causal_trace.append({
            "cause": "generator_failure",
            "component": battery.name,
            "effect": "battery_discharge_requested",
            "value": discharge,
        })

    if remaining > 0:
        causal_trace.append({
            "cause": "generator_failure",
            "effect": "unserved_generation",
            "value": remaining,
        })