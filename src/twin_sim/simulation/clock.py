"""Simulation time independent from wall-clock time."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ClockMode(str, Enum):
    REALTIME = "realtime"
    ACCELERATED = "accelerated"
    FAST = "fast"
    MANUAL = "manual"


@dataclass
class SimulationClock:
    tick_interval: float = 1.0
    time_scale: float = 1.0
    mode: ClockMode = ClockMode.FAST
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.tick_interval <= 0:
            raise ValueError("tick_interval must be positive")
        if self.time_scale <= 0:
            raise ValueError("time_scale must be positive")
        if self.timestamp < 0:
            raise ValueError("timestamp must be non-negative")
        if isinstance(self.mode, str):
            self.mode = ClockMode(self.mode)

    def advance(self) -> float:
        self.timestamp += self.tick_interval
        return self.timestamp

    @property
    def wall_delay(self) -> float:
        """Wall-clock delay for one tick; simulation time never uses it."""
        if self.mode == ClockMode.REALTIME:
            return self.tick_interval
        if self.mode == ClockMode.ACCELERATED:
            return self.tick_interval / self.time_scale
        return 0.0
