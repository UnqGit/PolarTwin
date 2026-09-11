import time
import unittest
from typing import Any

from twin_sim.outputs.async_pipeline import AsyncTelemetryPipeline
from twin_sim.outputs.base import TelemetrySink


class DummySink(TelemetrySink):
    def __init__(self):
        self.messages = []
        self.flush_called = 0

    def start(self):
        pass

    def write(self, message: Any):
        self.messages.append(message)

    def flush(self):
        self.flush_called += 1

    def close(self):
        pass


class Phase23PerformanceTests(unittest.TestCase):
    def test_async_pipeline_flushes_messages_on_background_thread(self):
        sink = DummySink()
        pipeline = AsyncTelemetryPipeline(sink, max_queue_size=10, backpressure_policy="drop")
        pipeline.start()
        
        try:
            pipeline.write_batch([1, 2, 3])
            time.sleep(0.2)  # Wait for worker thread to pick it up
            self.assertEqual(sink.messages, [1, 2, 3])
            self.assertGreaterEqual(sink.flush_called, 1)
        finally:
            pipeline.close()

    def test_pipeline_drop_policy_drops_oldest(self):
        class SlowSink(TelemetrySink):
            def __init__(self):
                self.messages = []
            def start(self): pass
            def write(self, message): 
                time.sleep(0.1)
                self.messages.append(message)
            def flush(self): pass
            def close(self): pass

        sink = SlowSink()
        # Max queue size is 1 batch.
        pipeline = AsyncTelemetryPipeline(sink, max_queue_size=1, backpressure_policy="drop")
        pipeline.start()
        
        try:
            pipeline.write_batch(["batch1"])  # This gets picked up by the worker immediately.
            time.sleep(0.05) # Give worker time to pop batch1 from the queue
            pipeline.write_batch(["batch2"])  # Fills the queue.
            pipeline.write_batch(["batch3"])  # Should drop batch2 and replace with batch3.
    
            time.sleep(0.3)  # Wait for worker to process
        finally:
            pipeline.close()
        
        # Depending on timing, we should see batch1 and batch3. batch2 was dropped.
        self.assertIn("batch1", sink.messages)
        self.assertIn("batch3", sink.messages)
        self.assertNotIn("batch2", sink.messages)
        self.assertEqual(pipeline.dropped_batches, 1)

if __name__ == "__main__":
    unittest.main()
