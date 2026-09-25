"""
manager.py — Phase 16 (Simulation Manager)

Manages the lifecycle of simulation runs using the new SimulationEngineCore.

Each run:
  - Has a unique run_id (UUID-based).
  - Holds a SimulationEngineCore instance with its TimelineStateManager.
  - Can be played (continuous tick loop), paused, stepped (single tick), or reset.
  - Optionally publishes telemetry to a TelemetryDatabase on every tick.

The SimulationManager is designed to be a singleton used by the FastAPI app.
"""

from __future__ import annotations

import copy
import threading
import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional

from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.dsl.models import SceneEvent
from twin_sim.simulation.engine_core import SimulationEngineCore
from twin_sim.simulation.station_loader import LoadedStation
from twin_sim.telemetry.database import TelemetryDatabase


class RunStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    FINISHED = "finished"
    FAILED = "failed"


class RunRecord:
    """
    Holds all state for a single simulation run.
    """

    def __init__(
        self,
        run_id: str,
        engine: SimulationEngineCore,
        station_id: str,
        scenario_id: Optional[str] = None,
    ):
        self.run_id = run_id
        self.engine = engine
        self.station_id = station_id
        self.scenario_id = scenario_id
        self.status: RunStatus = RunStatus.IDLE

        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()  # Not paused by default

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def play(self, tick_interval: float = 1.0):
        """Start continuous simulation in a background thread."""
        if self.status == RunStatus.RUNNING:
            return
        self._stop_event.clear()
        self._pause_event.set()
        self.status = RunStatus.RUNNING

        def _loop():
            try:
                while not self._stop_event.is_set():
                    self._pause_event.wait()  # blocks while paused
                    if self._stop_event.is_set():
                        break
                    self.engine.run_tick()
                    time.sleep(tick_interval)
                self.status = RunStatus.FINISHED
            except Exception:
                self.status = RunStatus.FAILED

        self._thread = threading.Thread(target=_loop, daemon=True, name=f"sim-{self.run_id}")
        self._thread.start()

    def pause(self):
        """Pause a running simulation (does not affect the engine state)."""
        if self.status == RunStatus.RUNNING:
            self._pause_event.clear()
            self.status = RunStatus.PAUSED

    def resume(self):
        """Resume a paused simulation."""
        if self.status == RunStatus.PAUSED:
            self._pause_event.set()
            self.status = RunStatus.RUNNING

    def stop(self):
        """Stop simulation permanently."""
        self._stop_event.set()
        self._pause_event.set()  # unblock if paused
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)
        self.status = RunStatus.FINISHED

    def step(self):
        """Execute exactly one simulation tick."""
        if self.status in (RunStatus.IDLE, RunStatus.PAUSED, RunStatus.FINISHED):
            self.engine.run_tick()
            return True
        return False  # cannot step while running

    def reset(self, loaded_station: LoadedStation, scenes: Optional[List[SceneEvent]] = None):
        """
        Stop the current run and rebuild the engine from the original station data.
        The run_id is preserved.
        """
        self.stop()
        self.engine = loaded_station.build_engine(scenes=scenes)
        self.status = RunStatus.IDLE

    # ------------------------------------------------------------------
    # Telemetry publishing
    # ------------------------------------------------------------------

    def start_telemetry(self):
        """Enable telemetry publishing (engine writes one record per tick)."""
        self.engine.telemetry_publishing = True

    def stop_telemetry(self):
        """
        Disable telemetry publishing.
        Does NOT stop or modify the simulation itself (per spec §6.1.5).
        """
        self.engine.telemetry_publishing = False

    # ------------------------------------------------------------------
    # State snapshot
    # ------------------------------------------------------------------

    def state_snapshot(self) -> Dict[str, Any]:
        """Return the current effective simulation state as a JSON-serialisable dict."""
        eff = self.engine.state.get_effective_state_dict()
        return {
            "run_id": self.run_id,
            "station_id": self.station_id,
            "status": self.status.value,
            "simulation_time": self.engine.time,
            "telemetry_publishing": self.engine.telemetry_publishing,
            "components": [c.model_dump() for c in eff["components"]],
            "connections": [c.model_dump() for c in eff["connections"]],
            "external": eff["external"].model_dump() if hasattr(eff["external"], "model_dump") else {},
        }

    def summary(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "station_id": self.station_id,
            "scenario_id": self.scenario_id,
            "status": self.status.value,
            "simulation_time": self.engine.time,
            "telemetry_publishing": self.engine.telemetry_publishing,
        }


class SimulationManager:
    """
    Singleton manager for all active simulation runs.
    """

    def __init__(self, telemetry_db: Optional[TelemetryDatabase] = None):
        self._runs: Dict[str, RunRecord] = {}
        self._station_cache: Dict[str, LoadedStation] = {}
        self._lock = threading.Lock()
        self._telemetry_db: Optional[TelemetryDatabase] = telemetry_db

    # ------------------------------------------------------------------
    # Station cache
    # ------------------------------------------------------------------

    def register_station(self, station: LoadedStation) -> None:
        """Pre-register a loaded station so simulations can reference it by ID."""
        with self._lock:
            self._station_cache[station.station_id] = station

    def get_loaded_station(self, station_id: str) -> Optional[LoadedStation]:
        with self._lock:
            return self._station_cache.get(station_id)

    def list_stations(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [s.to_manifest() for s in self._station_cache.values()]

    # ------------------------------------------------------------------
    # Run creation
    # ------------------------------------------------------------------

    def create_run(
        self,
        station_id: str,
        scenes: Optional[List[SceneEvent]] = None,
        scenario_id: Optional[str] = None,
        global_tolerance: float = 10.0,
    ) -> str:
        """
        Create a new simulation run for a registered station.
        Returns the unique run_id.
        """
        with self._lock:
            station = self._station_cache.get(station_id)

        if station is None:
            raise ValueError(f"Station '{station_id}' is not registered.")

        run_id = f"run-{uuid.uuid4().hex[:12]}"
        engine = station.build_engine(scenes=scenes, global_tolerance=global_tolerance)

        record = RunRecord(
            run_id=run_id,
            engine=engine,
            station_id=station_id,
            scenario_id=scenario_id,
        )

        with self._lock:
            self._runs[run_id] = record

        return run_id

    # ------------------------------------------------------------------
    # Run lifecycle
    # ------------------------------------------------------------------

    def get_run(self, run_id: str) -> Optional[RunRecord]:
        with self._lock:
            return self._runs.get(run_id)

    def list_runs(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [r.summary() for r in self._runs.values()]

    def play(self, run_id: str, tick_interval: float = 1.0) -> bool:
        rec = self.get_run(run_id)
        if rec:
            rec.play(tick_interval=tick_interval)
            return True
        return False

    def pause(self, run_id: str) -> bool:
        rec = self.get_run(run_id)
        if rec:
            rec.pause()
            return True
        return False

    def resume(self, run_id: str) -> bool:
        rec = self.get_run(run_id)
        if rec:
            rec.resume()
            return True
        return False

    def stop(self, run_id: str) -> bool:
        rec = self.get_run(run_id)
        if rec:
            rec.stop()
            return True
        return False

    def step(self, run_id: str) -> bool:
        rec = self.get_run(run_id)
        if rec:
            return rec.step()
        return False

    def reset(self, run_id: str, scenes: Optional[List[SceneEvent]] = None) -> bool:
        rec = self.get_run(run_id)
        if rec:
            station = self.get_loaded_station(rec.station_id)
            if station:
                rec.reset(station, scenes=scenes)
                return True
        return False

    # ------------------------------------------------------------------
    # Telemetry publishing
    # ------------------------------------------------------------------

    def start_telemetry(self, run_id: str) -> bool:
        rec = self.get_run(run_id)
        if rec:
            rec.start_telemetry()
            return True
        return False

    def stop_telemetry(self, run_id: str) -> bool:
        rec = self.get_run(run_id)
        if rec:
            rec.stop_telemetry()
            return True
        return False

    def flush_telemetry(self, run_id: str) -> int:
        """
        Write all accumulated engine telemetry records to the database.
        Clears the in-memory buffer after persisting.
        Returns the number of records flushed.
        """
        if self._telemetry_db is None:
            return 0
        rec = self.get_run(run_id)
        if not rec or not rec.engine.telemetry:
            return 0

        records = rec.engine.telemetry[:]
        rec.engine.telemetry.clear()

        self._telemetry_db.insert_telemetry_batch(
            run_id=run_id,
            station_id=rec.station_id,
            source="SIMULATION",
            records=records,
        )
        return len(records)

    # ------------------------------------------------------------------
    # State / log
    # ------------------------------------------------------------------

    def get_state(self, run_id: str) -> Optional[Dict[str, Any]]:
        rec = self.get_run(run_id)
        if rec:
            return rec.state_snapshot()
        return None

    def get_log(self, run_id: str) -> Optional[List[Dict[str, Any]]]:
        """Return all buffered telemetry from the engine (not yet persisted to DB)."""
        rec = self.get_run(run_id)
        if rec:
            return list(rec.engine.telemetry)
        return None

    def get_persisted_telemetry(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get the latest persisted telemetry record from DB."""
        if self._telemetry_db is None:
            return None
        return self._telemetry_db.get_latest_record(run_id)
