"""Stable JSON-compatible telemetry message model."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class TelemetryMessage:
    schema_version: str
    run_id: str
    timestamp: float
    component: dict[str, Any] | None = None
    measurement: dict[str, Any] | None = None
    state: dict[str, Any] | None = None
    quality: dict[str, Any] = field(default_factory=dict)
    source: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)
    active_events: list[Any] = field(default_factory=list)
    event: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        message: dict[str, Any] = {
            "schema_version": self.schema_version,
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "quality": dict(self.quality),
            "source": dict(self.source),
            "context": dict(self.context),
            "active_events": list(self.active_events),
        }
        if self.component is not None:
            message["component"] = dict(self.component)
        if self.measurement is not None:
            message["measurement"] = dict(self.measurement)
        if self.state is not None:
            message["state"] = dict(self.state)
        if self.event is not None:
            message["event"] = dict(self.event)
        return message