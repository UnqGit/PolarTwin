from collections import deque
from threading import Lock
from typing import List

from twin_sim.outputs.base import TelemetrySink
from twin_sim.telemetry import TelemetryMessage


class RingBufferSink(TelemetrySink):
    """A thread-safe in-memory sink that retains the last N telemetry messages."""
    def __init__(self, capacity: int = 1000):
        self.capacity = capacity
        self.buffer: deque[TelemetryMessage] = deque(maxlen=capacity)
        self.lock = Lock()

    def write(self, telemetry: TelemetryMessage) -> None:
        with self.lock:
            self.buffer.append(telemetry)

    def write_batch(self, telemetry_list: List[TelemetryMessage]) -> None:
        with self.lock:
            self.buffer.extend(telemetry_list)

    def get_all(self) -> List[TelemetryMessage]:
        """Return a snapshot of the current buffer."""
        with self.lock:
            return list(self.buffer)
