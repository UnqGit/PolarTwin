import copy
import json
import unittest
from pathlib import Path

from twin_sim.behaviors import BehaviorContext
from twin_sim.behaviors.physical import (
    BatteryPhysicalBehavior,
    GeneratorPhysicalBehavior,
    SensorPhysicalBehavior,
)
from twin_sim.compiler import compile_model
from twin_sim.simulation import RandomSource


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase6PhysicalTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "data/compiled/maitri"
        self.graph = compile_model(read_json(root / "relation.json"), read_json(root / "spec.json"))
        self.context = BehaviorContext({"random": RandomSource(42), "inputs": {}})

    def test_generator_respects_rating_and_depletes_fuel(self):
        component = self.graph.get("Generator1")
        behavior = GeneratorPhysicalBehavior()
        behavior.initialize(component, self.context)
        result = behavior.evaluate(component, self.context, 3600)
        self.assertEqual(result["power_output"], 300)
        self.assertLess(result["fuel_level"], 2000)
        self.assertGreaterEqual(result["fuel_level"], 0)

    def test_battery_soc_stays_bounded(self):
        component = self.graph.get("BatteryBank")
        behavior = BatteryPhysicalBehavior()
        behavior.initialize(component, self.context)
        context = BehaviorContext({"random": RandomSource(1), "inputs": {"discharge_power": 10000}})
        result = behavior.evaluate(component, context, 3600)
        self.assertGreaterEqual(result["state_of_charge"], 0)
        self.assertLessEqual(result["state_of_charge"], 1)

    def test_sensor_clamps_noise_to_declared_range(self):
        component = self.graph.get("FuelLevelSensor")
        behavior = SensorPhysicalBehavior()
        context = BehaviorContext({"random": RandomSource(42), "inputs": {"fuel_level": 5000}})
        result = behavior.evaluate(component, context, 1)
        self.assertGreaterEqual(result["measurement"], 0)
        self.assertLessEqual(result["measurement"], 100)

    def test_compiler_attaches_physical_behaviors(self):
        self.assertIsInstance(self.graph.get("Generator1").behavior, GeneratorPhysicalBehavior)
        self.assertIsInstance(self.graph.get("BatteryBank").behavior, BatteryPhysicalBehavior)
        self.assertIsInstance(self.graph.get("FuelLevelSensor").behavior, SensorPhysicalBehavior)


if __name__ == "__main__":
    unittest.main()
