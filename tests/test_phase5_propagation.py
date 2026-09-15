import copy
import json
import unittest
from pathlib import Path

from twin_sim.behaviors import Behavior, BehaviorContext
from twin_sim.compiler import compile_model
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class SourceBehavior(Behavior):
    name = "source"
    level = "specialized"

    def evaluate(self, component, context: BehaviorContext, dt):
        return {"signal": 10}


class ControllerBehavior(Behavior):
    name = "test_controller"
    level = "specialized"

    def evaluate(self, component, context: BehaviorContext, dt):
        input_channel = context.values["inputs"].get("fuel")
        if input_channel is None:
            return {}
        signal = input_channel["values"]["signal"]
        return {"command": signal * 2}


class Phase5PropagationTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        topology = read_json(root / "topology.json")
        connections = read_json(root / "connections.json")
        specification = read_json(root / "specification.json")
        self.graph = compile_model(topology, connections, specification)
        self.graph.get("Generator").behavior = SourceBehavior()
        self.graph.get("FuelSensor").behavior = ControllerBehavior()

    def test_propagation_is_visible_on_next_evaluation(self):
        engine = SimulationEngine(self.graph)
        engine.step()
        self.assertEqual(self.graph.get("FuelSensor").runtime_state.values["inputs"]["fuel"]["values"]["signal"], 10)
        self.assertNotIn("command", self.graph.get("FuelSensor").runtime_state.values)
        engine.step()
        self.assertEqual(self.graph.get("FuelSensor").runtime_state.values["command"], 20)

    def test_tick_has_explicit_deterministic_phase_order(self):
        engine = SimulationEngine(self.graph)
        engine.step()
        self.assertEqual(engine.last_phase_order, ["events", "environment", "evaluation", "propagation", "commit"])

    def test_propagation_uses_proposals_not_mutated_source_state(self):
        engine = SimulationEngine(self.graph)
        engine.step()
        self.graph.get("Generator").runtime_state.values["signal"] = 999
        self.assertEqual(self.graph.get("FuelSensor").runtime_state.values["inputs"]["fuel"]["values"]["signal"], 10)

    def test_bidirectional_propagation_updates_both_endpoints(self):
        topology = read_json(ROOT / "examples/minimal/topology.json")
        connections = read_json(ROOT / "examples/minimal/connections.json")
        connections[0]["direction"] = "<-->"
        specification = read_json(ROOT / "examples/minimal/specification.json")
        graph = compile_model(topology, connections, specification)
        graph.get("Generator").behavior = SourceBehavior()
        graph.get("FuelSensor").behavior = ControllerBehavior()
        SimulationEngine(graph).step()
        self.assertIn("inputs", graph.get("Generator").runtime_state.values)
        self.assertIn("inputs", graph.get("FuelSensor").runtime_state.values)


if __name__ == "__main__":
    unittest.main()