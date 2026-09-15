import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


class Phase17CliTests(unittest.TestCase):
    def run_cli(self, *arguments):
        environment = {"PYTHONPATH": str(ROOT / "src")}
        result = subprocess.run(
            [PYTHON, "-m", "twin_sim.cli", *arguments],
            cwd=ROOT,
            env={**__import__("os").environ, **environment},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def setUp(self):
        self.root = ROOT / "examples/minimal"

    def test_validate_and_inspect(self):
        output = self.run_cli("validate", "--topology", str(self.root / "topology.json"), "--spec", str(self.root / "specification.json"))
        self.assertEqual(output.strip(), "VALID")
        report = json.loads(self.run_cli("inspect", "--topology", str(self.root / "topology.json"), "--spec", str(self.root / "specification.json")))
        self.assertEqual(report["components"], 5)

    def test_graph_and_run_output(self):
        graph_output = self.run_cli("graph", "--topology", str(self.root / "topology.json"), "--connection", str(self.root / "connections.json"), "--spec", str(self.root / "specification.json"))
        self.assertIn("Generator-->FuelSensor@fuel", graph_output)
        output = self.run_cli("run", "--topology", str(self.root / "topology.json"), "--spec", str(self.root / "specification.json"), "--duration", "1")
        self.assertEqual(len(output.strip().splitlines()), 5)

    def test_validate_simulation(self):
        output = self.run_cli("validate-simulation", "--topology", str(self.root / "topology.json"), "--spec", str(self.root / "specification.json"), "--scenario", str(self.root / "blizzard.scenario.json"))
        self.assertTrue(json.loads(output)["valid"])


if __name__ == "__main__":
    unittest.main()