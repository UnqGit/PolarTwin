"""Containment and dependency indexes for a compiled twin model."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .component import Component
from .connection import Connection


@dataclass
class ComponentGraph:
    root: Component
    components: dict[str, Component]
    connections: list[Connection]
    diagnostics: list[str] = field(default_factory=list)
    external_data_reference: str | None = None
    external_data_config: dict[str, Any] = field(default_factory=dict)
    _incoming: dict[str, list[Connection]] = field(default_factory=dict, repr=False)
    _outgoing: dict[str, list[Connection]] = field(default_factory=dict, repr=False)

    def get(self, name: str) -> Component:
        return self.components[name]

    def children_of(self, name: str) -> tuple[Component, ...]:
        return tuple(self.get(name).children)

    def parent_of(self, name: str) -> Component | None:
        return self.get(name).parent

    def descendants_of(self, name: str) -> tuple[Component, ...]:
        result: list[Component] = []

        def visit(component: Component) -> None:
            for child in component.children:
                result.append(child)
                visit(child)

        visit(self.get(name))
        return tuple(result)

    def ancestors_of(self, name: str) -> tuple[Component, ...]:
        result: list[Component] = []
        parent = self.get(name).parent
        while parent is not None:
            result.append(parent)
            parent = parent.parent
        return tuple(result)

    def incoming(self, name: str) -> tuple[Connection, ...]:
        return tuple(self._incoming.get(name, ()))

    def outgoing(self, name: str) -> tuple[Connection, ...]:
        return tuple(self._outgoing.get(name, ()))

    def rebuild_indexes(self) -> None:
        self._incoming = {name: [] for name in self.components}
        self._outgoing = {name: [] for name in self.components}
        for connection in self.connections:
            self._outgoing[connection.source].append(connection)
            self._incoming[connection.target].append(connection)
            if connection.direction == "<-->" and connection.source != connection.target:
                reverse = Connection(
                    source=connection.target,
                    target=connection.source,
                    type=connection.type,
                    direction=connection.direction,
                )
                self._outgoing[reverse.source].append(reverse)
                self._incoming[reverse.target].append(reverse)