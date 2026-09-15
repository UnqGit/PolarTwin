"""Load and validate canonical simulator input documents."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .validator import load_json, validate_documents, validate_specification, validate_topology, validate_connections, validate_external


def load_topology(path: str | Path) -> dict[str, Any]:
    return validate_topology(load_json(path))[0]


def load_connections(path: str | Path, names: dict[str, str]) -> list[dict[str, Any]]:
    return validate_connections(load_json(path), names)


def load_specification(path: str | Path) -> dict[str, Any]:
    return validate_specification(load_json(path))


def load_external(path: str | Path | None) -> dict[str, Any] | None:
    if path is None:
        return None
    p = Path(path)
    if not p.exists():
        return None
    return validate_external(load_json(p))


def load_model_inputs(
    topology_path: str | Path,
    connections_path: str | Path | None = None,
    specification_path: str | Path | None = None
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    if specification_path is None and connections_path is not None:
        specification_path = connections_path
        connections_path = None

    topology = load_json(topology_path)
    connections = load_json(connections_path) if connections_path is not None else topology.get("connections", [])
    return validate_documents(topology, connections, load_json(specification_path))