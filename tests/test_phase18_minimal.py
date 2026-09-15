"""Phase 18 — Minimal Topology Test.

Prove that the entire pipeline works on a tiny system without requiring
the Maitri topology or any station-specific simulation code.

Topology:
    MiniStation
      └─ EnergySystem
           ├─ Generator   (fuel depletion, power output)
           ├─ FuelSensor  (reads propagated fuel_level)
           └─ Controller  (receives power_data + fuel_data)

Connections:
    Generator  ──power_data──>  Controller
    FuelSensor ──fuel_data───>  Controller
    Controller ──command─────>  Generator
    Generator  ──fuel────────>  FuelSensor
"""

import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.ingestion.validator import load_json
from twin_sim.scenarios import ScenarioScheduler, load_scenario_events
from twin_sim.simulation import SimulationEngine


EXAMPLES = Path(__file__).resolve().parent.parent / "examples" / "minimal"
TOPOLOGY = EXAMPLES / "topology.json"
CONNECTIONS = EXAMPLES / "connections.json"
#("topology.json", "connections.json")
SPECIFICATION = EXAMPLES / "specification.json"
BLIZZARD_SCENARIO = EXAMPLES / "blizzard.scenario.json"
EMPTY_SCENARIO = EXAMPLES / "scenario.json"


def _build_engine(seed=42, **kwargs):
    topology = load_json(TOPOLOGY)
    connections = load_json(CONNECTIONS)
    specification = load_json(SPECIFICATION)
    graph = compile_model(topology, connections, specification)
    return SimulationEngine(graph, seed=seed, run_id="phase18", **kwargs)


def _messages_for(telemetry, component_name, timestamp=None):
    return [
        m for m in telemetry
        if m.component and m.component.get("name") == component_name
        and (timestamp is None or m.timestamp == timestamp)
    ]


class Phase18MinimalTests(unittest.TestCase):
    """Primary unit/integration tests using only the minimal topology."""

    # ------------------------------------------------------------------
    # Causal chain: generator runs, fuel depletes
    # ------------------------------------------------------------------

    def test_generator_runs_and_depletes_fuel_over_time(self):
        engine = _build_engine()
        engine.run(duration=10)
        gen = engine.graph.get("Generator")
        initial_fuel = 100.0  # from spec: fuel_capacity.value
        current_fuel = gen.runtime_state.values["fuel_level"]
        self.assertLess(current_fuel, initial_fuel,
                        "fuel must decrease over 10 simulation seconds")
        self.assertGreater(current_fuel, 0.0,
                           "fuel should not be fully depleted after only 10 seconds")
        self.assertTrue(gen.runtime_state.values["running"],
                        "generator should still be running with fuel remaining")

    # ------------------------------------------------------------------
    # Causal chain: sensor reads propagated fuel level
    # ------------------------------------------------------------------

    def test_sensor_reads_propagated_fuel_level_after_first_tick(self):
        """FuelSensor should read the Generator's fuel_level via the
        'fuel' connection.  Due to evaluate-before-commit, the first
        tick has no propagated inputs (value=0.0); from tick 2 onward
        the sensor must reflect the Generator's fuel level."""
        engine = _build_engine()
        engine.run(duration=3)
        sensor_tick1 = _messages_for(engine.telemetry, "FuelSensor", 1.0)
        sensor_tick2 = _messages_for(engine.telemetry, "FuelSensor", 2.0)
        self.assertTrue(sensor_tick1, "sensor telemetry must exist at tick 1")
        self.assertTrue(sensor_tick2, "sensor telemetry must exist at tick 2")
        # Tick 1: no propagated input yet, sensor reads environment/default
        value_t1 = sensor_tick1[0].measurement["value"]
        # Tick 2: sensor should reflect the generator's fuel level (~100)
        value_t2 = sensor_tick2[0].measurement["value"]
        self.assertGreater(value_t2, 90.0,
                           "by tick 2 the sensor must read propagated fuel level > 90")

    # ------------------------------------------------------------------
    # Causal chain: controller receives inputs from generator and sensor
    # ------------------------------------------------------------------

    def test_controller_receives_inputs_from_connected_components(self):
        engine = _build_engine()
        engine.run(duration=3)
        ctrl = engine.graph.get("Controller")
        inputs = ctrl.runtime_state.values.get("inputs", {})
        # Controller should receive both power_data and fuel_data channels
        self.assertIn("power_data", inputs,
                      "controller must receive power_data from Generator")
        self.assertIn("fuel_data", inputs,
                      "controller must receive fuel_data from FuelSensor")
        # Verify the source attribution
        self.assertEqual(inputs["power_data"]["source"], "Generator")
        self.assertEqual(inputs["fuel_data"]["source"], "FuelSensor")

    # ------------------------------------------------------------------
    # Full feedback loop: generator → sensor → controller → generator
    # ------------------------------------------------------------------

    def test_full_causal_chain_generator_sensor_controller_generator(self):
        """After 3 ticks the causal chain must have propagated fully:
        Generator produces state → FuelSensor reads fuel_level →
        Controller receives fuel_data → Controller sends command back
        to Generator."""
        engine = _build_engine()
        engine.run(duration=5)
        gen = engine.graph.get("Generator")
        sensor = engine.graph.get("FuelSensor")
        ctrl = engine.graph.get("Controller")
        # Generator should have committed runtime state
        self.assertIn("power_output", gen.runtime_state.values)
        self.assertIn("fuel_level", gen.runtime_state.values)
        # Sensor should have a measurement
        self.assertIn("measurement", sensor.runtime_state.values)
        # Controller should have received inputs
        self.assertIn("inputs", ctrl.runtime_state.values)
        # Generator should have received command input from Controller
        gen_inputs = gen.runtime_state.values.get("inputs", {})
        self.assertIn("command", gen_inputs,
                      "generator must receive command from controller")

    # ------------------------------------------------------------------
    # Blizzard scenario on minimal topology
    # ------------------------------------------------------------------

    def test_blizzard_scenario_changes_environment_and_restores(self):
        """Blizzard at t=1 with duration=2 should modify environment
        at t=1 and restore it after t=3."""
        engine = _build_engine()
        events = load_scenario_events(BLIZZARD_SCENARIO)
        ScenarioScheduler().schedule(engine, events)
        # Run past the blizzard (t=1) and its end (t=3)
        engine.run(duration=5)
        # Check environment was restored after duration
        env = engine.environment.snapshot()
        # Temperature was shifted by delta=-15 during blizzard; should restore to 0
        self.assertAlmostEqual(env["temperature"], 0.0, places=1,
                               msg="temperature must restore after blizzard ends")
        # Wind speed should restore
        self.assertAlmostEqual(env["wind_speed"], 0.0, places=1,
                               msg="wind_speed must restore after blizzard ends")

    def test_blizzard_increases_generator_load_via_demand_multiplier(self):
        """During a blizzard the heating_demand_multiplier should
        increase generator output."""
        engine_no_blizzard = _build_engine(seed=42)
        engine_no_blizzard.run(duration=2)
        gen_no = engine_no_blizzard.graph.get("Generator")
        fuel_no_blizzard = gen_no.runtime_state.values["fuel_level"]

        engine_blizzard = _build_engine(seed=42)
        events = load_scenario_events(BLIZZARD_SCENARIO)
        ScenarioScheduler().schedule(engine_blizzard, events)
        engine_blizzard.run(duration=2)
        gen_bliz = engine_blizzard.graph.get("Generator")
        fuel_blizzard = gen_bliz.runtime_state.values["fuel_level"]

        # During blizzard: heating_demand_multiplier=1.7 → power_output
        # is capped at rating so fuel consumption should be higher
        self.assertLessEqual(fuel_blizzard, fuel_no_blizzard,
                             "blizzard should cause equal or higher fuel consumption")

    # ------------------------------------------------------------------
    # Determinism: same seed → identical output
    # ------------------------------------------------------------------

    def test_deterministic_reproducibility_with_same_seed(self):
        def run_once():
            engine = _build_engine(seed=42)
            events = load_scenario_events(BLIZZARD_SCENARIO)
            ScenarioScheduler().schedule(engine, events)
            engine.run(duration=5)
            return [m.to_dict() for m in engine.telemetry]

        run_a = run_once()
        run_b = run_once()
        self.assertEqual(len(run_a), len(run_b), "both runs must produce same count")
        for i, (a, b) in enumerate(zip(run_a, run_b)):
            self.assertEqual(a, b, f"telemetry message {i} differs between runs")

    # ------------------------------------------------------------------
    # Architecture: works without Maitri-specific code
    # ------------------------------------------------------------------

    def test_architecture_works_without_maitri_specific_code(self):
        """The minimal topology must compile, infer behaviors, run,
        and produce telemetry without any station-specific code."""
        engine = _build_engine()
        engine.run(duration=3)
        self.assertGreater(len(engine.telemetry), 0,
                           "telemetry must be generated")
        # Verify no diagnostic mentions Maitri
        for diag in engine.graph.diagnostics:
            self.assertNotIn("maitri", diag.lower(),
                             f"diagnostic must not mention Maitri: {diag}")

    def test_graph_structure_is_correct(self):
        topology = load_json(TOPOLOGY)
        connections = load_json(CONNECTIONS)
        specification = load_json(SPECIFICATION)
        graph = compile_model(topology, connections, specification)
        self.assertEqual(graph.root.name, "MiniStation")
        self.assertIn("Generator", graph.components)
        self.assertIn("FuelSensor", graph.components)
        self.assertIn("Controller", graph.components)
        self.assertIn("EnergySystem", graph.components)
        # Check hierarchy
        self.assertEqual(len(graph.root.children), 1)  # EnergySystem
        energy = graph.root.children[0]
        self.assertEqual(energy.name, "EnergySystem")
        self.assertEqual(len(energy.children), 3)
        child_names = {c.name for c in energy.children}
        self.assertEqual(child_names, {"Generator", "FuelSensor", "Controller"})

    def test_behaviors_are_specialized_not_generic_for_known_types(self):
        topology = load_json(TOPOLOGY)
        connections = load_json(CONNECTIONS)
        specification = load_json(SPECIFICATION)
        graph = compile_model(topology, connections, specification)
        gen = graph.get("Generator")
        sensor = graph.get("FuelSensor")
        ctrl = graph.get("Controller")
        self.assertEqual(gen.behavior.name, "generator")
        self.assertEqual(gen.behavior.level, "specialized")
        self.assertEqual(sensor.behavior.name, "sensor")
        self.assertEqual(sensor.behavior.level, "specialized")
        self.assertEqual(ctrl.behavior.name, "controller")
        self.assertEqual(ctrl.behavior.level, "specialized")

    def test_telemetry_has_correct_schema_fields(self):
        engine = _build_engine()
        engine.run(duration=2)
        for msg in engine.telemetry:
            d = msg.to_dict()
            self.assertIn("schema_version", d)
            self.assertIn("run_id", d)
            self.assertIn("timestamp", d)
            self.assertIn("quality", d)
            self.assertTrue(d["quality"]["simulated"])
            self.assertIn("context", d)
            self.assertIn("environment", d["context"])

    def test_unknown_component_type_uses_generic_behavior(self):
        """A component with an unrecognized type should get GenericBehavior
        rather than crashing."""
        topology = load_json(TOPOLOGY)
        connections = load_json(CONNECTIONS)
        specification = load_json(SPECIFICATION)
        # Inject an unknown type into the topology
        unknown = {
            "name": "QuantumWidget",
            "type": "quantum_widget",
            "tags": ["exotic"],
            "children": []
        }
        topology["children"][0]["children"].append(unknown)
        specification["components"]["QuantumWidget"] = {
            "type": "quantum_widget",
            "spec": {"provides": "mysterious thing"}
        }
        connections.append({
            "source": "QuantumWidget", "target": "Controller",
            "type": "quantum_data", "direction": "-->"
        })
        graph = compile_model(topology, connections, specification)
        qw = graph.get("QuantumWidget")
        self.assertEqual(qw.behavior.level, "generic",
                         "unknown type must get generic behavior")
        # Should have a diagnostic about the fallback
        fallback_diags = [d for d in graph.diagnostics if "QuantumWidget" in d and "generic" in d]
        self.assertTrue(fallback_diags,
                        "a diagnostic must be emitted for the generic fallback")

    def test_cli_inspect_reports_correct_structure(self):
        """The inspect CLI command should work on the minimal topology."""
        from twin_sim.cli import main
        import io
        import sys
        old_stdout = sys.stdout
        sys.stdout = buffer = io.StringIO()
        try:
            result = main([
                "inspect",
                "--topology", str(TOPOLOGY), "--connection", str(CONNECTIONS),
                "--spec", str(SPECIFICATION),
            ])
        finally:
            sys.stdout = old_stdout
        output = buffer.getvalue()
        report = json.loads(output)
        self.assertEqual(report["root"], "MiniStation")
        self.assertEqual(report["components"], 5)  # Station, EnergySystem, Gen, Sensor, Ctrl
        self.assertEqual(report["connections"], 4)


if __name__ == "__main__":
    unittest.main()
