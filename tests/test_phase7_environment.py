import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.simulation import EnvironmentState, SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase7EnvironmentTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "data/compiled/maitri"
        self.graph = compile_model(read_json(root / "relation.json"), read_json(root / "spec.json"))

    def test_environment_has_defaults_and_preserves_custom_variables(self):
        environment = EnvironmentState({"temperature": -25, "storm_level": 0.4})
        self.assertEqual(environment.get("temperature"), -25)
        self.assertEqual(environment.get("connectivity"), 1.0)
        self.assertEqual(environment.get("storm_level"), 0.4)

    def test_sensor_reads_environment_when_no_signal_is_connected(self):
        engine = SimulationEngine(self.graph, environment={"temperature": -25})
        sensor = self.graph.get("OutdoorTemperatureSensor")
        engine.step()
        self.assertAlmostEqual(sensor.runtime_state.values["measurement"], -25, delta=1)

    def test_environment_update_is_visible_on_next_tick(self):
        engine = SimulationEngine(self.graph, environment={"temperature": -25})
        sensor = self.graph.get("OutdoorTemperatureSensor")
        engine.schedule(2, lambda timestamp, payload: engine.environment.update({"temperature": -40}))
        engine.step()
        self.assertAlmostEqual(sensor.runtime_state.values["measurement"], -25, delta=1)
        engine.step()
        self.assertAlmostEqual(sensor.runtime_state.values["measurement"], -40, delta=1)

    def test_environment_is_available_during_initialization(self):
        engine = SimulationEngine(self.graph, environment={"temperature": -25})
        self.assertEqual(engine.context.values["environment"]["temperature"], -25)


if __name__ == "__main__":
    unittest.main()
