"""Load scenario JSON into deterministic event objects."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from twin_sim.ingestion.validator import ValidationError, load_json

from .event import ScenarioEvent


def load_scenario_events(path: str | Path) -> list[ScenarioEvent]:
    document = load_json(path)
    if not isinstance(document, dict) or not isinstance(document.get("events"), list):
        raise ValidationError("scenario must be an object with an events array")
    events: list[ScenarioEvent] = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(document["events"]):
        prefix = f"scenario.events[{index}]"
        if not isinstance(raw, dict):
            raise ValidationError(f"{prefix} must be an object")
        for key in ("id", "timestamp", "event"):
            if key not in raw:
                raise ValidationError(f"{prefix} is missing '{key}'")
        event_id = raw["id"]
        event_name = raw["event"]
        timestamp = raw["timestamp"]
        if not isinstance(event_id, str) or not event_id:
            raise ValidationError(f"{prefix}.id must be a non-empty string")
        if event_id in seen_ids:
            raise ValidationError(f"duplicate scenario event id '{event_id}'")
        if not isinstance(event_name, str) or not event_name:
            raise ValidationError(f"{prefix}.event must be a non-empty string")
        if not isinstance(timestamp, (int, float)) or isinstance(timestamp, bool) or timestamp < 0:
            raise ValidationError(f"{prefix}.timestamp must be non-negative")
        duration = raw.get("duration")
        if duration is not None and (not isinstance(duration, (int, float)) or isinstance(duration, bool) or duration <= 0):
            raise ValidationError(f"{prefix}.duration must be positive")
        target = raw.get("target")
        if target is not None and (not isinstance(target, str) or not target):
            raise ValidationError(f"{prefix}.target must be a non-empty string")
        parameters = raw.get("parameters", {})
        if not isinstance(parameters, dict):
            raise ValidationError(f"{prefix}.parameters must be an object")
        seen_ids.add(event_id)
        events.append(ScenarioEvent(event_id, float(timestamp), event_name, duration, target, dict(parameters)))
    return sorted(events, key=lambda item: (item.timestamp, item.id))