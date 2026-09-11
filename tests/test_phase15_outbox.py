import json
import tempfile
import unittest
from pathlib import Path

from twin_sim.outputs import MqttStoreForwardSink
from twin_sim.storage import SQLiteOutbox
from twin_sim.telemetry import TelemetryMessage


class FakeClient:
    def __init__(self, fail=False):
        self.fail = fail
        self.published = []

    def connect(self, host, port, keepalive=60):
        if self.fail:
            raise ConnectionError("offline")

    def loop_start(self):
        pass

    def publish(self, topic, payload, qos=0, retain=False):
        if self.fail:
            raise ConnectionError("offline")
        self.published.append((topic, json.loads(payload), qos, retain))

    def loop_stop(self):
        pass

    def disconnect(self):
        pass


class Phase15OutboxTests(unittest.TestCase):
    def setUp(self):
        self.message = TelemetryMessage("1.0", "outbox-15", 1, component={"name": "Generator", "type": "generator"}, state={"power": 10})

    def test_enqueue_survives_mqtt_failure_and_retries(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient(fail=True)
            sink = MqttStoreForwardSink("broker", Path(directory) / "outbox.db", client=client, worker=False, retry_base=0)
            sink.write(self.message)
            self.assertEqual(sink.outbox.count("PENDING"), 1)
            sink.drain_once(now=0)
            self.assertEqual(sink.outbox.count("FAILED"), 1)
            client.fail = False
            sink.drain_once(now=0)
            self.assertEqual(sink.outbox.count("DELIVERED"), 1)
            self.assertEqual(client.published[0][0], "twin/telemetry/Generator/state")
            sink.close()

    def test_message_ids_are_deterministic_and_duplicate_safe(self):
        with tempfile.TemporaryDirectory() as directory:
            outbox = SQLiteOutbox(Path(directory) / "outbox.db")
            outbox.enqueue("run-1", "topic", "payload", 1, False)
            outbox.enqueue("run-1", "topic", "different", 1, False)
            self.assertEqual(outbox.count(), 1)
            outbox.close()

    def test_async_worker_delivers_without_blocking_write(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient()
            sink = MqttStoreForwardSink("broker", Path(directory) / "outbox.db", client=client, worker=True)
            sink.write(self.message)
            sink.flush()
            self.assertEqual(sink.outbox.count("DELIVERED"), 1)
            sink.close()


if __name__ == "__main__":
    unittest.main()