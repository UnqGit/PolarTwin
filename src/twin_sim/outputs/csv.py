"""Flat CSV projection of telemetry envelopes."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import TextIO

from twin_sim.telemetry import TelemetryMessage

from .base import TelemetrySink


class CsvSink(TelemetrySink):
    fieldnames = ["schema_version", "run_id", "timestamp", "message_type", "component", "component_type", "quantity", "value", "unit", "status"]

    def __init__(self, path: str | Path, stream: TextIO | None = None) -> None:
        self.path = Path(path)
        self._stream = stream
        self._owned_stream: TextIO | None = None
        self._writer = None

    def start(self) -> None:
        if self._stream is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._owned_stream = self.path.open("a", newline="", encoding="utf-8")
            self._stream = self._owned_stream
        self._writer = csv.DictWriter(self._stream, fieldnames=self.fieldnames, extrasaction="ignore")
        if self._stream.tell() == 0:
            self._writer.writeheader()

    def write(self, telemetry: TelemetryMessage) -> None:
        if self._writer is None:
            self.start()
        component = telemetry.component or {}
        measurement = telemetry.measurement or {}
        message_type = "measurement" if telemetry.measurement is not None else "event" if telemetry.event is not None else "state"
        self._writer.writerow({
            "schema_version": telemetry.schema_version,
            "run_id": telemetry.run_id,
            "timestamp": telemetry.timestamp,
            "message_type": message_type,
            "component": component.get("name", ""),
            "component_type": component.get("type", ""),
            "quantity": measurement.get("quantity", ""),
            "value": measurement.get("value", ""),
            "unit": measurement.get("unit", ""),
            "status": telemetry.quality.get("status", ""),
        })

    def flush(self) -> None:
        if self._stream is not None:
            self._stream.flush()

    def close(self) -> None:
        self.flush()
        if self._owned_stream is not None:
            self._owned_stream.close()
            self._owned_stream = None
            self._stream = None
            self._writer = None