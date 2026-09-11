"""Read-only quality metrics for a compiled generic model."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from twin_sim.model import ComponentGraph


@dataclass(frozen=True)
class ModelQualityReport:
    components: int
    connections: int
    types: dict[str, int]
    specialized_behaviors: int
    generic_behaviors: int
    behavior_counts: dict[str, int]
    unresolved_references: int
    potential_cycles: list[list[str]] = field(default_factory=list)
    unconnected_components: list[str] = field(default_factory=list)
    missing_specifications: list[str] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "components": self.components,
            "connections": self.connections,
            "types": dict(self.types),
            "specialized_behaviors": self.specialized_behaviors,
            "generic_behaviors": self.generic_behaviors,
            "behavior_counts": dict(self.behavior_counts),
            "unresolved_references": self.unresolved_references,
            "potential_cycles": [list(cycle) for cycle in self.potential_cycles],
            "unconnected_components": list(self.unconnected_components),
            "missing_specifications": list(self.missing_specifications),
            "diagnostics": list(self.diagnostics),
        }


def _cycles(graph: ComponentGraph) -> list[list[str]]:
    adjacency = {name: [] for name in graph.components}
    for connection in graph.connections:
        adjacency[connection.source].append(connection.target)
        if connection.direction == "<-->" and connection.source != connection.target:
            adjacency[connection.target].append(connection.source)

    index = 0
    indexes: dict[str, int] = {}
    lowlinks: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    result: list[list[str]] = []

    def visit(node: str) -> None:
        nonlocal index
        indexes[node] = index
        lowlinks[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)
        for target in adjacency[node]:
            if target not in indexes:
                visit(target)
                lowlinks[node] = min(lowlinks[node], lowlinks[target])
            elif target in on_stack:
                lowlinks[node] = min(lowlinks[node], indexes[target])
        if lowlinks[node] == indexes[node]:
            component: list[str] = []
            while True:
                member = stack.pop()
                on_stack.remove(member)
                component.append(member)
                if member == node:
                    break
            if len(component) > 1 or node in adjacency[node]:
                result.append(sorted(component))

    for name in graph.components:
        if name not in indexes:
            visit(name)
    return sorted(result, key=lambda cycle: cycle[0])


def build_quality_report(graph: ComponentGraph) -> ModelQualityReport:
    types = Counter(component.type for component in graph.components.values())
    behavior_counts = Counter(
        component.behavior.name if component.behavior is not None else "none"
        for component in graph.components.values()
    )
    specialized = sum(
        1 for component in graph.components.values()
        if component.behavior is not None and component.behavior.level == "specialized"
    )
    unconnected = sorted(
        name for name in graph.components
        if not graph.incoming(name) and not graph.outgoing(name)
    )
    missing = sorted(
        name for name, component in graph.components.items()
        if not isinstance(component.specification, dict)
    )
    unresolved = sum(
        1 for connection in graph.connections
        if connection.source not in graph.components or connection.target not in graph.components
    )
    return ModelQualityReport(
        components=len(graph.components),
        connections=len(graph.connections),
        types=dict(sorted(types.items())),
        specialized_behaviors=specialized,
        generic_behaviors=len(graph.components) - specialized,
        behavior_counts=dict(sorted(behavior_counts.items())),
        unresolved_references=unresolved,
        potential_cycles=_cycles(graph),
        unconnected_components=unconnected,
        missing_specifications=missing,
        diagnostics=list(graph.diagnostics),
    )