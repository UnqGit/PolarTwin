"""Multiplexing sink for writing to multiple outputs simultaneously."""

from typing import Any

from .base import TelemetrySink


class MultiSink(TelemetrySink):
    """Broadcasts telemetry messages to multiple underlying sinks."""

    def __init__(self, sinks: list[TelemetrySink]) -> None:
        self.sinks = sinks

    def start(self) -> None:
        for sink in self.sinks:
            sink.start()

    def write(self, telemetry: Any) -> None:
        for sink in self.sinks:
            sink.write(telemetry)

    def write_batch(self, telemetries: list[Any]) -> None:
        for sink in self.sinks:
            if hasattr(sink, "write_batch"):
                sink.write_batch(telemetries)
            else:
                for telemetry in telemetries:
                    sink.write(telemetry)

    def flush(self) -> None:
        for sink in self.sinks:
            sink.flush()

    def close(self) -> None:
        for sink in self.sinks:
            sink.close()
