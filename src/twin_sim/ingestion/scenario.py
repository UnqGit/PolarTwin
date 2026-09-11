"""Scenario and runtime configuration contract loaders."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .validator import load_json, ValidationError


def load_scenario(path: str | Path) -> dict[str, Any]:
    document = load_json(path)
    if not isinstance(document, dict) or not isinstance(document.get("events"), list):
        raise ValidationError("scenario must be an object with an events array")
    if not isinstance(document.get("name"), str) or not document["name"]:
        raise ValidationError("scenario.name must be a non-empty string")
    for index, event in enumerate(document["events"]):
        if not isinstance(event, dict):
            raise ValidationError(f"scenario.events[{index}] must be an object")
        for field in ("id", "timestamp", "event"):
            if field not in event:
                raise ValidationError(f"scenario.events[{index}] is missing '{field}'")
        if not isinstance(event["id"], str) or not event["id"]:
            raise ValidationError(f"scenario.events[{index}].id must be a non-empty string")
        if not isinstance(event["timestamp"], (int, float)) or event["timestamp"] < 0:
            raise ValidationError(f"scenario.events[{index}].timestamp must be non-negative")
        if not isinstance(event["event"], str) or not event["event"]:
            raise ValidationError(f"scenario.events[{index}].event must be a non-empty string")
    return document


def load_runtime_config(path: str | Path) -> dict[str, Any]:
    document = load_json(path)
    if not isinstance(document, dict):
        raise ValidationError("runtime configuration must be an object")
    for field in ("mode", "tick_interval", "time_scale", "outputs"):
        if field not in document:
            raise ValidationError(f"runtime configuration is missing '{field}'")
    if document["mode"] not in {"simulator", "generator"}:
        raise ValidationError("runtime configuration.mode must be 'simulator' or 'generator'")
    if not isinstance(document["tick_interval"], (int, float)) or document["tick_interval"] <= 0:
        raise ValidationError("runtime configuration.tick_interval must be positive")
    if not isinstance(document["time_scale"], (int, float)) or document["time_scale"] <= 0:
        raise ValidationError("runtime configuration.time_scale must be positive")
    if not isinstance(document["outputs"], list):
        raise ValidationError("runtime configuration.outputs must be an array")
    return document