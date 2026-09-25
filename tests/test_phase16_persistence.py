"""
test_phase16_persistence.py — Comprehensive tests for Phase 16.

Covers:
- StationLoader: loading compiled station, default external, station listing
- SimulationManager: run lifecycle (create, play, pause, resume, stop, step, reset)
- Telemetry publishing: opt-in, stop does not stop simulation
- Telemetry DB integration: flush to database, query latest
- API endpoints: create simulation, step, state, telemetry start/stop/flush
- irradiance field added to WeatherModel
"""

import copy
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from twin_sim.api.manager import RunStatus, SimulationManager
from twin_sim.api.main import app
from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.ingestion.models import (
    ExternalModel, NetworkModel, RuntimeComponent, RuntimeConnection, WeatherModel
)
from twin_sim.simulation.engine_core import HierarchyGraph, SimulationEngineCore
from twin_sim.simulation.station_loader import LoadedStation, StationLoader
from twin_sim.telemetry.database import TelemetryDatabase


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_station_dir(tmp_path: Path, station_name: str = "TestStation") -> Path:
    """Create a minimal compiled station directory for testing."""
    station_dir = tmp_path / station_name
    station_dir.mkdir(parents=True, exist_ok=True)

    hierarchy = [
        {
            "name": station_name, "type": "station", "parent": None,
            "priority": 0, "floor": 0, "is_backup": False, "backup": [],
            "children": ["GenMain", "GenBackup"],
            "external_field": None, "tags": []
        },
        {
            "name": "GenMain", "type": "generator", "parent": station_name,
            "priority": 1, "floor": 0, "is_backup": False, "backup": [],
            "children": [],
            "external_field": None, "tags": []
        },
        {
            "name": "GenBackup", "type": "generator", "parent": station_name,
            "priority": 2, "floor": 0, "is_backup": True, "backup": ["GenMain"],
            "children": [],
            "external_field": None, "tags": []
        },
    ]
    spec = [
        {
            "name": station_name, "type": "station",
            "rating": {"state": {"temperature": {"value": -30.0, "min": -50.0, "max": 50.0, "unit": "C"}}},
        },
        {
            "name": "GenMain", "type": "generator",
            "rating": {
                "state": {"temperature": {"value": 20.0, "min": -20.0, "max": 120.0, "unit": "C"}},
                "output": {"power": {"value": 0.0, "min": 0.0, "max": 1000.0, "unit": "W"}},
            },
        },
        {
            "name": "GenBackup", "type": "generator",
            "rating": {
                "state": {"temperature": {"value": 20.0, "min": -20.0, "max": 120.0, "unit": "C"}},
                "output": {"power": {"value": 0.0, "min": 0.0, "max": 500.0, "unit": "W"}},
            },
        },
    ]
    connections = [
        {"source": "GenMain", "target": "GenBackup", "type": "signal", "relation": "monitor"},
    ]

    (station_dir / "hierarchy.json").write_text(json.dumps(hierarchy), encoding="utf-8")
    (station_dir / "spec.json").write_text(json.dumps(spec), encoding="utf-8")
    (station_dir / "connection.json").write_text(json.dumps(connections), encoding="utf-8")

    return station_dir


def _make_external() -> ExternalModel:
    return ExternalModel(
        weather=WeatherModel(
            temperature=-30.0, wind_speed=10.0, humidity=60.0, o2_level=0.21,
            co2_level=0.00041, wind_direction=180.0, visibility=5000.0,
            pressure=1013.25, dew_frost_point=-35.0, irradiance=500.0
        ),
        network=NetworkModel(
            bandwidth=5.0, mainland_connectivity=True, upload_window=False,
            upload_speed=2.0, download_speed=5.0
        ),
        supplies=[]
    )


# ---------------------------------------------------------------------------
# WeatherModel irradiance field
# ---------------------------------------------------------------------------

class TestWeatherModelIrradiance(unittest.TestCase):

    def test_irradiance_default_is_zero(self):
        w = WeatherModel(
            temperature=-10.0, wind_speed=5.0, humidity=50, o2_level=0.21,
            co2_level=0.00041, wind_direction=180.0, visibility=1000.0,
            pressure=1013.0, dew_frost_point=-15.0
        )
        self.assertEqual(w.irradiance, 0.0)

    def test_irradiance_can_be_set(self):
        w = WeatherModel(
            temperature=-10.0, wind_speed=5.0, humidity=50, o2_level=0.21,
            co2_level=0.00041, wind_direction=180.0, visibility=1000.0,
            pressure=1013.0, dew_frost_point=-15.0, irradiance=750.0
        )
        self.assertAlmostEqual(w.irradiance, 750.0)

    def test_solar_panel_uses_irradiance(self):
        """Solar panel power should use external.weather.irradiance from the engine."""
        solar = RuntimeComponent(
            name="Solar1", type="solar_panel", is_backup=False, status="active",
            value={
                "power": {"value": 0.0, "min": 0.0, "max": 100.0},
                "irradiance": {"max": 1000.0},
            }
        )
        ext = _make_external()  # irradiance=500
        state = TimelineStateManager(components=[solar], connections=[], external=ext)
        engine = SimulationEngineCore(state, [])
        engine.run_tick()

        # P = P_max * (I_curr / I_max) = 100 * (500 / 1000) = 50
        power = engine.state.base_components["Solar1"].value["power"]["value"]
        self.assertAlmostEqual(power, 50.0, places=2)


# ---------------------------------------------------------------------------
# StationLoader
# ---------------------------------------------------------------------------

class TestStationLoader(unittest.TestCase):

    def test_load_station_from_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "Alpha")
            station = StationLoader.load(station_dir)
            self.assertEqual(station.station_id, "Alpha")
            self.assertGreater(len(station.runtime_components), 0)
            self.assertGreater(len(station.runtime_connections), 0)

    def test_hierarchy_graph_built_correctly(self):
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "Alpha")
            station = StationLoader.load(station_dir)
            # HierarchyGraph should know about the generator children
            children = station.hierarchy_graph.direct_children("Alpha")
            self.assertIn("GenMain", children)
            self.assertIn("GenBackup", children)

    def test_missing_hierarchy_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "BadStation"
            d.mkdir()
            (d / "connection.json").write_text("[]")
            (d / "spec.json").write_text("[]")
            with self.assertRaises(FileNotFoundError):
                StationLoader.load(d)

    def test_list_stations(self):
        with tempfile.TemporaryDirectory() as tmp:
            _make_station_dir(Path(tmp), "Alpha")
            _make_station_dir(Path(tmp), "Beta")
            # Gamma has no hierarchy.json → should be ignored
            (Path(tmp) / "Gamma").mkdir()
            stations = StationLoader.list_stations(Path(tmp))
            self.assertIn("Alpha", stations)
            self.assertIn("Beta", stations)
            self.assertNotIn("Gamma", stations)

    def test_default_external_applied_when_no_external_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "Alpha")
            station = StationLoader.load(station_dir)
            # Default external has temperature=-30
            self.assertAlmostEqual(station.external.weather.temperature, -30.0)

    def test_build_engine_produces_independent_instances(self):
        """Two engines built from the same station must not share mutable state."""
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "Alpha")
            station = StationLoader.load(station_dir)
            e1 = station.build_engine()
            e2 = station.build_engine()
            # Mutate e1's state
            e1.run_tick()
            # e2 must not be affected
            self.assertEqual(e2.time, 0.0)


# ---------------------------------------------------------------------------
# SimulationManager lifecycle
# ---------------------------------------------------------------------------

class TestSimulationManagerLifecycle(unittest.TestCase):

    def _make_manager_with_station(self) -> tuple[SimulationManager, str]:
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "TestStation")
            station = StationLoader.load(station_dir)
        manager = SimulationManager()
        manager.register_station(station)
        return manager, "TestStation"

    def setUp(self):
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "TestStation")
            self.station = StationLoader.load(station_dir)
        self.manager = SimulationManager()
        self.manager.register_station(self.station)

    def test_create_run_returns_run_id(self):
        run_id = self.manager.create_run("TestStation")
        self.assertIsNotNone(run_id)
        self.assertTrue(run_id.startswith("run-"))

    def test_create_run_unknown_station_raises(self):
        with self.assertRaises(ValueError):
            self.manager.create_run("NonExistentStation")

    def test_initial_status_is_idle(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        self.assertEqual(rec.status, RunStatus.IDLE)

    def test_step_advances_time(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        self.assertEqual(rec.engine.time, 0.0)
        self.manager.step(run_id)
        self.assertGreater(rec.engine.time, 0.0)

    def test_step_returns_false_while_running(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        rec.status = RunStatus.RUNNING  # simulate running state
        result = self.manager.step(run_id)
        self.assertFalse(result)

    def test_pause_changes_status(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        rec.play(tick_interval=10)  # slow so we can pause before it finishes
        time.sleep(0.05)
        self.manager.pause(run_id)
        self.assertEqual(rec.status, RunStatus.PAUSED)

    def test_resume_after_pause(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        rec.play(tick_interval=10)
        time.sleep(0.05)
        self.manager.pause(run_id)
        self.manager.resume(run_id)
        self.assertEqual(rec.status, RunStatus.RUNNING)
        rec.stop()

    def test_stop_terminates_thread(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        rec.play(tick_interval=0.01)
        time.sleep(0.1)
        self.manager.stop(run_id)
        self.assertEqual(rec.status, RunStatus.FINISHED)
        if rec._thread:
            self.assertFalse(rec._thread.is_alive())

    def test_reset_resets_time(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        # Advance a few ticks
        for _ in range(5):
            self.manager.step(run_id)
        self.assertGreater(rec.engine.time, 0.0)
        # Reset
        self.manager.reset(run_id)
        self.assertAlmostEqual(rec.engine.time, 0.0)

    def test_list_runs(self):
        r1 = self.manager.create_run("TestStation")
        r2 = self.manager.create_run("TestStation")
        runs = self.manager.list_runs()
        run_ids = [r["run_id"] for r in runs]
        self.assertIn(r1, run_ids)
        self.assertIn(r2, run_ids)


# ---------------------------------------------------------------------------
# Telemetry publishing
# ---------------------------------------------------------------------------

class TestTelemetryPublishing(unittest.TestCase):

    def setUp(self):
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "TestStation")
            self.station = StationLoader.load(station_dir)
        self.db = TelemetryDatabase(":memory:")
        self.manager = SimulationManager(telemetry_db=self.db)
        self.manager.register_station(self.station)

    def test_telemetry_disabled_by_default(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        self.assertFalse(rec.engine.telemetry_publishing)

    def test_start_telemetry_enables_publishing(self):
        run_id = self.manager.create_run("TestStation")
        self.manager.start_telemetry(run_id)
        rec = self.manager.get_run(run_id)
        self.assertTrue(rec.engine.telemetry_publishing)

    def test_stop_telemetry_does_not_stop_simulation(self):
        """Per spec: stopping telemetry publishing must not stop/modify the simulation."""
        run_id = self.manager.create_run("TestStation")
        self.manager.start_telemetry(run_id)
        rec = self.manager.get_run(run_id)
        # Step a few ticks with publishing enabled
        for _ in range(3):
            self.manager.step(run_id)
        t_before = rec.engine.time
        # Stop telemetry publishing
        self.manager.stop_telemetry(run_id)
        self.assertFalse(rec.engine.telemetry_publishing)
        # Engine is still at the same time (stop_telemetry does not reset it)
        self.assertAlmostEqual(rec.engine.time, t_before)
        # Step again — should still work
        self.manager.step(run_id)
        self.assertGreater(rec.engine.time, t_before)

    def test_one_record_per_tick_when_publishing(self):
        run_id = self.manager.create_run("TestStation")
        self.manager.start_telemetry(run_id)
        rec = self.manager.get_run(run_id)
        ticks = 5
        for _ in range(ticks):
            self.manager.step(run_id)
        self.assertEqual(len(rec.engine.telemetry), ticks)

    def test_no_records_accumulated_when_publishing_disabled(self):
        run_id = self.manager.create_run("TestStation")
        rec = self.manager.get_run(run_id)
        for _ in range(5):
            self.manager.step(run_id)
        self.assertEqual(len(rec.engine.telemetry), 0)

    def test_flush_persists_records_to_db(self):
        run_id = self.manager.create_run("TestStation")
        self.manager.start_telemetry(run_id)
        for _ in range(3):
            self.manager.step(run_id)
        flushed = self.manager.flush_telemetry(run_id)
        self.assertEqual(flushed, 3)

    def test_flush_clears_engine_buffer(self):
        run_id = self.manager.create_run("TestStation")
        self.manager.start_telemetry(run_id)
        for _ in range(3):
            self.manager.step(run_id)
        self.manager.flush_telemetry(run_id)
        rec = self.manager.get_run(run_id)
        self.assertEqual(len(rec.engine.telemetry), 0)

    def test_each_telemetry_record_has_source_simulation(self):
        run_id = self.manager.create_run("TestStation")
        self.manager.start_telemetry(run_id)
        self.manager.step(run_id)
        rec = self.manager.get_run(run_id)
        record = rec.engine.telemetry[0]
        self.assertEqual(record["source"], "SIMULATION")

    def test_each_record_has_metadata_fields(self):
        run_id = self.manager.create_run("TestStation")
        self.manager.start_telemetry(run_id)
        self.manager.step(run_id)
        rec = self.manager.get_run(run_id)
        record = rec.engine.telemetry[0]
        self.assertIn("time", record)
        self.assertIn("persistence_time", record)
        self.assertIn("source", record)
        self.assertIn("components", record)
        self.assertIn("connections", record)
        self.assertIn("external", record)

    def test_flush_returns_zero_with_no_db(self):
        manager_no_db = SimulationManager(telemetry_db=None)
        manager_no_db.register_station(self.station)
        run_id = manager_no_db.create_run("TestStation")
        manager_no_db.start_telemetry(run_id)
        manager_no_db.step(run_id)
        flushed = manager_no_db.flush_telemetry(run_id)
        self.assertEqual(flushed, 0)

    def test_unique_run_id_per_run(self):
        """Each simulation run must have a unique ID."""
        r1 = self.manager.create_run("TestStation")
        r2 = self.manager.create_run("TestStation")
        self.assertNotEqual(r1, r2)


# ---------------------------------------------------------------------------
# State snapshot
# ---------------------------------------------------------------------------

class TestStateSnapshot(unittest.TestCase):

    def setUp(self):
        with tempfile.TemporaryDirectory() as tmp:
            station_dir = _make_station_dir(Path(tmp), "TestStation")
            self.station = StationLoader.load(station_dir)
        self.manager = SimulationManager()
        self.manager.register_station(self.station)

    def test_state_snapshot_contains_required_keys(self):
        run_id = self.manager.create_run("TestStation")
        state = self.manager.get_state(run_id)
        self.assertIn("run_id", state)
        self.assertIn("station_id", state)
        self.assertIn("status", state)
        self.assertIn("simulation_time", state)
        self.assertIn("components", state)
        self.assertIn("connections", state)
        self.assertIn("external", state)

    def test_state_components_are_serialisable(self):
        run_id = self.manager.create_run("TestStation")
        state = self.manager.get_state(run_id)
        # Should not raise
        json.dumps(state["components"])

    def test_state_is_none_for_unknown_run(self):
        result = self.manager.get_state("nonexistent-run-id")
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# API endpoints (via TestClient)
# ---------------------------------------------------------------------------

class TestAPIEndpoints(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Register the test station with the app's manager before testing."""
        from twin_sim.api.main import _manager
        # Create a temp station
        cls._tmp = tempfile.mkdtemp()
        station_dir = _make_station_dir(Path(cls._tmp), "Maitri")
        station = StationLoader.load(station_dir)
        _manager.register_station(station)
        cls.client = TestClient(app)

    def test_list_stations_returns_maitri(self):
        resp = self.client.get("/stations")
        self.assertEqual(resp.status_code, 200)
        station_ids = [s["station_id"] for s in resp.json()]
        self.assertIn("Maitri", station_ids)

    def test_get_station_hierarchy(self):
        resp = self.client.get("/stations/Maitri/hierarchy")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.json(), list)

    def test_get_unknown_station_returns_404(self):
        resp = self.client.get("/stations/UnknownStation")
        self.assertEqual(resp.status_code, 404)

    def test_create_simulation_returns_run_id(self):
        resp = self.client.post("/simulations", json={"station_id": "Maitri"})
        self.assertEqual(resp.status_code, 201)
        self.assertIn("runId", resp.json())

    def test_create_simulation_unknown_station_returns_404(self):
        resp = self.client.post("/simulations", json={"station_id": "GhostStation"})
        self.assertEqual(resp.status_code, 404)

    def test_step_simulation(self):
        resp = self.client.post("/simulations", json={"station_id": "Maitri"})
        run_id = resp.json()["runId"]
        resp2 = self.client.post(f"/simulations/{run_id}/step")
        self.assertEqual(resp2.status_code, 200)
        self.assertAlmostEqual(resp2.json()["simulation_time"], 15.0 / 3600.0, places=8)

    def test_get_simulation_state(self):
        resp = self.client.post("/simulations", json={"station_id": "Maitri"})
        run_id = resp.json()["runId"]
        self.client.post(f"/simulations/{run_id}/step")
        resp2 = self.client.get(f"/simulations/{run_id}/state")
        self.assertEqual(resp2.status_code, 200)
        state = resp2.json()
        self.assertIn("components", state)
        self.assertIn("connections", state)

    def test_start_and_stop_telemetry(self):
        resp = self.client.post("/simulations", json={"station_id": "Maitri"})
        run_id = resp.json()["runId"]
        r1 = self.client.post(f"/simulations/{run_id}/telemetry/start")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()["telemetry"], "started")

        r2 = self.client.post(f"/simulations/{run_id}/telemetry/stop")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()["telemetry"], "stopped")

    def test_flush_telemetry_endpoint(self):
        resp = self.client.post("/simulations", json={"station_id": "Maitri"})
        run_id = resp.json()["runId"]
        self.client.post(f"/simulations/{run_id}/telemetry/start")
        self.client.post(f"/simulations/{run_id}/step")
        r = self.client.post(f"/simulations/{run_id}/telemetry/flush")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["flushed"], 1)

    def test_reset_simulation(self):
        resp = self.client.post("/simulations", json={"station_id": "Maitri"})
        run_id = resp.json()["runId"]
        self.client.post(f"/simulations/{run_id}/step")
        r = self.client.post(f"/simulations/{run_id}/reset")
        self.assertEqual(r.status_code, 200)
        # After reset, simulation_time should be back to 0
        state = self.client.get(f"/simulations/{run_id}/state").json()
        self.assertAlmostEqual(state["simulation_time"], 0.0)

    def test_simulation_log_endpoint(self):
        resp = self.client.post("/simulations", json={"station_id": "Maitri"})
        run_id = resp.json()["runId"]
        self.client.post(f"/simulations/{run_id}/telemetry/start")
        self.client.post(f"/simulations/{run_id}/step")
        r = self.client.get(f"/simulations/{run_id}/log")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.json(), list)
        self.assertEqual(len(r.json()), 1)

    def test_stations_runtime_endpoint(self):
        resp = self.client.get("/stations/Maitri/runtime")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.json(), list)


if __name__ == "__main__":
    unittest.main()
