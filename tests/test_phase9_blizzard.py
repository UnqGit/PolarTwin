import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.scenarios import ScenarioEvent, ScenarioScheduler, load_scenario_events
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase9BlizzardTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        self.graph = compile_model(read_json(root / "topology.json"), read_json(root / "specification.json"))
        self.events = load_scenario_events(root / "blizzard.scenario.json")

    def test_blizzard_changes_environment_at_event_time(self):
        engine = SimulationEngine(self.graph, environment={"temperature": 0})
        ScenarioScheduler().schedule(engine, self.events)
        engine.step()
        self.assertEqual(engine.environment.get("temperature"), -15)
        self.assertEqual(engine.environment.get("wind_speed"), 50)
        self.assertAlmostEqual(engine.environment.get("connectivity"), 0.1)
        self.assertEqual(engine.environment.get("heating_demand_multiplier"), 1.7)

    def test_blizzard_increases_generator_load_but_respects_rating(self):
        engine = SimulationEngine(self.graph, environment={"temperature": 0, "heating_demand_multiplier": 0.5})
        ScenarioScheduler().schedule(engine, [ScenarioEvent("blizzard", 2, "blizzard", 2, parameters={"heating_demand_multiplier": 1.7})])
        engine.step()
        generator = self.graph.get("Generator")
        self.assertEqual(generator.runtime_state.values["power_output"], 5)
        engine.step()
        self.assertEqual(generator.runtime_state.values["power_output"], 10)

    def test_blizzard_restores_environment_after_duration(self):
        engine = SimulationEngine(self.graph, environment={"temperature": 0})
        ScenarioScheduler().schedule(engine, self.events)
        engine.step()
        engine.step()
        engine.step()
        self.assertEqual(engine.environment.get("temperature"), 0)
        self.assertEqual(engine.environment.get("wind_speed"), 0.0)
        self.assertEqual(engine.environment.get("connectivity"), 1.0)
        self.assertEqual(engine.environment.get("heating_demand_multiplier"), None)

    def test_blizzard_scenario_is_topology_agnostic(self):
        root = ROOT / "data/compiled/maitri"
        graph = compile_model(read_json(root / "relation.json"), read_json(root / "spec.json"))
        engine = SimulationEngine(graph, environment={"temperature": -25})
        ScenarioScheduler().schedule(engine, self.events)
        engine.step()
        self.assertEqual(engine.environment.get("wind_speed"), 50)


if __name__ == "__main__":
    unittest.main()
