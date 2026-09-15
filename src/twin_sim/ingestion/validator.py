"""Dependency-free validation for the canonical Phase 1 JSON contracts."""

from __future__ import annotations

import datetime
import json
from pathlib import Path
from typing import Any

ALLOWED_DIRECTIONS = {"-->", "<-->", "-.->"}


class ValidationError(ValueError):
    """Raised when a document or cross-document reference is invalid."""


def load_json(path: str | Path) -> Any:
    filename = Path(path)
    try:
        with filename.open(encoding="utf-8") as stream:
            return json.load(stream)
    except FileNotFoundError as exc:
        raise ValidationError(f"File not found: {filename}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(
            f"Invalid JSON in {filename}: line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc


def _object(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValidationError(f"{path} must be an object")
    return value


def _string(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValidationError(f"{path} must be a non-empty string")
    return value


def validate_topology(document: Any, validation_config: dict[str, str] | None = None) -> dict[str, Any]:
    validation_config = validation_config or {}
    root = _object(document, "topology")
    for field in ("name", "type", "tags", "children"):
        if field not in root:
            raise ValidationError(f"topology is missing required field '{field}'")
    _string(root["name"], "topology.name")
    _string(root["type"], "topology.type")
    if not isinstance(root["tags"], list) or not all(isinstance(tag, str) and tag for tag in root["tags"]):
        raise ValidationError("topology.tags must be an array of non-empty strings")
    if len(root["tags"]) != len(set(root["tags"])):
        raise ValidationError("topology.tags must not contain duplicates")
    if not isinstance(root["children"], list):
        raise ValidationError("topology.children must be an array")

    names: dict[str, str] = {}

    def visit(node: Any, path: str) -> None:
        item = _object(node, path)
        for field in ("name", "type", "tags", "children"):
            if field not in item:
                raise ValidationError(f"{path} is missing required field '{field}'")
        name = _string(item["name"], f"{path}.name")
        _string(item["type"], f"{path}.type")
        if name in names:
            raise ValidationError(f"duplicate component name '{name}' at {path}; first declared at {names[name]}")
        names[name] = path
        if not isinstance(item["tags"], list) or not all(isinstance(tag, str) and tag for tag in item["tags"]):
            raise ValidationError(f"{path}.tags must be an array of non-empty strings")
        if not isinstance(item["children"], list):
            raise ValidationError(f"{path}.children must be an array")
        for index, child in enumerate(item["children"]):
            visit(child, f"{path}.children[{index}]")

    visit(root, "topology")
    return root, names

def validate_connections(document: Any, names: dict[str, str], validation_config: dict[str, str] | None = None) -> list[dict[str, Any]]:
    validation_config = validation_config or {}
    if not isinstance(document, list):
        raise ValidationError("connections must be an array")
        
    for index, connection in enumerate(document):
        path = f"connections[{index}]"
        item = _object(connection, path)
        for field in ("source", "target", "type", "direction"):
            if field not in item:
                raise ValidationError(f"{path} is missing required field '{field}'")
        source = _string(item["source"], f"{path}.source")
        target = _string(item["target"], f"{path}.target")
        _string(item["type"], f"{path}.type")
        if item["direction"] not in ALLOWED_DIRECTIONS:
            raise ValidationError(f"{path}.direction must be one of {sorted(ALLOWED_DIRECTIONS)}")
        if source not in names or target not in names:
            missing = source if source not in names else target
            msg = f"{path} references unknown component '{missing}'"
            severity = validation_config.get("invalid_connection", "error")
            if severity == "error":
                raise ValidationError(msg)
            elif severity == "warning":
                pass
    return document


def validate_specification(document: Any) -> dict[str, Any]:
    spec = _object(document, "specification")
    for field in ("components", "defaults"):
        if field not in spec:
            raise ValidationError(f"specification is missing required field '{field}'")
        if not isinstance(spec[field], dict):
            raise ValidationError(f"specification.{field} must be an object")
    for name, component in spec["components"].items():
        _string(name, "specification.components key")
        item = _object(component, f"specification.components['{name}']")
        if "type" not in item or "spec" not in item:
            raise ValidationError(f"specification component '{name}' requires 'type' and 'spec'")
        _string(item["type"], f"specification.components['{name}'].type")
        if not isinstance(item["spec"], dict):
            raise ValidationError(f"specification.components['{name}'].spec must be an object")
    for component_type, default in spec["defaults"].items():
        _string(component_type, "specification.defaults key")
        if not isinstance(default, dict):
            raise ValidationError(f"specification.defaults['{component_type}'] must be an object")
    return spec


def validate_documents(topology: Any, connections: Any, specification: Any, validation_config: dict[str, str] | None = None) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    """Validate both documents and their component/type cross references."""
    valid_topology, names = validate_topology(topology, validation_config)
    valid_connections = validate_connections(connections, names, validation_config)
    valid_specification = validate_specification(specification)
    relation_types: dict[str, str] = {}

    def collect(node: dict[str, Any]) -> None:
        relation_types[node["name"]] = node["type"]
        for child in node["children"]:
            collect(child)

    collect(valid_topology)
    for name, relation_type in relation_types.items():
        component = valid_specification["components"].get(name)
        if component is None:
            raise ValidationError(f"component '{name}' has no specification")
        if component["type"] != relation_type:
            raise ValidationError(f"type mismatch for '{name}': topology has '{relation_type}', specification has '{component['type']}'")
    return valid_topology, valid_connections, valid_specification


def validate_external(document: Any) -> dict[str, Any]:
    """Validate external data configuration."""
    if document is None:
        return {}
    root = _object(document, "external")
    
    # Optional weather
    if "weather" in root:
        weather = _object(root["weather"], "external.weather")
        # Validate time-series or scalar
        for k, v in weather.items():
            if isinstance(v, list):
                for i, point in enumerate(v):
                    p = _object(point, f"external.weather.{k}[{i}]")
                    if "time" not in p or "value" not in p:
                        raise ValidationError(f"external.weather.{k}[{i}] must have 'time' and 'value'")
                    if not isinstance(p["time"], (int, float)) or not isinstance(p["value"], (int, float)):
                        raise ValidationError(f"external.weather.{k}[{i}] 'time' and 'value' must be numbers")
            elif not isinstance(v, (int, float)):
                raise ValidationError(f"external.weather.{k} must be a number or a time-series array")
                
    # Optional network
    if "network" in root:
        network = _object(root["network"], "external.network")
        for k, v in network.items():
            if isinstance(v, list):
                for i, point in enumerate(v):
                    p = _object(point, f"external.network.{k}[{i}]")
                    if "time" not in p or "value" not in p:
                        raise ValidationError(f"external.network.{k}[{i}] must have 'time' and 'value'")
                    if not isinstance(p["time"], (int, float)):
                        raise ValidationError(f"external.network.{k}[{i}] 'time' must be a number")
            elif not isinstance(v, (int, float, str)):
                raise ValidationError(f"external.network.{k} must be a primitive or a time-series array")
                
    # Optional supplies
    if "supplies" in root:
        if not isinstance(root["supplies"], list):
            raise ValidationError("external.supplies must be an array")
        for i, supply in enumerate(root["supplies"]):
            s = _object(supply, f"external.supplies[{i}]")
            for field in ("eta", "description", "transportation_mode"):
                if field not in s:
                    raise ValidationError(f"external.supplies[{i}] is missing required field '{field}'")
                _string(s[field], f"external.supplies[{i}].{field}")
            # Validate ETA format
            try:
                datetime.datetime.fromisoformat(s["eta"].replace("Z", "+00:00"))
            except ValueError:
                raise ValidationError(f"external.supplies[{i}].eta must be a valid ISO 8601 string")
                
    return root