"""Generic component representation used by all future behaviors."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .runtime_state import RuntimeState


@dataclass
class Component:
    name: str
    type: str
    tags: list[str] = field(default_factory=list)
    parent: "Component | None" = None
    children: list["Component"] = field(default_factory=list)
    specification: dict[str, Any] = field(default_factory=dict)
    runtime_state: RuntimeState = field(default_factory=RuntimeState)
