"""
main.py — Phase 16 (FastAPI Backend)

All API routes are wired to the SimulationManager which uses the real
SimulationEngineCore loaded from compiled station artefacts.

Station discovery:
  Compiled stations are auto-discovered from DATA_DIR/compiled/<station_id>/ on
  application startup. DATA_DIR defaults to "data/" relative to the project root
  but can be overridden via the DATA_DIR environment variable.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from twin_sim.api.manager import SimulationManager, RunStatus
from twin_sim.simulation.station_loader import StationLoader
from twin_sim.telemetry.database import TelemetryDatabase


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(_PROJECT_ROOT / "data")))
COMPILED_ROOT = DATA_DIR / "compiled"
DB_PATH = DATA_DIR / "telemetry.db"

# ---------------------------------------------------------------------------
# Application bootstrap
# ---------------------------------------------------------------------------

app = FastAPI(title="PolarTwin Backend API", version="2.0.0")

_db = TelemetryDatabase(str(DB_PATH))
_manager = SimulationManager(telemetry_db=_db)


@app.on_event("startup")
def _discover_stations():
    """Auto-discover and register all compiled stations on startup."""
    station_names = StationLoader.list_stations(COMPILED_ROOT)
    for name in station_names:
        try:
            station = StationLoader.load(COMPILED_ROOT / name)
            _manager.register_station(station)
        except Exception as exc:
            # Log but don't crash startup if one station is malformed
            print(f"[warning] Could not load station '{name}': {exc}")
    print(f"[startup] Loaded {len(station_names)} station(s): {station_names}")


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class CreateSimulationRequest(BaseModel):
    station_id: str
    scenario_id: Optional[str] = None
    global_tolerance: float = 10.0


class PlayRequest(BaseModel):
    tick_interval: float = 1.0


# ---------------------------------------------------------------------------
# Stations
# ---------------------------------------------------------------------------

@app.get("/stations")
def get_stations():
    """List all available compiled stations."""
    return _manager.list_stations()


@app.get("/stations/{station_id}")
def get_station(station_id: str):
    station = _manager.get_loaded_station(station_id)
    if station is None:
        raise HTTPException(404, f"Station '{station_id}' not found")
    return station.to_manifest()


@app.get("/stations/{station_id}/hierarchy")
def get_station_hierarchy(station_id: str):
    station = _manager.get_loaded_station(station_id)
    if station is None:
        raise HTTPException(404, f"Station '{station_id}' not found")
    return station.hierarchy_list


@app.get("/stations/{station_id}/connections")
def get_station_connections(station_id: str):
    station = _manager.get_loaded_station(station_id)
    if station is None:
        raise HTTPException(404, f"Station '{station_id}' not found")
    return [c.model_dump() for c in station.runtime_connections]


@app.get("/stations/{station_id}/runtime")
def get_station_runtime(station_id: str):
    """
    Get initial runtime component state for this station.
    This represents the default (un-simulated) component.json values.
    """
    station = _manager.get_loaded_station(station_id)
    if station is None:
        raise HTTPException(404, f"Station '{station_id}' not found")
    return [c.model_dump() for c in station.runtime_components]


# ---------------------------------------------------------------------------
# Scenarios (stubs — full implementation in Phase 17)
# ---------------------------------------------------------------------------

@app.get("/stations/{station_id}/scenarios")
def get_station_scenarios(station_id: str):
    return []


@app.post("/stations/{station_id}/scenarios")
def create_scenario(station_id: str, payload: Dict[str, Any]):
    return {"id": "new-scenario", "station_id": station_id}


@app.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    return {"id": scenario_id}


@app.put("/scenarios/{scenario_id}")
def update_scenario(scenario_id: str, payload: Dict[str, Any]):
    return {"id": scenario_id, "status": "updated"}


@app.post("/scenarios/{scenario_id}/duplicate")
def duplicate_scenario(scenario_id: str):
    return {"id": f"{scenario_id}-copy"}


@app.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: str):
    return {"status": "deleted"}


@app.post("/scenarios/{scenario_id}/validate")
def validate_scenario(scenario_id: str):
    return {"valid": True, "errors": []}


@app.get("/scenarios/{scenario_id}/source")
def get_scenario_source(scenario_id: str):
    return {"source": ""}


@app.put("/scenarios/{scenario_id}/source")
def update_scenario_source(scenario_id: str, payload: Dict[str, str]):
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# Event Definitions (stubs — full implementation in Phase 17)
# ---------------------------------------------------------------------------

@app.get("/event-definitions")
def get_event_definitions():
    return []


@app.get("/event-definitions/{name}")
def get_event_definition(name: str):
    return {"name": name}


# ---------------------------------------------------------------------------
# Simulations
# ---------------------------------------------------------------------------

@app.post("/simulations", status_code=201)
def create_simulation(req: CreateSimulationRequest):
    """
    Create a new simulation run for a registered station.
    The station must already be loaded (auto-discovered on startup).
    """
    try:
        run_id = _manager.create_run(
            station_id=req.station_id,
            scenario_id=req.scenario_id,
            global_tolerance=req.global_tolerance,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"runId": run_id, "status": RunStatus.IDLE}


@app.get("/simulations")
def list_simulations():
    return _manager.list_runs()


@app.get("/simulations/{run_id}")
def get_simulation(run_id: str):
    rec = _manager.get_run(run_id)
    if rec is None:
        raise HTTPException(404, "Simulation not found")
    return rec.summary()


@app.post("/simulations/{run_id}/play")
def play_simulation(run_id: str, req: PlayRequest = PlayRequest()):
    """Start or resume continuous tick-based execution."""
    rec = _manager.get_run(run_id)
    if rec is None:
        raise HTTPException(404, "Simulation not found")
    if rec.status == RunStatus.PAUSED:
        _manager.resume(run_id)
    else:
        _manager.play(run_id, tick_interval=req.tick_interval)
    return {"status": rec.status}


@app.post("/simulations/{run_id}/pause")
def pause_simulation(run_id: str):
    if not _manager.pause(run_id):
        raise HTTPException(404, "Simulation not found")
    rec = _manager.get_run(run_id)
    return {"status": rec.status}


@app.post("/simulations/{run_id}/step")
def step_simulation(run_id: str):
    """Execute exactly one simulation tick (useful for manual stepping)."""
    rec = _manager.get_run(run_id)
    if rec is None:
        raise HTTPException(404, "Simulation not found")
    ok = _manager.step(run_id)
    if not ok:
        raise HTTPException(409, "Cannot step a running simulation; pause it first")
    return {"status": "stepped", "simulation_time": rec.engine.time}


@app.post("/simulations/{run_id}/reset")
def reset_simulation(run_id: str):
    """Stop and reset the simulation to initial state."""
    if not _manager.reset(run_id):
        raise HTTPException(404, "Simulation not found")
    return {"status": "reset"}


@app.post("/simulations/{run_id}/telemetry/start")
def start_telemetry(run_id: str):
    """
    Enable telemetry publishing for this run.
    From this point, every tick will produce a telemetry record that can be
    flushed to the database via /telemetry/flush.
    """
    if not _manager.start_telemetry(run_id):
        raise HTTPException(404, "Simulation not found")
    return {"telemetry": "started", "run_id": run_id}


@app.post("/simulations/{run_id}/telemetry/stop")
def stop_telemetry(run_id: str):
    """
    Disable telemetry publishing.
    The simulation continues running; only persistence stops.
    """
    if not _manager.stop_telemetry(run_id):
        raise HTTPException(404, "Simulation not found")
    return {"telemetry": "stopped", "run_id": run_id}


@app.post("/simulations/{run_id}/telemetry/flush")
def flush_telemetry(run_id: str):
    """Persist all buffered engine telemetry records to the database."""
    if _manager.get_run(run_id) is None:
        raise HTTPException(404, "Simulation not found")
    count = _manager.flush_telemetry(run_id)
    return {"flushed": count, "run_id": run_id}


@app.get("/simulations/{run_id}/state")
def get_simulation_state(run_id: str):
    """
    Get the current effective simulation state (components + connections + external).
    Values come from the live engine state, not the database.
    """
    state = _manager.get_state(run_id)
    if state is None:
        raise HTTPException(404, "Simulation not found")
    return state


@app.get("/simulations/{run_id}/log")
def get_simulation_log(run_id: str):
    """Return the in-memory telemetry buffer (not yet persisted)."""
    log = _manager.get_log(run_id)
    if log is None:
        raise HTTPException(404, "Simulation not found")
    # Serialise engine telemetry for JSON response
    return [
        {
            "time": r["time"],
            "persistence_time": r["persistence_time"],
            "source": r.get("source", "SIMULATION"),
            "component_count": len(r.get("components", [])),
            "connection_count": len(r.get("connections", [])),
        }
        for r in log
    ]


# ---------------------------------------------------------------------------
# Telemetry (DB queries)
# ---------------------------------------------------------------------------

@app.get("/telemetry")
def get_telemetry(run_id: Optional[str] = None):
    """Get the latest persisted telemetry record, optionally filtered by run_id."""
    if run_id:
        record = _manager.get_persisted_telemetry(run_id)
        if record:
            return record
        return {}
    return {}


@app.get("/telemetry/runs")
def get_telemetry_runs():
    """List all runs that have persisted telemetry records."""
    return _manager.list_runs()


@app.get("/telemetry/records/{run_id}/latest")
def get_latest_telemetry(run_id: str):
    """Get the most recent persisted telemetry record for a run."""
    record = _manager.get_persisted_telemetry(run_id)
    if record is None:
        raise HTTPException(404, "No telemetry found for this run")
    return record
