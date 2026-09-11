"""Global environmental state shared by simulation behaviors."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


DEFAULT_ENVIRONMENT = {
    "temperature": 0.0,
    "wind_speed": 0.0,
    "pressure": 1013.25,
    "humidity": 0.0,
    "connectivity": 1.0,
}


@dataclass
class EnvironmentState:
    values: dict[str, Any] = field(default_factory=lambda: dict(DEFAULT_ENVIRONMENT))

    def __init__(self, values: Mapping[str, Any] | None = None) -> None:
        self.values = dict(DEFAULT_ENVIRONMENT)
        if values:
            self.update(values)

    def update(self, values: Mapping[str, Any]) -> None:
        """Apply a deterministic partial update, preserving unknown variables."""
        self.values.update(values)

    def get(self, name: str, default: Any = None) -> Any:
        return self.values.get(name, default)

    def snapshot(self) -> dict[str, Any]:
        return dict(self.values)