import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.ingestion.validator import ValidationError, validate_topology
from twin_sim.observability import SafetyError, SafetyMonitor
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase22SafetyTests(unittest.TestCase):
    def setUp(self):
        self.minimal_root = ROOT / "examples/minimal"
        self.topology = read_json(self.minimal_root / "topology.json")
        self.connections = read_json(self.minimal_root / "connections.json")
        self.specification = read_json(self.minimal_root / "specification.json")

    def test_negative_fuel_error_raises_exception(self):
        graph = compile_model(self.topology, self.connections, self.specification)
        # Set validation config with error
        engine = SimulationEngine(graph, validation_config={"negative_fuel": "error"})
        
        # Corrupt the fuel explicitly to be negative
        engine.graph.get("Generator").runtime_state.values["fuel_level"] = -10.0
        
        with self.assertRaises(SafetyError) as ctx:
            engine.safety_monitor.evaluate_and_enforce(engine.graph, engine.environment.values)
        self.assertIn("negative_fuel", str(ctx.exception))
        self.assertIn("fuel level -10.0 is less than 0", str(ctx.exception))

    def test_negative_fuel_warning_does_not_raise(self):
        graph = compile_model(self.topology, self.connections, self.specification)
        engine = SimulationEngine(graph, validation_config={"negative_fuel": "warning"})
        
        engine.graph.get("Generator").runtime_state.values["fuel_level"] = -10.0
        
        violations = engine.safety_monitor.evaluate_and_enforce(engine.graph, engine.environment.values)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0].rule, "negative_fuel")

    def test_negative_fuel_ignore_is_silent(self):
        graph = compile_model(self.topology, self.connections, self.specification)
        engine = SimulationEngine(graph, validation_config={"negative_fuel": "ignore"})
        
        engine.graph.get("Generator").runtime_state.values["fuel_level"] = -10.0
        
        violations = engine.safety_monitor.evaluate_and_enforce(engine.graph, engine.environment.values)
        self.assertEqual(len(violations), 0)

    def test_generator_overload_is_detected(self):
        graph = compile_model(self.topology, self.connections, self.specification)
        engine = SimulationEngine(graph, validation_config={"generator_overload": "error"})
        
        engine.graph.get("Generator").runtime_state.values["power_output"] = 5000.0  # rating is 500
        
        with self.assertRaises(SafetyError) as ctx:
            engine.safety_monitor.evaluate_and_enforce(engine.graph, engine.environment.values)
        self.assertIn("generator_overload", str(ctx.exception))

    def test_temperature_out_of_range(self):
        graph = compile_model(self.topology, self.connections, self.specification)
        engine = SimulationEngine(graph, validation_config={"temperature_out_of_range": "error"})
        
        engine.environment.values["temperature"] = -150.0
        
        with self.assertRaises(SafetyError) as ctx:
            engine.safety_monitor.evaluate_and_enforce(engine.graph, engine.environment.values)
        self.assertIn("temperature_out_of_range", str(ctx.exception))
        self.assertIn("-150.0 is out of physical model bounds", str(ctx.exception))

    def test_invalid_connection_error_raises_validation_error(self):
        topology = dict(self.topology)
        connections.append({
            "source": "Generator",
            "target": "DoesNotExist",
            "type": "power",
            "direction": "-->"
        })
        with self.assertRaises(ValidationError) as ctx:
            validate_topology(topology, {"invalid_connection": "error"})
        self.assertIn("references unknown component", str(ctx.exception))

    def test_invalid_connection_warning_suppresses_error(self):
        topology = dict(self.topology)
        connections.append({
            "source": "Generator",
            "target": "DoesNotExist",
            "type": "power",
            "direction": "-->"
        })
        # If set to warning, validate_topology does not raise.
        valid_topology = validate_topology(topology, {"invalid_connection": "warning"})
        self.assertEqual(valid_topology["name"], "MiniStation")

    def test_unknown_sensor_quantity_checked_during_compilation(self):
        spec = dict(self.specification)
        spec["components"]["FuelSensor"]["spec"]["quantity"] = "magic_beans"
        
        with self.assertRaises(SafetyError) as ctx:
            compile_model(self.topology, spec, {"unknown_sensor": "error"})
        self.assertIn("unknown_sensor", str(ctx.exception))
        self.assertIn("magic_beans", str(ctx.exception))

    def test_unknown_sensor_warning_adds_diagnostic(self):
        spec = dict(self.specification)
        spec["components"]["FuelSensor"]["spec"]["quantity"] = "magic_beans"
        
        graph = compile_model(self.topology, spec, {"unknown_sensor": "warning"})
        # Should not raise, but add a diagnostic
        self.assertTrue(any("magic_beans" in diag for diag in graph.diagnostics))


if __name__ == "__main__":
    unittest.main()
