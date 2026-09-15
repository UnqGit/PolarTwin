"""Compile topology and specification documents into a generic graph."""

from __future__ import annotations

from typing import Any

from twin_sim.behaviors import infer_behaviors
from twin_sim.ingestion.validator import validate_documents
from twin_sim.observability import SafetyError
from twin_sim.model import Component, ComponentGraph, Connection


def compile_model(
    topology: Any,
    raw_connections: Any = None,
    specification: Any = None,
    validation_config: dict[str, str] | None = None,
    external_data: dict[str, Any] | None = None,
    external_data_reference: str | None = None
) -> ComponentGraph:
    """Build a reusable graph without referring to topology-specific names."""
    
    # Backward compatibility: compile_model(topology, specification)
    if specification is None and isinstance(raw_connections, dict) and "components" in raw_connections:
        specification = raw_connections
        raw_connections = None
        
    if raw_connections is None:
        raw_connections = topology.get("connections", []) if isinstance(topology, dict) else []
        
    valid_topology, valid_connections, valid_specification = validate_documents(topology, raw_connections, specification, validation_config)
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
    connections = [Connection(**connection) for connection in valid_connections]
    graph = ComponentGraph(
        root=root,
        components=components,
        connections=connections,
        external_data_config=external_data or {},
        external_data_reference=external_data_reference
    )
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
            
    # Check for unknown sensors
    validation_config = validation_config or {}
    for name, component in components.items():
        if component.type == "sensor":
            quantity = component.specification.get("quantity")
            if quantity not in {None, '', 'wind_speed', 'data_integrity', 'battery_health', 'air_quality', 'storage_level', 'humidity', 'environmental_status', 'state_of_charge', 'ground_displacement', 'co2', 'fuel_level', 'access_event', 'temperature', 'network_status', 'position', 'occupancy', 'health_status', 'pressure', 'signal_quality', 'smoke_detection', 'emergency_status', 'salinity', 'voltage', 'gas_concentration', 'radiation', 'fire_detection', 'power', 'level', 'inventory_status', 'airflow', 'status', 'energy', 'fuel'}:
                msg = f"unknown sensor quantity '{quantity}' for sensor '{name}'"
                severity = validation_config.get("unknown_sensor", "error")
                if severity == "error":
                    raise SafetyError(f"Safety violation (unknown_sensor): [{name}] {msg}")
                elif severity == "warning":
                    graph.diagnostics.append(msg)
                    
    infer_behaviors(graph)
    return graph