"""Canonical timestamped scenario event."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ScenarioEvent:
    id: str
    timestamp: float
    event: str
    duration: float | None = None
    target: str | None = None
    parameters: dict[str, Any] = field(default_factory=dict)
