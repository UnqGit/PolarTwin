"""Load and validate canonical simulator input documents."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .validator import load_json, validate_documents, validate_specification, validate_topology, validate_connections


def load_topology(path: str | Path) -> dict[str, Any]:
    return validate_topology(load_json(path))[0]


def load_connections(path: str | Path, names: dict[str, str]) -> list[dict[str, Any]]:
    return validate_connections(load_json(path), names)


def load_specification(path: str | Path) -> dict[str, Any]:
    return validate_specification(load_json(path))


def load_model_inputs(topology_path: str | Path, connections_path: str | Path, specification_path: str | Path) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    return validate_documents(load_json(topology_path), load_json(connections_path), load_json(specification_path))