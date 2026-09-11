"""Asynchronous telemetry pipeline with backpressure."""

import queue
import threading
from typing import Any

from .base import TelemetrySink


class AsyncTelemetryPipeline(TelemetrySink):
    """Wraps a synchronous sink in a background thread to avoid blocking simulation.
    
    If the internal queue fills up, new batches are processed according to the
    `backpressure_policy`. The default 'drop' policy avoids slowing down the 
    simulation loop at the cost of dropped metrics.
    """

    def __init__(
        self,
        sink: TelemetrySink,
        max_queue_size: int = 1000,
        backpressure_policy: str = "drop",
    ) -> None:
        self.sink = sink
        self.max_queue_size = max_queue_size
        self.backpressure_policy = backpressure_policy
        self._queue: queue.Queue[list[Any] | None] = queue.Queue(maxsize=max_queue_size)
        self._thread: threading.Thread | None = None
        self._running = False
        self.dropped_batches = 0

    def start(self) -> None:
        self.sink.start()
        self._running = True
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def _worker(self) -> None:
        while True:
            try:
                batch = self._queue.get(timeout=0.1)
                if batch is None:
                    break
                for message in batch:
                    self.sink.write(message)
                self.sink.flush()
                self._queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                # In a real system, we might want to log this or halt the pipeline.
                # For the MVP, we continue pulling to avoid backing up the queue.
                if self._queue.unfinished_tasks:
                    self._queue.task_done()
        # Flush one last time when exiting
        self.sink.flush()

    def write(self, message: Any) -> None:
        """Write a single message. Usually `write_batch` is preferred."""
        self.write_batch([message])

    def write_batch(self, messages: list[Any]) -> None:
        """Push a batch of messages into the pipeline queue."""
        if not self._running:
            return

        # Fast path
        try:
            self._queue.put_nowait(messages)
            return
        except queue.Full:
            pass

        if self.backpressure_policy == "block":
            self._queue.put(messages)
        else:
            # Policy is 'drop'. Try to remove the oldest to make room.
            try:
                self._queue.get_nowait()
                self._queue.task_done()
                self.dropped_batches += 1
            except queue.Empty:
                pass
            
            # Now try to put again.
            try:
                self._queue.put_nowait(messages)
            except queue.Full:
                self.dropped_batches += 1

    def flush(self) -> None:
        if self._running:
            self.sink.flush()

    def close(self) -> None:
        if self._running:
            self._running = False
            self._queue.put(None)
            if self._thread:
                self._thread.join(timeout=2.0)
        self.sink.close()
