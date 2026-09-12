"""Phase 25: Plugin Architecture and Minimal DSL tests."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest import TestCase

from twin_sim.behaviors.dsl import DslBehavior, DslExecutionError
from twin_sim.model import Component, RuntimeState
from twin_sim.behaviors.base import BehaviorContext
from twin_sim.plugins import load_plugins_from_directory
from twin_sim.behaviors.registry import default_registry, _PLUGIN_BEHAVIORS

ROOT = Path(__file__).parent.parent


class Phase25PluginTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.plugins_dir = Path(self.temp_dir.name) / "plugins"
        self.plugins_dir.mkdir()
        _PLUGIN_BEHAVIORS.clear()

    def tearDown(self):
        self.temp_dir.cleanup()
        _PLUGIN_BEHAVIORS.clear()

    def test_dsl_ast_interpreter_safe_math(self):
        code = """
state.temperature = state.temperature + (input.heat * dt)
if state.temperature > 100:
    state.warning = True
else:
    state.warning = False
"""
        behavior = DslBehavior("test_reactor", code)
        
        comp = Component("r1", "test_reactor", tags={"sensor"}, runtime_state=RuntimeState({"temperature": 50, "inputs": {"heat": 10}}))
        context = BehaviorContext({"environment": {}})
        
        # dt = 2 -> temperature = 50 + (10 * 2) = 70
        props = behavior.evaluate(comp, context, 2.0)
        self.assertEqual(props["temperature"], 70)
        self.assertEqual(props["warning"], False)
        
        # dt = 6 -> temperature = 50 + (10 * 6) = 110
        props = behavior.evaluate(comp, context, 6.0)
        self.assertEqual(props["temperature"], 110)
        self.assertEqual(props["warning"], True)

    def test_dsl_ast_interpreter_rejects_unsafe_code(self):
        code_import = "import os\nstate.x = 1"
        with self.assertRaises(ValueError) as cm:
            DslBehavior("bad", code_import)
        self.assertIn("unsupported syntax node Import", str(cm.exception))

        code_func = "def foo(): pass"
        with self.assertRaises(ValueError) as cm:
            DslBehavior("bad", code_func)
        self.assertIn("unsupported syntax node FunctionDef", str(cm.exception))
        
        code_loop = "while True: pass"
        with self.assertRaises(ValueError) as cm:
            DslBehavior("bad", code_loop)
        self.assertIn("unsupported syntax node While", str(cm.exception))

    def test_dsl_ast_interpreter_rejects_unsafe_assignments(self):
        # Only state.* and locals can be assigned
        code = "env.temperature = 100"
        behavior = DslBehavior("bad", code)
        comp = Component("r1", "test", tags=set(), runtime_state=RuntimeState({}))
        context = BehaviorContext({"environment": {}})
        with self.assertRaises(DslExecutionError) as cm:
            behavior.evaluate(comp, context, 1.0)
        self.assertIn("Can only assign to 'state.*' or local variables", str(cm.exception))

    def test_plugins_loader_registers_behaviors(self):
        plugin_file = self.plugins_dir / "custom_reactor.ptb"
        plugin_file.write_text("state.test = 1", encoding="utf-8")
        
        load_plugins_from_directory(self.plugins_dir)
        
        registry = default_registry()
        self.assertTrue(registry.contains("custom_reactor"))
        
        behavior = registry.create("custom_reactor")
        self.assertIsInstance(behavior, DslBehavior)
        self.assertEqual(behavior.name, "custom_reactor")

    def test_cli_runs_with_custom_plugin(self):
        plugin_file = self.plugins_dir / "my_custom_sensor.ptb"
        plugin_file.write_text("""
base = env.temperature
if input.bias:
    base = base + input.bias
state.reading = base * 2
""", encoding="utf-8")

        topology_file = Path(self.temp_dir.name) / "relation.json"
        topology_file.write_text(json.dumps({
            "name": "TestSys",
            "type": "Network",
            "tags": [],
            "children": [
                {
                    "name": "CustomSensor",
                    "type": "my_custom_sensor", # matches the plugin filename!
                    "tags": [],
                    "children": []
                }
            ],
            "connections": []
        }))

        spec_file = Path(self.temp_dir.name) / "spec.json"
        spec_file.write_text(json.dumps({
            "components": {
                "TestSys": {
                    "type": "Network",
                    "spec": {}
                },
                "CustomSensor": {
                    "type": "my_custom_sensor",
                    "spec": {}
                }
            },
            "defaults": {}
        }))

        # Run via CLI
        result = subprocess.run(
            [
                sys.executable, "-m", "twin_sim.cli", "run",
                "--topology", str(topology_file),
                "--spec", str(spec_file),
                "--plugins", str(self.plugins_dir),
                "--duration", "1.0",
                "--environment", '{"temperature": 25}'
            ],
            cwd=ROOT,
            env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        
        output = result.stdout
        self.assertIn("timestamp", output)
        self.assertIn('"reading":50', output.replace(" ", "")) # 25 * 2 = 50
