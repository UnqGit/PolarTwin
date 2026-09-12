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

    def record_experiment(
        self,
        run_id: str,
        seed: int | None,
        topology_hash: str,
        specification_hash: str,
        scenario_hash: str | None,
        configuration: str | None,
        start_timestamp: str,
        end_timestamp: str,
    ) -> None:
        return None

    def flush(self) -> None:
        return None

    def close(self) -> None:
        return None