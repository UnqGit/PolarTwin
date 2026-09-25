"""
test_engine_core.py — Comprehensive tests for Phases 12-15 (SimulationEngineCore).

Tests cover:
- Phase 11: Tick timing, telemetry sampling
- Phase 12: Backup logic (explicit scene-imposed inactive protection), controller,
            hierarchical status propagation
- Phase 13: Failure model (toff formula, countdown, cancellation)
- Phase 14: Multi-supply power allocation (35% cutoff, proportional, priority shutdown)
- Phase 15: Per-component behaviours (generator temperature, pump, solar panel,
            tank, antenna, server, alarm, AC, vent, container, station)
"""

import math
import unittest

from twin_sim.simulation.engine_core import (
    SimulationEngineCore, HierarchyGraph, ConnectionGraph, HierarchyNode
)
from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.dsl.models import SceneEvent
from twin_sim.ingestion.models import (
    RuntimeComponent, RuntimeConnection, ExternalModel, WeatherModel, NetworkModel
)
import twin_sim.simulation.behaviors as behaviors


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_external(temperature: float = -10.0) -> ExternalModel:
    return ExternalModel(
        weather=WeatherModel(
            temperature=temperature, wind_speed=5.0, humidity=50,
            o2_level=21, co2_level=0, wind_direction=180,
            visibility=1000, pressure=1000, dew_frost_point=-15
        ),
        network=NetworkModel(
            bandwidth=100, mainland_connectivity=True, upload_window=False,
            upload_speed=10, download_speed=10
        ),
        supplies=[]
    )


def make_comp(name, comp_type, status="active", is_backup=False, **value_overrides):
    """Build a minimal RuntimeComponent."""
    value = {
        "temperature": {"value": 20.0, "min": -20.0, "max": 120.0},
        "power": {"value": 0.0, "min": 0.0, "max": 1000.0},
    }
    value.update(value_overrides)
    return RuntimeComponent(name=name, type=comp_type, is_backup=is_backup,
                            status=status, value=value)


def make_conn(source, target, conn_type="power", status="active"):
    return RuntimeConnection(source=source, target=target, type=conn_type, status=status)


def make_state(comps, conns=None, ext=None):
    if ext is None:
        ext = make_external()
    if conns is None:
        conns = []
    return TimelineStateManager(components=comps, connections=conns, external=ext)


def flat_hierarchy(entries):
    """Build HierarchyGraph from a list of dicts."""
    return HierarchyGraph(entries)


# ---------------------------------------------------------------------------
# Phase 11 — Tick timing and telemetry
# ---------------------------------------------------------------------------

class TestTickTiming(unittest.TestCase):

    def setUp(self):
        self.state = make_state([make_comp("Gen1", "generator")])

    def test_initial_time_is_zero(self):
        engine = SimulationEngineCore(self.state, [])
        self.assertEqual(engine.time, 0.0)

    def test_single_tick_advances_by_15_seconds(self):
        engine = SimulationEngineCore(self.state, [])
        engine.run_tick()
        expected = 15.0 / 3600.0
        self.assertAlmostEqual(engine.time, expected, places=10)

    def test_one_hour_is_240_ticks(self):
        engine = SimulationEngineCore(self.state, [])
        engine.run_duration(1.0)
        self.assertAlmostEqual(engine.time, 1.0, places=6)

    def test_telemetry_not_published_by_default(self):
        engine = SimulationEngineCore(self.state, [])
        engine.run_duration(1.0)
        self.assertEqual(len(engine.telemetry), 0)

    def test_telemetry_one_record_per_tick_when_enabled(self):
        engine = SimulationEngineCore(self.state, [])
        engine.telemetry_publishing = True
        engine.run_duration(1.0)  # 240 ticks
        self.assertEqual(len(engine.telemetry), 240)

    def test_telemetry_record_has_required_fields(self):
        engine = SimulationEngineCore(self.state, [])
        engine.telemetry_publishing = True
        engine.run_tick()
        record = engine.telemetry[0]
        self.assertIn("time", record)
        self.assertIn("persistence_time", record)
        self.assertIn("source", record)
        self.assertEqual(record["source"], "SIMULATION")
        self.assertIn("components", record)
        self.assertIn("connections", record)
        self.assertIn("external", record)


# ---------------------------------------------------------------------------
# Phase 12 — Backup logic
# ---------------------------------------------------------------------------

class TestBackupLogic(unittest.TestCase):

    def _make_backup_setup(self, with_hierarchy=False):
        gen = make_comp("Gen1", "generator", status="active", is_backup=False)
        bkp = make_comp("GenBackup", "generator", status="inactive", is_backup=True)

        hier = None
        if with_hierarchy:
            hier = flat_hierarchy([
                {"name": "Gen1", "type": "generator", "parent": None, "children": [],
                 "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
                {"name": "GenBackup", "type": "generator", "parent": None, "children": [],
                 "priority": 1, "floor": 0, "is_backup": True, "backup": ["Gen1"],
                 "external_field": None, "tags": []},
            ])

        state = make_state([gen, bkp])
        return state, hier

    def test_backup_stays_inactive_while_primary_active(self):
        state, hier = self._make_backup_setup(with_hierarchy=True)
        engine = SimulationEngineCore(state, [], hierarchy=hier)
        engine.run_tick()
        bkp = engine.state.base_components["GenBackup"]
        self.assertEqual(bkp.status, "inactive")

    def test_backup_activates_when_primary_fails(self):
        state, hier = self._make_backup_setup(with_hierarchy=True)
        scene = SceneEvent(event_ref="fail", selector="@Gen1", at=0.0,
                           duration=float("inf"), payload={"status": "failure"})
        engine = SimulationEngineCore(state, [scene], hierarchy=hier)
        engine.run_tick()
        bkp = engine.state.base_components["GenBackup"]
        self.assertEqual(bkp.status, "active")

    def test_backup_activates_when_primary_inactive(self):
        state, hier = self._make_backup_setup(with_hierarchy=True)
        scene = SceneEvent(event_ref="shutdown", selector="@Gen1", at=0.0,
                           duration=float("inf"), payload={"status": "inactive"})
        engine = SimulationEngineCore(state, [scene], hierarchy=hier)
        engine.run_tick()
        bkp = engine.state.base_components["GenBackup"]
        self.assertEqual(bkp.status, "active")

    def test_explicit_scene_inactive_prevents_auto_activation(self):
        """Backup whose inactive state was explicitly imposed by a scene must not be auto-activated."""
        gen = make_comp("Gen1", "generator", status="active", is_backup=False)
        bkp = make_comp("GenBackup", "generator", status="inactive", is_backup=True)

        hier = flat_hierarchy([
            {"name": "Gen1", "type": "generator", "parent": None, "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "GenBackup", "type": "generator", "parent": None, "children": [],
             "priority": 1, "floor": 0, "is_backup": True, "backup": ["Gen1"],
             "external_field": None, "tags": []},
        ])

        # Scene: force backup to inactive, AND fail primary — backup must NOT activate
        s1 = SceneEvent(event_ref="force_bkp_inactive", selector="@GenBackup", at=0.0,
                        duration=float("inf"), payload={"status": "inactive"})
        s2 = SceneEvent(event_ref="fail_primary", selector="@Gen1", at=0.0,
                        duration=float("inf"), payload={"status": "failure"})

        state = make_state([gen, bkp])
        engine = SimulationEngineCore(state, [s1, s2], hierarchy=hier)
        engine.run_tick()
        bkp_comp = engine.state.base_components["GenBackup"]
        self.assertEqual(bkp_comp.status, "inactive",
                         "Backup explicitly set to inactive by scene must NOT be auto-activated")


# ---------------------------------------------------------------------------
# Phase 12 — Hierarchical status propagation
# ---------------------------------------------------------------------------

class TestHierarchicalStatusPropagation(unittest.TestCase):

    def test_inactive_parent_propagates_to_children_without_mutation(self):
        parent = make_comp("Block1", "block", status="inactive")
        child = make_comp("Gen1", "generator", status="active")

        hier = flat_hierarchy([
            {"name": "Block1", "type": "block", "parent": None, "children": ["Gen1"],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "Gen1", "type": "generator", "parent": "Block1", "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
        ])

        state = make_state([parent, child])
        engine = SimulationEngineCore(state, [], hierarchy=hier)

        # Engine should treat Gen1 as effectively down because Block1 is inactive.
        eff_status = {"Block1": "inactive", "Gen1": "active"}
        result = engine._component_is_effectively_down("Gen1", eff_status)
        self.assertTrue(result)

    def test_active_parent_does_not_propagate_down(self):
        parent = make_comp("Block1", "block", status="active")
        child = make_comp("Gen1", "generator", status="active")

        hier = flat_hierarchy([
            {"name": "Block1", "type": "block", "parent": None, "children": ["Gen1"],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "Gen1", "type": "generator", "parent": "Block1", "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
        ])

        state = make_state([parent, child])
        engine = SimulationEngineCore(state, [], hierarchy=hier)

        eff_status = {"Block1": "active", "Gen1": "active"}
        result = engine._component_is_effectively_down("Gen1", eff_status)
        self.assertFalse(result)


# ---------------------------------------------------------------------------
# Phase 13 — General failure model
# ---------------------------------------------------------------------------

class TestFailureModel(unittest.TestCase):

    def test_failure_countdown_formula(self):
        """toff = 1 - 3ac^2 + 2ac^3"""
        # At ac=0 (just at max_rating): toff = 1
        self.assertAlmostEqual(behaviors.calculate_failure_countdown(100.0, 100.0, 110.0), 1.0)
        # At ac=1 (at max_tolerated): toff = 0
        self.assertAlmostEqual(behaviors.calculate_failure_countdown(110.0, 100.0, 110.0), 0.0)
        # At ac=0.5: toff = 1 - 3*0.25 + 2*0.125 = 1 - 0.75 + 0.25 = 0.5
        self.assertAlmostEqual(behaviors.calculate_failure_countdown(105.0, 100.0, 110.0), 0.5)

    def test_tolerance_calculation(self):
        """Tspecific = Tcomp * (1 + Tglobal/100); SPF = 1 + Tspecific/100; max_tol = max_rating * SPF"""
        comp_tol = 5.0
        global_tol = 10.0
        max_rating = 100.0

        t_specific = comp_tol * (1 + global_tol / 100)  # 5 * 1.1 = 5.5
        spf = 1 + t_specific / 100  # 1 + 0.055 = 1.055
        expected = max_rating * spf  # 105.5

        result = behaviors.get_max_tolerated_value(max_rating, comp_tol, global_tol)
        self.assertAlmostEqual(result, expected)

    def test_component_fails_after_countdown_expires(self):
        """A component exceeding max_rating should fail after its toff countdown.

        We pin the temperature above max_rating with a scene event so the generator
        physics cannot cool it back below the rating within the test window.
        """
        gen = RuntimeComponent(
            name="Gen1", type="generator", is_backup=False, status="active",
            value={
                "temperature": {"value": 125.0, "min": -20.0, "max": 120.0},
                "power": {"value": 500.0, "min": 0.0, "max": 1000.0},
                "failure_time_temperature": 0.0,
            }
        )
        state = make_state([gen])
        engine = SimulationEngineCore(state, [], global_tolerance=0.0)

        # Directly test the countdown mechanism by bypassing physics:
        # Manually run _evaluate_failure_countdowns many times (simulating many ticks)
        # with temperature held above max_rating.
        dt = 15.0 / 3600.0  # one tick
        eff_status = {"Gen1": "active"}

        # With global_tolerance=0, comp_tolerance=5: max_tol = 120 * 1.05 = 126
        # a = (125-120)/(126-120) ≈ 0.833, toff ≈ 0.074 hours
        # So after 0.074 / dt ≈ 18 ticks the countdown expires
        for _ in range(25):  # well beyond 18 ticks
            engine._evaluate_failure_countdowns(engine.state.base_components, eff_status, dt)
            if engine.state.base_components["Gen1"].status == "failure":
                break

        self.assertEqual(engine.state.base_components["Gen1"].status, "failure",
                         "Generator should fail after countdown expires")

    def test_countdown_cancelled_when_value_returns_to_range(self):
        """If temperature drops back below max_rating, countdown resets to 0."""
        gen = RuntimeComponent(
            name="Gen1", type="generator", is_backup=False, status="active",
            value={
                "temperature": {"value": 125.0, "min": -20.0, "max": 120.0},
                "power": {"value": 500.0, "min": 0.0, "max": 1000.0},
            }
        )
        state = make_state([gen])
        engine = SimulationEngineCore(state, [])
        engine.run_tick()

        # Now bring temperature back below max
        engine.state.base_components["Gen1"].value["temperature"]["value"] = 100.0
        engine.run_tick()

        # failure_time_temperature should be 0.0 now (reset)
        ft = engine.state.base_components["Gen1"].value.get("failure_time_temperature", 0.0)
        self.assertAlmostEqual(ft, 0.0, places=5)


# ---------------------------------------------------------------------------
# Phase 14 — Resource allocation
# ---------------------------------------------------------------------------

class TestResourceAllocation(unittest.TestCase):

    def test_generator_proportional_allocation_at_35_percent(self):
        """If ratio ≥ 35%, generator distributes proportionally."""
        gen = make_comp("Gen1", "generator", power={"value": 0.0, "min": 0.0, "max": 600.0})
        gen.value["power"] = {"value": 0.0, "min": 0.0, "max": 600.0}

        c1 = make_comp("Load1", "server")
        c1.value["power"] = {"value": 500.0, "min": 0.0, "max": 1000.0}

        c2 = make_comp("Load2", "server")
        c2.value["power"] = {"value": 500.0, "min": 0.0, "max": 1000.0}

        conns = [
            make_conn("Gen1", "Load1", "power"),
            make_conn("Gen1", "Load2", "power"),
        ]
        state = make_state([gen, c1, c2], conns)
        engine = SimulationEngineCore(state, [])
        engine._resolve_resource_allocation(engine.state.base_components, engine.state.base_external)

        # Total demand = 1000. Gen max = 600. ratio = 0.6 ≥ 0.35 → proportional
        # Each load gets 600/1000 * 500 = 300
        load1_power = engine.state.base_components["Load1"].value["power"]["value"]
        load2_power = engine.state.base_components["Load2"].value["power"]["value"]
        self.assertAlmostEqual(load1_power, 300.0, places=2)
        self.assertAlmostEqual(load2_power, 300.0, places=2)

    def test_generator_priority_shutdown_below_35_percent(self):
        """If ratio < 35%, lowest-priority load should be deactivated."""
        gen = make_comp("Gen1", "generator")
        gen.value["power"] = {"value": 0.0, "min": 0.0, "max": 100.0}

        c1 = make_comp("HighPrio", "server")
        c1.value["power"] = {"value": 200.0, "min": 0.0, "max": 1000.0}

        c2 = make_comp("LowPrio", "server")
        c2.value["power"] = {"value": 200.0, "min": 0.0, "max": 1000.0}

        hier = flat_hierarchy([
            {"name": "Gen1", "type": "generator", "parent": None, "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "HighPrio", "type": "server", "parent": None, "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "LowPrio", "type": "server", "parent": None, "children": [],
             "priority": 5, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
        ])

        conns = [
            make_conn("Gen1", "HighPrio", "power"),
            make_conn("Gen1", "LowPrio", "power"),
        ]
        state = make_state([gen, c1, c2], conns)
        engine = SimulationEngineCore(state, [], hierarchy=hier)
        engine._resolve_resource_allocation(engine.state.base_components, engine.state.base_external)

        # Total demand = 400, gen max = 100 → ratio = 0.25 < 0.35 → deactivate LowPrio
        low_status = engine.state.base_components["LowPrio"].status
        self.assertEqual(low_status, "inactive")


# ---------------------------------------------------------------------------
# Phase 15 — Component-specific behaviours
# ---------------------------------------------------------------------------

class TestComponentBehaviours(unittest.TestCase):

    def setUp(self):
        self.ext = make_external(temperature=-10.0)

    def test_generator_temperature_formula(self):
        """T_curr = T_prev + 0.5 * (0.225 * T_range * (Pcurr/Prange) + Tsurr - T_prev)"""
        t_prev = 20.0
        t_surr = -10.0 + 20.0  # station min
        p_curr = 500.0
        p_max = 1000.0
        p_min = 0.0
        t_max = 120.0
        t_min = -20.0
        expected = behaviors.generator_temperature(t_prev, t_surr, p_curr, p_max, p_min, t_max, t_min)
        self.assertGreater(expected, t_prev)  # Running generator should heat up

    def test_alarm_inactive_consumes_zero_amps(self):
        self.assertAlmostEqual(behaviors.alarm_current("inactive"), 0.0)

    def test_alarm_active_consumes_5_amps(self):
        self.assertAlmostEqual(behaviors.alarm_current("active"), 5.0)

    def test_alarm_power_calculation(self):
        """Alarm power = V * I = 220 * 5 = 1100W when active."""
        alarm = make_comp("Alarm1", "alarm", status="active")
        alarm.value = {"power": {"value": 0.0, "min": 0.0, "max": 2000.0},
                       "voltage": {"value": 220.0}}
        state = make_state([alarm])
        engine = SimulationEngineCore(state, [])
        engine.run_tick()
        power = engine.state.base_components["Alarm1"].value["power"]["value"]
        self.assertAlmostEqual(power, 1100.0)

    def test_antenna_zero_connections_zero_current(self):
        self.assertAlmostEqual(behaviors.antenna_current(0, 10.0), 0.0)

    def test_antenna_under_20_connections_half_max_current(self):
        self.assertAlmostEqual(behaviors.antenna_current(1, 10.0), 5.0)
        self.assertAlmostEqual(behaviors.antenna_current(19, 10.0), 5.0)

    def test_antenna_20_plus_connections_full_current(self):
        self.assertAlmostEqual(behaviors.antenna_current(20, 10.0), 10.0)
        self.assertAlmostEqual(behaviors.antenna_current(100, 10.0), 10.0)

    def test_solar_panel_zero_irradiance(self):
        self.assertAlmostEqual(behaviors.solar_panel_power(100.0, 0.0, 1000.0), 0.0)

    def test_solar_panel_max_irradiance(self):
        self.assertAlmostEqual(behaviors.solar_panel_power(100.0, 1000.0, 1000.0), 100.0)

    def test_solar_panel_half_irradiance(self):
        self.assertAlmostEqual(behaviors.solar_panel_power(100.0, 500.0, 1000.0), 50.0)

    def test_solar_panel_above_max_clamped(self):
        # Even if irradiance > i_max, output must not exceed p_max
        result = behaviors.solar_panel_power(100.0, 2000.0, 1000.0)
        self.assertLessEqual(result, 100.0)

    def test_tank_volume_decreases_with_pump_flowrate(self):
        v_prev = 1000.0
        fr = 10.0  # L/s
        dt = 15.0 / 3600.0  # 15 seconds in hours
        expected = max(0.0, v_prev - fr * dt)
        self.assertAlmostEqual(behaviors.tank_volume(v_prev, fr, dt), expected)

    def test_tank_volume_non_negative(self):
        result = behaviors.tank_volume(0.001, 100.0, 1.0)
        self.assertEqual(result, 0.0)

    def test_station_surrounding_temperature(self):
        """Tsurr = Texternal + 20"""
        self.assertAlmostEqual(behaviors.station_surrounding_temperature(-30.0), -10.0)
        self.assertAlmostEqual(behaviors.station_surrounding_temperature(0.0), 20.0)

    def test_container_temperature_formula(self):
        """T_curr = T_prev + beta*(alpha_inner*Iavg + Vall + alpha_surr*Tsurr - T_prev)"""
        t_prev = -5.0
        t_surr = 10.0
        # No children, no vents → Iavg = 0, Vall = 0
        expected = t_prev + 0.5 * (0 + 0 + 0.8 * t_surr - t_prev)
        result = behaviors.container_temperature(t_prev, t_surr, [], [])
        self.assertAlmostEqual(result, expected)

    def test_station_temperature_via_engine(self):
        """Station Tsurr = Texternal + 20. Verify computed correctly."""
        station = make_comp("Station1", "station", status="active")
        station.value = {"temperature": {"value": -5.0, "min": -50.0, "max": 50.0}}
        state = make_state([station], ext=make_external(temperature=-10.0))
        engine = SimulationEngineCore(state, [])
        engine.run_tick()

        t_result = engine.state.base_components["Station1"].value["temperature"]["value"]
        # Tsurr = -10 + 20 = 10, T_prev = -5
        # No children/vents: T_curr = -5 + 0.5*(0 + 0 + 0.8*10 - (-5)) = -5 + 0.5*13 = 1.5
        self.assertAlmostEqual(t_result, 1.5, places=5)

    def test_vent_current_proportional_to_airflow(self):
        """Current is proportional to airflow up to i_max."""
        self.assertAlmostEqual(behaviors.vent_current(50.0, 100.0, 10.0), 5.0)
        self.assertAlmostEqual(behaviors.vent_current(100.0, 100.0, 10.0), 10.0)
        self.assertAlmostEqual(behaviors.vent_current(0.0, 100.0, 10.0), 0.0)

    def test_ac_current_formula(self):
        """I_req = Imax * [alpha*(FR_curr/FR_max) + (1-alpha)*clamp(|Tout-Tsurr|/(Tmax-Tmin),0,1)]"""
        i_max = 10.0
        fr_curr = 50.0
        fr_max = 100.0
        t_out = 25.0
        t_surr = 5.0
        t_max = 40.0
        t_min = 0.0
        alpha = 0.4

        fr_ratio = fr_curr / fr_max
        temp_ratio = abs(t_out - t_surr) / (t_max - t_min)
        expected = i_max * (alpha * fr_ratio + (1 - alpha) * temp_ratio)
        result = behaviors.ac_current_requirement(i_max, fr_curr, fr_max, t_out, t_surr, t_max, t_min)
        self.assertAlmostEqual(result, expected)

    def test_ac_output_temperature_approaches_target(self):
        """Tout approaches target with beta=0.5."""
        t_out = 25.0
        t_target = 15.0
        expected = t_out + 0.5 * (t_target - t_out)
        result = behaviors.ac_output_temperature(t_out, t_target)
        self.assertAlmostEqual(result, expected)

    def test_pump_temperature_uses_flowrate_term(self):
        """Pump temp uses FR_curr/FR instead of P_curr/P."""
        t_prev = 20.0
        t_surr = 10.0
        fr_curr = 50.0
        fr_max = 100.0
        fr_min = 0.0
        t_max = 100.0
        t_min = 0.0
        result = behaviors.pump_temperature(t_prev, t_surr, fr_curr, fr_max, fr_min, t_max, t_min)
        expected = behaviors.generator_temperature(t_prev, t_surr, fr_curr, fr_max, fr_min, t_max, t_min)
        self.assertAlmostEqual(result, expected)


# ---------------------------------------------------------------------------
# Phase 15.10 — Container thermal correction
# ---------------------------------------------------------------------------

class TestContainerThermalCorrection(unittest.TestCase):

    def test_vent_airflow_increases_when_container_overheats(self):
        """When container temp > max, vents should be maxed out first."""
        container = make_comp("Sys1", "system", status="active")
        container.value = {"temperature": {"value": 31.0, "min": 0.0, "max": 30.0}}

        vent = make_comp("Vent1", "vent", status="active")
        vent.value = {"airflow": {"value": 10.0, "min": 0.0, "max": 100.0},
                      "power": {"value": 0.0, "min": 0.0, "max": 1000.0},
                      "voltage": {"value": 220.0}}

        hier = flat_hierarchy([
            {"name": "Sys1", "type": "system", "parent": None, "children": ["Vent1"],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "Vent1", "type": "vent", "parent": "Sys1", "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
        ])

        state = make_state([container, vent])
        engine = SimulationEngineCore(state, [], hierarchy=hier)
        base_comps = engine.state.base_components

        engine._container_thermal_correction(container, "Sys1", base_comps)
        airflow = base_comps["Vent1"].value["airflow"]["value"]
        self.assertAlmostEqual(airflow, 100.0, msg="Vent airflow should be maxed to 100")

    def test_ac_target_decreases_when_vents_already_maxed(self):
        """When vents are already at max airflow, AC target temp should decrease by 2°C."""
        container = make_comp("Sys1", "system", status="active")
        container.value = {"temperature": {"value": 31.0, "min": 0.0, "max": 30.0}}

        vent = make_comp("Vent1", "vent", status="active")
        vent.value = {"airflow": {"value": 100.0, "min": 0.0, "max": 100.0},  # Already maxed
                      "power": {"value": 0.0, "min": 0.0, "max": 1000.0},
                      "voltage": {"value": 220.0}}

        ac = make_comp("AC1", "air_conditioner", status="active")
        ac.value = {"temperature": {"value": 20.0, "min": 0.0, "max": 40.0},
                    "target_temperature": {"value": 20.0},
                    "airflow": {"value": 100.0, "min": 0.0, "max": 200.0},
                    "power": {"value": 0.0, "min": 0.0, "max": 5000.0},
                    "voltage": {"value": 220.0}}

        hier = flat_hierarchy([
            {"name": "Sys1", "type": "system", "parent": None, "children": ["Vent1", "AC1"],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "Vent1", "type": "vent", "parent": "Sys1", "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
            {"name": "AC1", "type": "air_conditioner", "parent": "Sys1", "children": [],
             "priority": 0, "floor": 0, "is_backup": False, "backup": [], "external_field": None, "tags": []},
        ])

        state = make_state([container, vent, ac])
        engine = SimulationEngineCore(state, [], hierarchy=hier)
        base_comps = engine.state.base_components

        engine._container_thermal_correction(container, "Sys1", base_comps)
        target_temp = base_comps["AC1"].value["target_temperature"]["value"]
        self.assertAlmostEqual(target_temp, 18.0, msg="AC target should decrease by 2°C")


# ---------------------------------------------------------------------------
# Phase 13 — Event instantiation
# ---------------------------------------------------------------------------

class TestEventInstantiation(unittest.TestCase):

    def test_scene_event_fires_at_correct_time(self):
        gen = make_comp("Gen1", "generator")
        state = make_state([gen])

        scene = SceneEvent(
            event_ref="fail",
            selector="@Gen1",
            at=0.5,
            duration=float("inf"),
            payload={"status": "failure"}
        )
        engine = SimulationEngineCore(state, [scene])
        engine.run_duration(0.4)

        # Event not yet fired
        self.assertEqual(engine.state.base_components["Gen1"].status, "active")

        engine.run_duration(0.2)
        # Event has fired
        self.assertEqual(engine.state.base_components["Gen1"].status, "failure")

    def test_finite_event_expires(self):
        gen = make_comp("Gen1", "generator")
        state = make_state([gen])

        scene = SceneEvent(
            event_ref="temp_boost",
            selector="@Gen1",
            at=0.0,
            duration=0.5,
            payload={"temperature": {"value": 150.0, "min": -20.0, "max": 120.0}}
        )
        engine = SimulationEngineCore(state, [scene])
        engine.run_duration(0.3)
        self.assertEqual(len(engine.state.active_layers), 1)

        engine.run_duration(0.3)
        self.assertEqual(len(engine.state.active_layers), 0)

    def test_connection_failure_scene_event(self):
        gen = make_comp("Gen1", "generator")
        load = make_comp("Server1", "server")
        conn = make_conn("Gen1", "Server1", "power")

        state = make_state([gen, load], [conn])
        scene = SceneEvent(
            event_ref="conn_fail",
            selector="@(Gen1|power|Server1)",
            at=0.0,
            duration=float("inf"),
            payload={"status": "failure"}
        )
        engine = SimulationEngineCore(state, [scene])
        engine.run_tick()

        conn_key = "Gen1_power_Server1"
        self.assertEqual(engine.state.base_connections[conn_key].status, "failure")


# ---------------------------------------------------------------------------
# Integration — full tick with topology
# ---------------------------------------------------------------------------

class TestFullTickIntegration(unittest.TestCase):

    def test_inactive_component_does_not_run_physics(self):
        """An inactive generator should not have its temperature updated."""
        gen = make_comp("Gen1", "generator", status="inactive")
        t_initial = gen.value["temperature"]["value"]
        state = make_state([gen])
        engine = SimulationEngineCore(state, [])
        engine.run_tick()
        # Temperature should remain unchanged (no physics for inactive)
        t_after = engine.state.base_components["Gen1"].value["temperature"]["value"]
        self.assertAlmostEqual(t_after, t_initial)

    def test_determinism_same_state_same_result(self):
        """Same inputs must produce identical output (deterministic)."""
        def build_and_run():
            comps = [
                make_comp("Gen1", "generator"),
                make_comp("Server1", "server"),
            ]
            conns = [make_conn("Gen1", "Server1", "power")]
            state = make_state(comps, conns)
            engine = SimulationEngineCore(state, [])
            engine.run_duration(1.0)
            return engine.state.base_components["Gen1"].value["temperature"]["value"]

        r1 = build_and_run()
        r2 = build_and_run()
        self.assertAlmostEqual(r1, r2, places=10, msg="Simulation must be deterministic")


if __name__ == "__main__":
    unittest.main()
