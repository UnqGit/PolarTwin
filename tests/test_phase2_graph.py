import copy
import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.ingestion.validator import ValidationError


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase2GraphTests(unittest.TestCase):
    def setUp(self):
        self.topology = read_json(ROOT / "examples/minimal/topology.json")
        self.specification = read_json(ROOT / "examples/minimal/specification.json")

    def test_compiles_containment_and_functional_indexes(self):
        graph = compile_model(self.topology, self.specification)
        self.assertEqual(graph.root.name, "MiniStation")
        self.assertEqual([child.name for child in graph.children_of("MiniStation")], ["Generator", "FuelSensor"])
        self.assertEqual([item.name for item in graph.descendants_of("MiniStation")], ["Generator", "FuelSensor"])
        self.assertEqual(graph.parent_of("Generator").name, "MiniStation")
        self.assertEqual(graph.ancestors_of("Generator")[0].name, "MiniStation")
        self.assertEqual(graph.outgoing("Generator")[0].target, "FuelSensor")
        self.assertEqual(graph.incoming("FuelSensor")[0].source, "Generator")

    def test_compiled_component_has_independent_runtime_state(self):
        graph = compile_model(self.topology, self.specification)
        generator = graph.get("Generator")
        generator.runtime_state.values["power"] = 10
        self.assertNotIn("power", graph.get("FuelSensor").runtime_state.values)
        self.assertEqual(generator.specification["rating"]["unit"], "kW")

    def test_bidirectional_connection_is_indexed_both_ways(self):
        topology = copy.deepcopy(self.topology)
        topology["connections"][0]["direction"] = "<-->"
        graph = compile_model(topology, self.specification)
        self.assertEqual(graph.incoming("Generator")[0].source, "FuelSensor")
        self.assertEqual(graph.outgoing("FuelSensor")[0].target, "Generator")

    def test_orphan_specification_is_diagnostic(self):
        specification = copy.deepcopy(self.specification)
        specification["components"]["Unused"] = {"type": "sensor", "spec": {}}
        graph = compile_model(self.topology, specification)
        self.assertIn("specification component 'Unused' is not present in topology", graph.diagnostics)

    def test_missing_specification_still_fails_before_compilation(self):
        specification = copy.deepcopy(self.specification)
        del specification["components"]["Generator"]
        with self.assertRaises(ValidationError):
            compile_model(self.topology, specification)

    def test_maitri_compiles_without_station_specific_code(self):
        topology = read_json(ROOT / "config/twins/maitri/relation.json")
        specification = read_json(ROOT / "config/twins/maitri/spec.json")
        graph = compile_model(topology, specification)
        self.assertGreater(len(graph.components), 1)
        self.assertEqual(graph.get("Maitri").type, "station")


if __name__ == "__main__":
    unittest.main()