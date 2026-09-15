import json
import subprocess
import sys
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.scenarios import ScenarioScheduler, load_scenario_events
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase19MaitriTests(unittest.TestCase):
    def setUp(self):
        twin_root = ROOT / "data/compiled/maitri"
        example_root = ROOT / "data/compiled/maitri"
        self.graph = compile_model(
            read_json(twin_root / "relation.json"),
            read_json(twin_root / "spec.json"),
        )
        self.events = load_scenario_events(example_root / "scenario.json")

    def test_canonical_scenario_runs_without_station_specific_engine_code(self):
        engine = SimulationEngine(
            self.graph,
            seed=42,
            run_id="maitri-test",
            environment={"temperature": -25},
        )
        ScenarioScheduler().schedule(engine, self.events)
        engine.run(duration=6)

        self.assertEqual(len(self.graph.components), 102)
        self.assertEqual(len(engine.telemetry), 102 * 6)
        self.assertAlmostEqual(engine.environment.get("temperature"), -25)
        self.assertEqual(engine.environment.get("connectivity"), 1.0)
        self.assertFalse(self.graph.get("Generator1").runtime_state.available)
        self.assertGreater(self.graph.get("Generator2").runtime_state.values["power_output"], 0)
        self.assertTrue(any(item["effect"] == "backup_generation_increased" for item in engine.causal_trace))

    def test_canonical_cli_run_accepts_real_maitri_inputs(self):
        command = [
            sys.executable,
            "-m",
            "twin_sim.cli",
            "run",
            "--topology",
            "data/compiled/maitri/relation.json",
            "--spec",
            "data/compiled/maitri/spec.json",
            "--scenario",
            "data/compiled/maitri/scenario.json",
            "--duration",
            "1",
            "--seed",
            "42",
            "--run-id",
            "maitri-cli-test",
        ]
        result = subprocess.run(
            command,
            cwd=ROOT,
            env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(result.stdout.splitlines()), 102)


if __name__ == "__main__":
    unittest.main()
