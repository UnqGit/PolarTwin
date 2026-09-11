"""Order-independent signal propagation for one simulation tick."""

from __future__ import annotations

from typing import Any

from twin_sim.model import ComponentGraph


def propagate(
    graph: ComponentGraph,
    proposals: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Create target input updates from source proposals.

    A connection type names the target input channel. The source snapshot is
    copied into that channel, so propagation never exposes mutable source
    state or depends on component iteration order.
    """
    updates: dict[str, dict[str, Any]] = {name: {} for name in graph.components}
    for connection in graph.connections:
        source_values = dict(proposals.get(connection.source, {}))
        updates[connection.target].setdefault("inputs", {})[connection.type] = {
            "source": connection.source,
            "values": source_values,
        }
        if connection.direction == "<-->" and connection.source != connection.target:
            updates[connection.source].setdefault("inputs", {})[connection.type] = {
                "source": connection.target,
                "values": dict(proposals.get(connection.target, {})),
            }
    return updates