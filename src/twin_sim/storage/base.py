"""Database adapter contract independent from sink and simulation code."""

from __future__ import annotations

from abc import ABC, abstractmethod

from twin_sim.telemetry import TelemetryMessage


class DatabaseAdapter(ABC):
    def start(self) -> None:
        return None

    @abstractmethod
    def write(self, telemetry: TelemetryMessage) -> None:
        raise NotImplementedError

    def flush(self) -> None:
        return None

    def close(self) -> None:
        return None