import tempfile
import unittest
from pathlib import Path

from twin_sim.outputs import ConnectivityPolicy, MqttStoreForwardSink
from twin_sim.telemetry import TelemetryMessage


class FakeClient:
    def __init__(self):
        self.published = []

    def connect(self, host, port, keepalive=60):
        pass

    def loop_start(self):
        pass

    def publish(self, topic, payload, qos=0, retain=False):
        self.published.append(topic)

    def loop_stop(self):
        pass

    def disconnect(self):
        pass


class Phase16ConnectivityTests(unittest.TestCase):
    def setUp(self):
        self.message = TelemetryMessage(
            "1.0", "connectivity-16", 1,
            component={"name": "Sensor", "type": "sensor"},
            state={"value": 1},
            context={"environment": {"connectivity": 1.0}},
        )

    def test_packet_loss_keeps_message_in_outbox(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient()
            policy = ConnectivityPolicy(random_value=lambda: 0.0)
            sink = MqttStoreForwardSink("broker", Path(directory) / "outbox.db", client=client, worker=False, retry_base=0, connectivity_policy=policy)
            lost = TelemetryMessage(**{**self.message.__dict__, "context": {"environment": {"connectivity": 0.0}}})
            sink.write(lost)
            sink.drain_once(now=0)
            self.assertEqual(sink.outbox.count("FAILED"), 1)
            self.assertEqual(client.published, [])
            sink.close()

    def test_reconnect_delivers_after_connectivity_recovers(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient()
            values = iter([0.0, 1.0])
            policy = ConnectivityPolicy(random_value=lambda: next(values))
            sink = MqttStoreForwardSink("broker", Path(directory) / "outbox.db", client=client, worker=False, retry_base=0, connectivity_policy=policy)
            sink.write(self.message)
            sink.drain_once(now=0)
            sink.drain_once(now=0)
            self.assertEqual(sink.outbox.count("DELIVERED"), 1)
            self.assertEqual(len(client.published), 1)
            sink.close()

    def test_latency_uses_injected_sleeper(self):
        delays = []
        policy = ConnectivityPolicy(random_value=lambda: 1.0, sleeper=delays.append)
        self.assertEqual(policy.delay({"latency_ms": 250}), 0.25)
        self.assertEqual(delays, [0.25])


if __name__ == "__main__":
    unittest.main()