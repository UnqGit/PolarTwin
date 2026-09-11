"""Deterministic JSON serialization for telemetry sinks."""

from __future__ import annotations

import json
from collections.abc import Iterable

from .model import TelemetryMessage


def serialize(message: TelemetryMessage) -> str:
    return json.dumps(message.to_dict(), sort_keys=True, separators=(",", ":"))


def serialize_lines(messages: Iterable[TelemetryMessage]) -> str:
    return "\n".join(serialize(message) for message in messages)