"""Telemetry sink backed by an interchangeable database adapter."""

from __future__ import annotations

from twin_sim.storage import DatabaseAdapter
from twin_sim.telemetry import TelemetryMessage

from .base import TelemetrySink


class DatabaseSink(TelemetrySink):
    def __init__(self, adapter: DatabaseAdapter) -> None:
        self.adapter = adapter

    def start(self) -> None:
        self.adapter.start()

    def write(self, telemetry: TelemetryMessage) -> None:
        self.adapter.write(telemetry)

    def flush(self) -> None:
        self.adapter.flush()

    def close(self) -> None:
        self.adapter.close()