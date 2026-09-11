import io
import json
import unittest

from twin_sim.outputs import MqttSink, create_sink, topic_for
from twin_sim.telemetry import TelemetryMessage


class FakeMqttClient:
    def __init__(self):
        self.calls = []

    def connect(self, host, port, keepalive=60):
        self.calls.append(("connect", host, port, keepalive))

    def publish(self, topic, payload, qos=0, retain=False):
        self.calls.append(("publish", topic, json.loads(payload), qos, retain))

    def loop_start(self):
        self.calls.append(("loop_start",))

    def loop_stop(self):
        self.calls.append(("loop_stop",))

    def disconnect(self):
        self.calls.append(("disconnect",))


class Phase14MqttTests(unittest.TestCase):
    def setUp(self):
        self.message = TelemetryMessage(
            "1.0", "mqtt-14", 1, component={"name": "FuelSensor", "type": "sensor"},
            measurement={"quantity": "fuel_level", "value": 80},
        )

    def test_topic_strategy_uses_component_and_message_type(self):
        self.assertEqual(topic_for(self.message, "/maitri/telemetry/"), "maitri/telemetry/FuelSensor/measurement")

    def test_sink_connects_publishes_and_closes(self):
        client = FakeMqttClient()
        sink = MqttSink("broker", topic_prefix="site", qos=1, retain=True, client=client)
        sink.write(self.message)
        sink.close()
        self.assertEqual(client.calls[0], ("connect", "broker", 1883, 60))
        self.assertEqual(client.calls[2][0], "publish")
        self.assertEqual(client.calls[2][1], "site/FuelSensor/measurement")
        self.assertEqual(client.calls[2][3:], (1, True))
        self.assertEqual(client.calls[-2:], [("loop_stop",), ("disconnect",)])

    def test_event_topic_uses_system_component(self):
        event = TelemetryMessage("1.0", "mqtt-14", 2, event={"type": "failure"})
        self.assertEqual(topic_for(event, "site"), "site/system/event")

    def test_factory_creates_mqtt_sink_without_importing_client(self):
        sink = create_sink({"type": "mqtt", "host": "broker", "topic_prefix": "site"})
        self.assertIsInstance(sink, MqttSink)

    def test_invalid_qos_is_rejected(self):
        with self.assertRaises(ValueError):
            MqttSink("broker", qos=3)


if __name__ == "__main__":
    unittest.main()