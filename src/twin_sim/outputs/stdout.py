"""Human-readable JSON telemetry output."""

from __future__ import annotations

import sys
from typing import TextIO

from twin_sim.telemetry import TelemetryMessage, serialize

from .base import TelemetrySink


class StdoutSink(TelemetrySink):
    def __init__(self, stream: TextIO | None = None) -> None:
        self.stream = stream or sys.stdout

    def write(self, telemetry: TelemetryMessage) -> None:
        self.stream.write(serialize(telemetry) + "\n")

    def flush(self) -> None:
        self.stream.flush()