"""Deterministic timestamp scheduler."""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Any, Callable


Callback = Callable[[float, Any], None]


@dataclass(order=True, frozen=True)
class ScheduledEvent:
    timestamp: float
    sequence: int
    callback: Callback = field(compare=False)
    payload: Any = field(compare=False, default=None)


class SimulationScheduler:
    def __init__(self) -> None:
        self._events: list[ScheduledEvent] = []
        self._sequence = 0

    def schedule(self, timestamp: float, callback: Callback, payload: Any = None) -> ScheduledEvent:
        if timestamp < 0:
            raise ValueError("event timestamp must be non-negative")
        event = ScheduledEvent(timestamp, self._sequence, callback, payload)
        self._sequence += 1
        heapq.heappush(self._events, event)
        return event

    def pop_due(self, timestamp: float) -> list[ScheduledEvent]:
        due: list[ScheduledEvent] = []
        while self._events and self._events[0].timestamp <= timestamp:
            due.append(heapq.heappop(self._events))
        return due

    def __len__(self) -> int:
        return len(self._events)
