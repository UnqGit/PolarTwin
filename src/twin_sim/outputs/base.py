"""Output sink interface independent from simulation and telemetry generation."""

from __future__ import annotations

from abc import ABC, abstractmethod

from twin_sim.telemetry import TelemetryMessage


class TelemetrySink(ABC):
    def start(self) -> None:
        return None

    @abstractmethod
    def write(self, telemetry: TelemetryMessage) -> None:
        raise NotImplementedError

    def flush(self) -> None:
        return None

    def close(self) -> None:
        return None

    def tick(self, dt: float, environment: dict) -> None:
        return None

    def __enter__(self) -> "TelemetrySink":
        self.start()
        return self

    def __exit__(self, exception_type, exception, traceback) -> None:
        self.close()