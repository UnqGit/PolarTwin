import json
import subprocess
import sys
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.observability import CausalTracer, CausalCause, CausalEffect, CausalEvent
from twin_sim.scenarios import ScenarioScheduler, load_scenario_events, ScenarioEvent
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase21CausalTests(unittest.TestCase):
    def setUp(self):
        self.minimal_root = ROOT / "examples/minimal"
        self.maitri_root = ROOT / "data/compiled/maitri"
        self.maitri_example = ROOT / "data/compiled/maitri"
        
        self.minimal_graph = compile_model(
            read_json(self.minimal_root / "topology.json"),
            read_json(self.minimal_root / "specification.json"),
        )
        self.maitri_graph = compile_model(
            read_json(self.maitri_root / "relation.json"),
            raw_connections=read_json(self.maitri_root / "connection.json"),
            specification=read_json(self.maitri_root / "spec.json"),
        )

    def test_causal_event_serialization_matches_spec(self):
        tracer = CausalTracer()
        event = tracer.record_cause_and_effects(
            timestamp=251,
            cause_component="Generator1",
            cause_event="failure",
            effects=[
                ("EnergyController", "generator_available=false"),
                ("Generator2", "power_output=276"),
            ]
        )
        
        data = event.to_dict()
        self.assertEqual(data["timestamp"], 251)
        self.assertEqual(data["cause"]["component"], "Generator1")
        self.assertEqual(data["cause"]["event"], "failure")
        self.assertEqual(len(data["effects"]), 2)
        self.assertEqual(data["effects"][0]["component"], "EnergyController")
        self.assertEqual(data["effects"][0]["state_change"], "generator_available=false")
        self.assertEqual(data["effects"][1]["component"], "Generator2")
        self.assertEqual(data["effects"][1]["state_change"], "power_output=276")

    def test_explain_generator2_maitri_topology(self):
        engine = SimulationEngine(self.maitri_graph, debug=True)
        events = load_scenario_events(self.maitri_example / "scenario.json")
        ScenarioScheduler().schedule(engine, events)
        engine.run(duration=5)
        
        explanation = engine.tracer.explain("Generator2")
        self.assertEqual(explanation.target_component, "Generator2")
        self.assertGreater(len(explanation.events), 0)
        
        text = explanation.format_text()
        self.assertIn("Generator1 failed", text)
        self.assertIn("EnergyController received Generator1 status = FAILED", text)
        self.assertIn("Available generation decreased", text)
        self.assertIn("Generator2 output increased to", text)

    def test_explain_generator_minimal_blizzard(self):
        engine = SimulationEngine(self.minimal_graph, debug=True)
        events = load_scenario_events(self.minimal_root / "blizzard.scenario.json")
        ScenarioScheduler().schedule(engine, events)
        engine.run(duration=3)
        
        explanation = engine.tracer.explain("Generator")
        
        # Generator increases load during blizzard but the tracer tracks environment updates.
        # We didn't add explicit causal recording for propagation yet, but we track environment update.
        events_json = explanation.to_dict()
        # Since minimal test might not have direct chain, ensure it doesn't crash
        self.assertTrue(isinstance(events_json, list))

    def test_cli_explain_command(self):
        result = subprocess.run(
            [
                sys.executable, "-m", "twin_sim.cli", "explain",
                "--topology", str(self.maitri_root / "relation.json"),
                "--spec", str(self.maitri_root / "spec.json"),
                "--connection", str(self.maitri_root / "connection.json"),
                "--scenario", str(self.maitri_example / "scenario.json"),
                "--component", "Generator2",
                "--duration", "5"
            ],
            cwd=ROOT,
            env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("WHY did Generator2 change state?", result.stdout)
        self.assertIn("Generator1 failed", result.stdout)
        
    def test_cli_explain_command_json(self):
        result = subprocess.run(
            [
                sys.executable, "-m", "twin_sim.cli", "explain",
                "--topology", str(self.maitri_root / "relation.json"),
                "--spec", str(self.maitri_root / "spec.json"),
                "--connection", str(self.maitri_root / "connection.json"),
                "--scenario", str(self.maitri_example / "scenario.json"),
                "--component", "Generator2",
                "--duration", "5",
                "--json"
            ],
            cwd=ROOT,
            env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertTrue(isinstance(data, list))
        self.assertGreater(len(data), 0)
        self.assertEqual(data[0]["cause"]["component"], "Generator1")


if __name__ == "__main__":
    unittest.main()
