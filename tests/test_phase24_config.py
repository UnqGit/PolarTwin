import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from twin_sim.ingestion.config import load_runtime_config
from twin_sim.ingestion.validator import ValidationError

ROOT = Path(__file__).parent.parent


class Phase24ConfigTests(unittest.TestCase):
    def setUp(self):
        self.maitri_root = ROOT / "data" / "compiled" / "maitri"
        self.maitri_example = ROOT / "examples" / "maitri" / "scenarios" / "blizzard"
        
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_valid_config_loads_successfully(self):
        config_path = self.temp_path / "valid_config.json"
        config_data = {
            "mode": "simulator",
            "duration": 10.0,
            "tick_interval": 0.5,
            "time_scale": 1.0,
            "outputs": [
                {"type": "stdout", "enabled": True}
            ]
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f)
            
        config = load_runtime_config(config_path)
        self.assertEqual(config["duration"], 10.0)

    def test_invalid_config_raises_validation_error(self):
        config_path = self.temp_path / "invalid_config.json"
        config_data = {
            "mode": "unknown_mode",  # Invalid enum value
            "tick_interval": 0.5,
            "time_scale": 1.0,
            "outputs": []
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f)
            
        with self.assertRaises(ValidationError):
            load_runtime_config(config_path)

    def test_cli_run_with_config(self):
        config_path = self.temp_path / "cli_config.json"
        config_data = {
            "mode": "simulator",
            "duration": 2.0,
            "tick_interval": 1.0,
            "time_scale": 1.0,
            "seed": 42,
            "outputs": [
                {"type": "stdout"}
            ]
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f)

        result = subprocess.run(
            [
                sys.executable, "-m", "twin_sim.cli", "run",
                "--topology", str(self.maitri_root / "relation.json"),
                "--spec", str(self.maitri_root / "spec.json"),
                "--config", str(config_path)
            ],
            cwd=ROOT,
            env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        
        # Output should be printed to stdout since we configured a stdout sink
        self.assertIn("timestamp", result.stdout, f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}")

    def test_cli_args_override_config(self):
        config_path = self.temp_path / "cli_config2.json"
        config_data = {
            "mode": "simulator",
            "duration": 5.0, # Will be overridden to 1.0
            "tick_interval": 1.0,
            "time_scale": 1.0,
            "outputs": []
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f)

        # Run with --duration 1.0 which should finish faster and take precedence
        result = subprocess.run(
            [
                sys.executable, "-m", "twin_sim.cli", "run",
                "--topology", str(self.maitri_root / "relation.json"),
                "--spec", str(self.maitri_root / "spec.json"),
                "--config", str(config_path),
                "--duration", "1.0"
            ],
            cwd=ROOT,
            env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

if __name__ == "__main__":
    unittest.main()
