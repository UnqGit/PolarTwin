import json
import subprocess
import sys
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.observability import build_quality_report


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase20QualityTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        self.topology = read_json(root / "topology.json")
        self.connections = read_json(root / "connections.json")
        self.specification = read_json(root / "specification.json")

    def test_report_counts_components_behaviors_and_isolated_nodes(self):
        report = build_quality_report(compile_model(self.topology, raw_connections=self.connections, specification=self.specification))
        self.assertEqual(report.components, 5)
        self.assertEqual(report.connections, 4)
        self.assertEqual(report.specialized_behaviors, 3)  # generator, sensor, controller
        self.assertEqual(report.generic_behaviors, 2)  # station, system
        self.assertEqual(report.unresolved_references, 0)
        self.assertIn("MiniStation", report.unconnected_components)

    def test_report_detects_cycles(self):
        topology = json.loads(json.dumps(self.topology))
        # The enriched topology already has a cycle: Generator→Controller→Generator
        # Adding FuelSensor→Generator creates a bigger SCC
        connections = list(self.connections)
        connections.append({
            "source": "FuelSensor",
            "target": "Generator",
            "type": "feedback",
            "direction": "-->",
        })
        report = build_quality_report(compile_model(topology, self.connections, self.specification))
        # The cycle now includes Controller, FuelSensor, Generator
        self.assertTrue(
            any("Generator" in cycle and "Controller" in cycle for cycle in report.potential_cycles),
            f"expected cycle containing Generator and Controller, got {report.potential_cycles}",
        )

    def test_maitri_report_is_topology_agnostic(self):
        root = ROOT / "data/compiled/maitri"
        report = build_quality_report(compile_model(read_json(root / "relation.json"), read_json(root / "connection.json"), read_json(root / "spec.json")))
        self.assertEqual(report.components, 102)
        self.assertEqual(report.connections, 96)
        self.assertGreater(report.specialized_behaviors, 0)
        self.assertGreater(len(report.diagnostics), 0)

    def test_quality_cli_returns_json_report(self):
        root = ROOT / "examples/minimal"
        result = subprocess.run(
            [sys.executable, "-m", "twin_sim.cli", "quality", "--topology", str(root / "topology.json"), "--spec", str(root / "specification.json")],
            cwd=ROOT,
            env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["components"], 5)


if __name__ == "__main__":
    unittest.main()
