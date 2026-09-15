import copy
import json
import unittest
from pathlib import Path

from twin_sim.ingestion.loaders import load_model_inputs
from twin_sim.ingestion.validator import ValidationError, validate_documents, validate_topology


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase1ContractTests(unittest.TestCase):
    def setUp(self):
        self.topology = read_json(ROOT / "examples/minimal/topology.json")
        self.specification = read_json(ROOT / "examples/minimal/specification.json")

    def test_minimal_inputs_validate_and_preserve_unknown_fields(self):
        topology, specification = validate_documents(self.topology, self.specification)
        self.assertEqual(topology["name"], "MiniStation")
        self.assertTrue(specification["components"]["MiniStation"]["spec"]["future_field"]["enabled"])

    def test_existing_twins_validate(self):
        for twin in ("bharati", "maitri"):
            with self.subTest(twin=twin):
                load_model_inputs(ROOT / f"data/compiled/{twin}/relation.json", ROOT / f"data/compiled/{twin}/spec.json")

    def test_unknown_connection_reference_is_rejected(self):
        invalid = copy.deepcopy(self.topology)
        invalid["connections"][0]["target"] = "Missing"
        with self.assertRaisesRegex(ValidationError, "unknown component 'Missing'"):
            validate_topology(invalid)

    def test_duplicate_component_name_is_rejected(self):
        invalid = copy.deepcopy(self.topology)
        # FuelSensor is children[0].children[1] in the nested hierarchy
        invalid["children"][0]["children"][1]["name"] = "Generator"
        with self.assertRaisesRegex(ValidationError, "duplicate component name"):
            validate_topology(invalid)

    def test_invalid_direction_is_rejected(self):
        invalid = copy.deepcopy(self.topology)
        invalid["connections"][0]["direction"] = "invalid"
        with self.assertRaisesRegex(ValidationError, "direction"):
            validate_topology(invalid)

    def test_specification_type_mismatch_is_rejected(self):
        invalid = copy.deepcopy(self.specification)
        invalid["components"]["Generator"]["type"] = "battery"
        with self.assertRaisesRegex(ValidationError, "type mismatch"):
            validate_documents(self.topology, invalid)


if __name__ == "__main__":
    unittest.main()
