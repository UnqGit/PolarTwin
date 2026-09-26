"""One canonical telemetry envelope per line."""

from __future__ import annotations

from pathlib import Path
from typing import TextIO

from twin_sim.telemetry import TelemetryMessage, serialize

from .base import TelemetrySink


class JsonlSink(TelemetrySink):
    def __init__(self, path: str | Path, stream: TextIO | None = None) -> None:
        self.path = Path(path)
        self._stream = stream
        self._owned_stream: TextIO | None = None

    def start(self) -> None:
        if self._stream is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._owned_stream = self.path.open("a", encoding="utf-8")
            self._stream = self._owned_stream

    def write(self, telemetry: TelemetryMessage) -> None:
        if self._stream is None:
            self.start()
        assert self._stream is not None
        self._stream.write(serialize(telemetry) + "\n")

    def flush(self) -> None:
        if self._stream is not None:
            self._stream.flush()

    def close(self) -> None:
        self.flush()
        if self._owned_stream is not None:
            self._owned_stream.close()
            self._owned_stream = None
            self._stream = None