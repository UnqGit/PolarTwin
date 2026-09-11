import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.simulation import SimulationEngine
from twin_sim.telemetry import TelemetryGenerator, serialize, serialize_lines


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase11TelemetryTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        self.graph = compile_model(read_json(root / "topology.json"), read_json(root / "specification.json"))

    def test_engine_generates_component_telemetry_after_commit(self):
        engine = SimulationEngine(self.graph, run_id="run-42")
        engine.step()
        self.assertEqual(len(engine.telemetry), 5)
        generator_message = next(item for item in engine.telemetry if item.component["name"] == "Generator")
        self.assertEqual(generator_message.run_id, "run-42")
        self.assertEqual(generator_message.timestamp, 1)
        self.assertEqual(generator_message.state["power_output"], 10.0)

    def test_sensor_uses_measurement_envelope(self):
        engine = SimulationEngine(self.graph)
        engine.step()
        message = next(item for item in engine.telemetry if item.component["name"] == "FuelSensor")
        self.assertEqual(message.measurement["quantity"], "fuel_level")
        self.assertIn("value", message.measurement)
        self.assertTrue(message.quality["simulated"])

    def test_serialization_is_deterministic_jsonl(self):
        engine = SimulationEngine(self.graph)
        engine.step()
        first = serialize_lines(engine.telemetry)
        second = serialize_lines(engine.telemetry)
        self.assertEqual(first, second)
        self.assertIn('"schema_version":"1.0"', serialize(engine.telemetry[0]))

    def test_event_message_has_standard_envelope(self):
        message = TelemetryGenerator("run-event").event_message(4, {"type": "failure", "target": "Generator"}, {"temperature": -20})
        document = message.to_dict()
        self.assertEqual(document["event"]["type"], "failure")
        self.assertEqual(document["context"]["environment"]["temperature"], -20)


if __name__ == "__main__":
    unittest.main()