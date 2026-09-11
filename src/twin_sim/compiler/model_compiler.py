"""Compile topology and specification documents into a generic graph."""

from __future__ import annotations

from typing import Any

from twin_sim.behaviors import infer_behaviors
from twin_sim.ingestion.validator import validate_documents
from twin_sim.model import Component, ComponentGraph, Connection


def compile_model(topology: Any, specification: Any) -> ComponentGraph:
    """Build a reusable graph without referring to topology-specific names."""
    valid_topology, valid_specification = validate_documents(topology, specification)
    components: dict[str, Component] = {}

    def build(node: dict[str, Any], parent: Component | None = None) -> Component:
        name = node["name"]
        component = Component(
            name=name,
            type=node["type"],
            tags=list(node["tags"]),
            parent=parent,
            specification=dict(valid_specification["components"][name]["spec"]),
        )
        components[name] = component
        component.children.extend(build(child, component) for child in node["children"])
        return component

    root = build(valid_topology)
    connections = [Connection(**connection) for connection in valid_topology["connections"]]
    graph = ComponentGraph(root, components, connections)
    graph.rebuild_indexes()

    specified_names = set(valid_specification["components"])
    for name in sorted(specified_names - set(components)):
        graph.diagnostics.append(f"specification component '{name}' is not present in topology")
    for name in components:
        if not graph.incoming(name) and not graph.outgoing(name):
            graph.diagnostics.append(f"component '{name}' has no functional connections")
    for connection in connections:
        if connection.source == connection.target:
            graph.diagnostics.append(f"self-connection detected for '{connection.source}'")
    infer_behaviors(graph)
    return graph