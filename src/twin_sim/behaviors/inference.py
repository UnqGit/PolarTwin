"""Layered behavior selection for compiled components."""

from __future__ import annotations

from dataclasses import dataclass

from twin_sim.model import ComponentGraph

from .base import Behavior
from .registry import BehaviorRegistry, default_registry


@dataclass(frozen=True)
class BehaviorResolution:
    behavior: Behavior
    source: str


def _explicit_name(component) -> str | None:
    value = component.specification.get("behavior")
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        name = value.get("name", value.get("type"))
        return name if isinstance(name, str) else None
    return None


def resolve_behavior(component, registry: BehaviorRegistry) -> BehaviorResolution:
    explicit = _explicit_name(component)
    if explicit is not None:
        if registry.contains(explicit):
            return BehaviorResolution(registry.create(explicit), "explicit")
        return BehaviorResolution(registry.create("generic"), "generic")
    if registry.contains(component.type):
        return BehaviorResolution(registry.create(component.type), "type")
    hinted = component.specification.get("behavior_type")
    if isinstance(hinted, str) and registry.contains(hinted):
        return BehaviorResolution(registry.create(hinted), "specification")
    return BehaviorResolution(registry.create("generic"), "generic")


def infer_behaviors(graph: ComponentGraph, registry: BehaviorRegistry | None = None) -> dict[str, BehaviorResolution]:
    active_registry = registry or default_registry()
    resolutions: dict[str, BehaviorResolution] = {}
    for name, component in graph.components.items():
        explicit = _explicit_name(component)
        resolution = resolve_behavior(component, active_registry)
        component.behavior = resolution.behavior
        resolutions[name] = resolution
        if explicit is not None and not active_registry.contains(explicit):
            graph.diagnostics.append(
                f"component '{name}' requested unknown behavior '{explicit}'; using generic fallback"
            )
        elif resolution.source == "generic":
            graph.diagnostics.append(
                f"component '{name}' has no specialized behavior; using generic fallback"
            )
    return resolutions