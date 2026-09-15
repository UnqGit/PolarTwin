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
        self.connections = read_json(ROOT / "examples/minimal/connections.json")
        self.specification = read_json(ROOT / "examples/minimal/specification.json")

    def test_compiles_containment_and_functional_indexes(self):
        graph = compile_model(self.topology, self.connections, self.specification)
        self.assertEqual(graph.root.name, "MiniStation")
        # MiniStation -> EnergySystem -> {Generator, FuelSensor, Controller}
        self.assertEqual([child.name for child in graph.children_of("MiniStation")], ["EnergySystem"])
        descendant_names = sorted(item.name for item in graph.descendants_of("MiniStation"))
        self.assertEqual(descendant_names, ["Controller", "EnergySystem", "FuelSensor", "Generator"])
        self.assertEqual(graph.parent_of("Generator").name, "EnergySystem")
        ancestor_names = [item.name for item in graph.ancestors_of("Generator")]
        self.assertEqual(ancestor_names, ["EnergySystem", "MiniStation"])
        # Generator has outgoing connections to Controller and FuelSensor
        outgoing_targets = sorted(c.target for c in graph.outgoing("Generator"))
        self.assertIn("FuelSensor", outgoing_targets)
        self.assertIn("Controller", outgoing_targets)
        self.assertTrue(any(c.source == "Generator" for c in graph.incoming("FuelSensor")))

    def test_compiled_component_has_independent_runtime_state(self):
        graph = compile_model(self.topology, self.connections, self.specification)
        generator = graph.get("Generator")
        generator.runtime_state.values["power"] = 10
        self.assertNotIn("power", graph.get("FuelSensor").runtime_state.values)
        self.assertEqual(generator.specification["rating"]["unit"], "kW")

    def test_bidirectional_connection_is_indexed_both_ways(self):
        topology = copy.deepcopy(self.topology)
        connections = copy.deepcopy(self.connections)
        # Make the fuel connection (Generator->FuelSensor) bidirectional
        for conn in connections:
            if conn["source"] == "Generator" and conn["target"] == "FuelSensor":
                conn["direction"] = "<-->"
                break
        graph = compile_model(topology, connections, self.specification)
        # Bidirectional should create reverse indexing
        self.assertTrue(any(c.source == "FuelSensor" and c.target == "Generator" for c in graph.incoming("Generator")))
        self.assertTrue(any(c.target == "Generator" for c in graph.outgoing("FuelSensor")))

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
        topology = read_json(ROOT / "data/compiled/maitri/relation.json")
        connections = read_json(ROOT / "data/compiled/maitri/connection.json")
        specification = read_json(ROOT / "data/compiled/maitri/spec.json")
        graph = compile_model(topology, connections, specification)
        self.assertGreater(len(graph.components), 1)
        self.assertEqual(graph.get("Maitri").type, "station")


if __name__ == "__main__":
    unittest.main()
