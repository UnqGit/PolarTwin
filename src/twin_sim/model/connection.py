"""Functional dependency edges, separate from containment."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Connection:
    source: str
    target: str
    type: str
    direction: str
