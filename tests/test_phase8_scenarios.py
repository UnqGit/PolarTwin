import json
import tempfile
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.scenarios import ScenarioEvent, ScenarioScheduler, load_scenario_events
from twin_sim.simulation import SimulationEngine
from twin_sim.ingestion.validator import ValidationError


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase8ScenarioTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        self.graph = compile_model(read_json(root / "topology.json"), read_json(Path(str(root / "topology.json").replace("topology.json", "connections.json"))), read_json(root / "specification.json"))

    def test_loader_sorts_events_and_rejects_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "scenario.json"
            path.write_text(json.dumps({"name": "test", "events": [
                {"id": "late", "timestamp": 2, "event": "temperature_change", "parameters": {"temperature": -10}},
                {"id": "early", "timestamp": 1, "event": "temperature_change", "parameters": {"temperature": -5}},
            ]}), encoding="utf-8")
            events = load_scenario_events(path)
        self.assertEqual([event.id for event in events], ["early", "late"])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "scenario.json"
            path.write_text(json.dumps({"events": [{"id": "same", "timestamp": 1, "event": "blizzard"}, {"id": "same", "timestamp": 2, "event": "blizzard"}]}), encoding="utf-8")
            with self.assertRaises(ValidationError):
                load_scenario_events(path)

    def test_temperature_event_runs_at_simulation_timestamp(self):
        engine = SimulationEngine(self.graph, environment={"temperature": 0})
        ScenarioScheduler().schedule(engine, [ScenarioEvent("cold", 2, "temperature_change", parameters={"temperature": -20})])
        engine.step()
        self.assertEqual(engine.environment.get("temperature"), 0)
        engine.step()
        self.assertEqual(engine.environment.get("temperature"), -20)

    def test_duration_restores_environment(self):
        engine = SimulationEngine(self.graph, environment={"temperature": 0})
        ScenarioScheduler().schedule(engine, [ScenarioEvent("storm", 1, "temperature_change", 2, parameters={"temperature": -30})])
        engine.step()
        self.assertEqual(engine.environment.get("temperature"), -30)
        engine.step()
        engine.step()
        self.assertEqual(engine.environment.get("temperature"), 0)

    def test_failure_and_repair_change_component_availability(self):
        engine = SimulationEngine(self.graph)
        ScenarioScheduler().schedule(engine, [
            ScenarioEvent("fail", 1, "component_failure", target="Generator"),
            ScenarioEvent("repair", 2, "component_repair", target="Generator"),
        ])
        engine.step()
        self.assertFalse(self.graph.get("Generator").runtime_state.available)
        engine.step()
        self.assertTrue(self.graph.get("Generator").runtime_state.available)

    def test_unknown_target_fails_at_event_application(self):
        engine = SimulationEngine(self.graph)
        ScenarioScheduler().schedule(engine, [ScenarioEvent("bad", 1, "component_failure", target="Missing")])
        with self.assertRaises(ValueError):
            engine.step()


if __name__ == "__main__":
    unittest.main()