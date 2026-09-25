import unittest
from twin_sim.dsl.semantics import evaluate_node, apply_set, SemanticError
from twin_sim.ingestion.models import RuntimeComponent, RuntimeConnection

class TestSemantics(unittest.TestCase):
    
    def setUp(self):
        self.state = {
            "components": [
                RuntimeComponent(name="Gen1", type="generator", is_backup=False, status="active", value={"temperature": 25.0}),
                RuntimeComponent(name="Gen2", type="generator", is_backup=True, status="inactive", value={"temperature": 15.0}),
                RuntimeComponent(name="MainController", type="controller", is_backup=False, status="active", value={})
            ],
            "connections": [
                RuntimeConnection(source="Gen1", target="Gen2", type="data", status="active"),
                RuntimeConnection(source="MainController", target="Gen1", type="signal", status="active")
            ]
        }
        
    def test_evaluate_basic_fields(self):
        gen1 = self.state["components"][0]
        gen2 = self.state["components"][1]
        
        self.assertTrue(evaluate_node(gen1, ["value.temperature>20.0"], self.state))
        self.assertFalse(evaluate_node(gen2, ["value.temperature>20.0"], self.state))
        self.assertTrue(evaluate_node(gen2, ["is_backup=true"], self.state))
        self.assertFalse(evaluate_node(gen1, ["is_backup=true"], self.state))

    def test_evaluate_connection_refs_from_component(self):
        gen1 = self.state["components"][0]
        gen2 = self.state["components"][1]
        
        # Generator 1 has a 'data' connection originating from it
        self.assertTrue(evaluate_node(gen1, ["@connection(@node|data|)"], self.state))
        # Generator 2 does not have a data connection originating from it
        self.assertFalse(evaluate_node(gen2, ["@connection(@node|data|)"], self.state))
        
        # Generator 1 receives a signal connection from MainController
        self.assertTrue(evaluate_node(gen1, ["@connection(MainController||@node)"], self.state))

    def test_evaluate_component_refs_from_connection(self):
        conn = self.state["connections"][1] # MainController -> Gen1
        
        # source is type=controller
        self.assertTrue(evaluate_node(conn, ["@component(source).type=controller"], self.state))
        # target is type=generator
        self.assertTrue(evaluate_node(conn, ["@component(target).type=generator"], self.state))
        # combined
        self.assertTrue(evaluate_node(conn, [
            "@component(source).type=controller",
            "type=signal",
            "@component(target).type=generator"
        ], self.state))

    def test_apply_set_payload(self):
        gen1 = RuntimeComponent(name="Gen1", type="generator", is_backup=False, status="active", value={"voltage": {"output": 100}})
        
        fixed_sets = {"status": "failure", "value.voltage.output": 120}
        payload = {"value": {"temperature": 80}}
        
        apply_set(gen1, fixed_sets, payload, set_allowed=["value"], set_fields_allowed=False)
        
        self.assertEqual(gen1.status, "failure")
        self.assertEqual(gen1.value["voltage"]["output"], 120)
        self.assertEqual(gen1.value["temperature"], 80)
        
    def test_apply_set_immutable(self):
        gen1 = RuntimeComponent(name="Gen1", type="generator", is_backup=False, status="active", value={})
        
        with self.assertRaisesRegex(SemanticError, "is_backup is immutable"):
            apply_set(gen1, {"is_backup": True}, {}, [], False)
            
    def test_apply_set_restricted(self):
        gen1 = RuntimeComponent(name="Gen1", type="generator", is_backup=False, status="active", value={})
        
        with self.assertRaisesRegex(SemanticError, "Field 'status' is not allowed"):
            apply_set(gen1, {}, {"status": "failure"}, set_allowed=["value"], set_fields_allowed=False)

if __name__ == "__main__":
    unittest.main()
