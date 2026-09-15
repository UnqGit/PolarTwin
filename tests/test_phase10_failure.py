import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.scenarios import ScenarioEvent, ScenarioScheduler
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase10FailureTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "data/compiled/maitri"
        self.graph = compile_model(read_json(root / "relation.json"), read_json(root / "connection.json"), read_json(root / "spec.json"))

    def test_failed_primary_activates_backup_without_component_names(self):
        engine = SimulationEngine(self.graph)
        ScenarioScheduler().schedule(engine, [ScenarioEvent("fail", 1, "component_failure", target="Generator1")])
        engine.step()
        primary = self.graph.get("Generator1")
        backup = self.graph.get("Generator2")
        self.assertFalse(primary.runtime_state.available)
        self.assertEqual(primary.runtime_state.values["power_output"], 0.0)
        self.assertEqual(backup.runtime_state.values["power_output"], 300.0)
        self.assertTrue(any(item.get("effect") == "backup_generation_increased" for item in engine.causal_trace))

    def test_battery_is_used_when_backup_capacity_is_insufficient(self):
        graph = self.graph
        graph.get("Generator2").specification["rating"]["value"] = 100
        engine = SimulationEngine(graph)
        ScenarioScheduler().schedule(engine, [ScenarioEvent("fail", 1, "component_failure", target="Generator1")])
        engine.step()
        self.assertEqual(graph.get("Generator2").runtime_state.values["power_output"], 100.0)
        self.assertEqual(graph.get("BatteryBank").runtime_state.values["discharge_power"], 200.0)
        self.assertTrue(any(item.get("effect") == "battery_discharge_requested" for item in engine.causal_trace))

    def test_repair_stops_recovery_request(self):
        engine = SimulationEngine(self.graph)
        ScenarioScheduler().schedule(engine, [
            ScenarioEvent("fail", 1, "component_failure", target="Generator1"),
            ScenarioEvent("repair", 2, "component_repair", target="Generator1"),
        ])
        engine.step()
        engine.step()
        self.assertTrue(self.graph.get("Generator1").runtime_state.available)
        self.assertEqual(self.graph.get("Generator2").runtime_state.values["power_output"], 0.0)


if __name__ == "__main__":
    unittest.main()
