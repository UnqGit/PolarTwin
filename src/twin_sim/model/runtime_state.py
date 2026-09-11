"""Mutable runtime state kept separate from telemetry observations."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RuntimeState:
    values: dict[str, Any] = field(default_factory=dict)
    health: float = 1.0
    available: bool = True

    def copy(self) -> "RuntimeState":
        return RuntimeState(dict(self.values), self.health, self.available)