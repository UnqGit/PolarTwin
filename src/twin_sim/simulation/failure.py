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
    timestamp: float = 0.0,
    tracer: Any = None,
) -> None:
    """Replace unavailable generator capacity with backups, then battery power."""
    failed_generators = [
        component
        for component in graph.components.values()
        if component.type == "generator" and not component.runtime_state.available
    ]
    if not failed_generators:
        return

    failed = failed_generators[0]
    lost_capacity = sum(_numeric_value(component.specification, "rating") for component in failed_generators)
    
    controllers = [
        conn.target for conn in graph.connections
        if conn.source == failed.name and graph.get(conn.target).type in ("controller", "system")
    ]
    controller_name = controllers[0] if controllers else None

    backups = [
        component
        for component in graph.components.values()
        if component.type == "generator"
        and component.runtime_state.available
        and component.specification.get("role") == "backup"
    ]
    remaining = lost_capacity
    
    effects = []
    chain = []
    
    chain.append(f"{failed.name} failed")
    if controller_name:
        chain.append(f"{controller_name} received {failed.name} status = FAILED")
        effects.append((controller_name, "generator_available=false"))
    chain.append("Available generation decreased")

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
            "timestamp": timestamp,
        })
        effects.append((backup.name, f"power_output={output}"))
        if controller_name:
            command_val = round(output / rating, 2) if rating > 0 else 1.0
            chain.append(f"{controller_name} issued {backup.name} command = {command_val}")
        chain.append(f"{backup.name} output increased to {output} kW")

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
            "timestamp": timestamp,
        })
        effects.append((battery.name, f"discharge_power={discharge}"))
        if controller_name:
            chain.append(f"{controller_name} requested battery discharge")
        chain.append(f"{battery.name} discharge increased to {discharge} kW")

    if remaining > 0:
        causal_trace.append({
            "cause": "generator_failure",
            "effect": "unserved_generation",
            "value": remaining,
            "timestamp": timestamp,
        })
        
    if tracer and effects:
        tracer.record_cause_and_effects(
            timestamp=timestamp,
            cause_component=failed.name,
            cause_event="failure",
            effects=effects,
            chain=chain,
        )