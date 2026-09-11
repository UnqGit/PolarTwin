import copy
import json
import unittest
from pathlib import Path

from twin_sim.behaviors import BehaviorRegistry, GenericBehavior, infer_behaviors
from twin_sim.compiler import compile_model


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase3BehaviorTests(unittest.TestCase):
    def setUp(self):
        self.topology = read_json(ROOT / "examples/minimal/topology.json")
        self.specification = read_json(ROOT / "examples/minimal/specification.json")

    def test_type_inference_attaches_specialized_behaviors(self):
        graph = compile_model(self.topology, self.specification)
        self.assertEqual(graph.get("Generator").behavior.name, "generator")
        self.assertEqual(graph.get("FuelSensor").behavior.name, "sensor")
        self.assertEqual(graph.get("Generator").behavior.level, "specialized")

    def test_unknown_type_uses_generic_behavior_and_diagnostic(self):
        topology = copy.deepcopy(self.topology)
        specification = copy.deepcopy(self.specification)
        topology["children"].append({"name": "QuantumWidget", "type": "quantum_widget", "tags": [], "children": []})
        specification["components"]["QuantumWidget"] = {"type": "quantum_widget", "spec": {"provides": "unknown"}}
        graph = compile_model(topology, specification)
        self.assertIsInstance(graph.get("QuantumWidget").behavior, GenericBehavior)
        self.assertTrue(any("QuantumWidget" in item and "generic fallback" in item for item in graph.diagnostics))

    def test_explicit_behavior_override_has_priority(self):
        specification = copy.deepcopy(self.specification)
        specification["components"]["Generator"]["spec"]["behavior"] = "sensor"
        graph = compile_model(self.topology, specification)
        self.assertEqual(graph.get("Generator").behavior.name, "sensor")

    def test_unknown_explicit_behavior_falls_back_without_crashing(self):
        specification = copy.deepcopy(self.specification)
        specification["components"]["Generator"]["spec"]["behavior"] = "missing_behavior"
        graph = compile_model(self.topology, specification)
        self.assertIsInstance(graph.get("Generator").behavior, GenericBehavior)
        self.assertTrue(any("missing_behavior" in item for item in graph.diagnostics))

    def test_specification_behavior_hint_is_used_after_type_lookup(self):
        topology = copy.deepcopy(self.topology)
        specification = copy.deepcopy(self.specification)
        # Target Generator specifically (children[0] is EnergySystem, children[0][0] is Generator)
        topology["children"][0]["children"][0]["type"] = "unknown_type"
        specification["components"]["Generator"]["type"] = "unknown_type"
        specification["components"]["Generator"]["spec"]["behavior_type"] = "generator"
        graph = compile_model(topology, specification)
        self.assertEqual(graph.get("Generator").behavior.name, "generator")

    def test_custom_registry_behavior_is_supported(self):
        graph = compile_model(self.topology, self.specification)
        registry = BehaviorRegistry()

        class CustomBehavior(GenericBehavior):
            name = "custom"
            level = "specialized"

        registry.register("custom", CustomBehavior)
        graph.get("FuelSensor").specification["behavior"] = "custom"
        resolutions = infer_behaviors(graph, registry)
        self.assertEqual(resolutions["FuelSensor"].source, "explicit")
        self.assertEqual(graph.get("FuelSensor").behavior.name, "custom")


if __name__ == "__main__":
    unittest.main()