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
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from twin_sim.api.manager import RunStatus, SimulationManager
from twin_sim.api.scenario_manager import ScenarioManager
from twin_sim.simulation.station_loader import StationLoader
from twin_sim.telemetry.database import TelemetryDatabase

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(_PROJECT_ROOT / "data")))
COMPILED_ROOT = DATA_DIR / "compiled"

if os.getenv("VERCEL") == "1":
    DB_PATH = Path("/tmp/telemetry.db")
else:
    DB_PATH = DATA_DIR / "telemetry.db"

# ---------------------------------------------------------------------------
# Application bootstrap
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Auto-discover and register all compiled stations on startup."""
    from twin_sim.api.migrate import migrate_old_files_to_db

    migrate_old_files_to_db(_db, DATA_DIR)

    station_names = StationLoader.list_stations(COMPILED_ROOT)
    for name in station_names:
        try:
            station = StationLoader.load(COMPILED_ROOT / name)
            _manager.register_station(station)
        except Exception as exc:  # noqa: BLE001
            print(f"[warning] Could not load station '{name}': {exc}")
    print(f"[startup] Loaded {len(station_names)} station(s): {station_names}")
    yield


app = FastAPI(title="PolarTwin Backend API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
_db = TelemetryDatabase(str(DB_PATH))
_manager = SimulationManager(telemetry_db=_db)
_scenario_manager = ScenarioManager(_db)


@app.get("/")
def read_root():
    return {
        "name": "PolarTwin Backend API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------


class CreateSimulationRequest(BaseModel):
    station_id: str
    scenario_id: str | None = None
    global_tolerance: float = 10.0
    value_overrides: dict[str, dict[str, Any]] | None = None


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


@app.get("/stations/{station_id}/spec")
def get_station_spec(station_id: str):
    station = _manager.get_loaded_station(station_id)
    if station is None:
        raise HTTPException(404, f"Station '{station_id}' not found")
    return station.specs_list


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
# Scenarios
# ---------------------------------------------------------------------------


class CreateScenarioRequest(BaseModel):
    name: str
    source: str = ""


class UpdateScenarioSourceRequest(BaseModel):
    source: str

class RenameRequest(BaseModel):
    name: str


@app.get("/stations/{station_id}/scenarios")
def get_station_scenarios(station_id: str):
    return _scenario_manager.list_for_station(station_id)


@app.post("/stations/{station_id}/scenarios", status_code=201)
def create_scenario(station_id: str, payload: CreateScenarioRequest):
    try:
        return _scenario_manager.create(station_id, payload.name, payload.source)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    try:
        return _scenario_manager.get(scenario_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/scenarios/{scenario_id}/duplicate", status_code=201)
def duplicate_scenario(scenario_id: str):
    try:
        return _scenario_manager.duplicate(scenario_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/scenarios/{scenario_id}", status_code=204)
def delete_scenario(scenario_id: str):
    try:
        _scenario_manager.delete(scenario_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/scenarios/{scenario_id}/validate")
def validate_scenario(scenario_id: str):
    try:
        return _scenario_manager.validate(scenario_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/scenarios/{scenario_id}/source")
def get_scenario_source(scenario_id: str):
    try:
        return {"source": _scenario_manager.get_source(scenario_id)}
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.put("/scenarios/{scenario_id}/source")
def update_scenario_source(scenario_id: str, payload: UpdateScenarioSourceRequest):
    try:
        return _scenario_manager.update_source(scenario_id, payload.source)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.put("/scenarios/{scenario_id}/rename")
def rename_scenario(scenario_id: str, payload: RenameRequest):
    try:
        return _scenario_manager.rename_scenario(scenario_id, payload.name)
    except (FileNotFoundError, ValueError) as e:
        status_code = 404 if isinstance(e, FileNotFoundError) else 400
        raise HTTPException(status_code, str(e))


@app.get("/scenarios/{scenario_id}/events")
def get_scenario_events(scenario_id: str):
    try:
        events = _scenario_manager.get_parsed_events(scenario_id)
        # SceneEvent has event_ref, selector, at, duration, payload
        return [
            {
                "event_ref": e.event_ref,
                "selector": e.selector,
                "at": e.at,
                "duration": None if e.duration == float("inf") else e.duration,
                "payload": e.payload,
                "source_location": getattr(e, "source_location", 0),
                "source_order": getattr(e, "source_order", 0),
            }
            for e in events
        ]
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:  # noqa: BLE001
        if hasattr(e, "line_number") and e.line_number is not None:
            raise HTTPException(
                400,
                detail={
                    "message": str(e),
                    "line_number": e.line_number - 1,
                },
            )
        raise HTTPException(400, detail={"message": f"Error parsing scenario: {e}"})


class ParseScenarioRequest(BaseModel):
    source: str


@app.post("/scenarios/parse")
def parse_scenario_raw(payload: ParseScenarioRequest):
    try:
        from twin_sim.dsl.scene_parser import parse_scene_string

        events = parse_scene_string(payload.source)
        return [
            {
                "event_ref": e.event_ref,
                "selector": e.selector,
                "at": e.at,
                "duration": None if e.duration == float("inf") else e.duration,
                "payload": e.payload,
                "source_location": getattr(e, "source_location", 0),
                "source_order": getattr(e, "source_order", 0),
            }
            for e in events
        ]
    except Exception as e:  # noqa: BLE001
        if hasattr(e, "line_number") and e.line_number is not None:
            raise HTTPException(
                400,
                detail={
                    "message": str(e),
                    "line_number": e.line_number - 1,
                },
            )
        raise HTTPException(400, detail={"message": f"Error parsing scenario: {e}"})


# ---------------------------------------------------------------------------
# Event Definitions
# ---------------------------------------------------------------------------


@app.get("/stations/{station_id}/event-definitions")
def get_event_definitions(station_id: str):
    return _scenario_manager.list_events(station_id)


@app.get("/event-definitions/{event_id}")
def get_event_definition(event_id: str):
    try:
        return _scenario_manager.get_event(event_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


class EventUpdatePayload(BaseModel):
    source: str


@app.post("/stations/{station_id}/event-definitions/{name}")
def create_event_definition(station_id: str, name: str):
    try:
        return _scenario_manager.create_event(station_id, name)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.put("/event-definitions/{event_id}")
def update_event_definition(event_id: str, payload: EventUpdatePayload):
    try:
        return _scenario_manager.update_event(event_id, payload.source)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.delete("/event-definitions/{event_id}", status_code=204)
def delete_event_definition(event_id: str):
    try:
        _scenario_manager.delete_event(event_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

@app.put("/event-definitions/{event_id}/rename")
def rename_event_definition(event_id: str, payload: RenameRequest):
    try:
        return _scenario_manager.rename_event(event_id, payload.name)
    except (FileNotFoundError, ValueError) as e:
        status_code = 404 if isinstance(e, FileNotFoundError) else 400
        raise HTTPException(status_code, str(e))


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
        scenes = []
        if req.scenario_id:
            try:
                scenes = _scenario_manager.get_parsed_events(req.scenario_id)
            except FileNotFoundError:
                raise HTTPException(404, f"Scenario '{req.scenario_id}' not found")
            except Exception as e:  # noqa: BLE001
                raise HTTPException(400, f"Error parsing scenario: {e}")

        run_id = _manager.create_run(
            station_id=req.station_id,
            scenario_id=req.scenario_id,
            scenes=scenes,
            global_tolerance=req.global_tolerance,
            value_overrides=req.value_overrides,
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
def play_simulation(run_id: str, req: PlayRequest = PlayRequest()):  # noqa: B008
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
    if not rec:
        raise HTTPException(404, "Simulation not found")
    return {"status": rec.status}


@app.post("/simulations/{run_id}/stop")
def stop_simulation(run_id: str):
    """Stop the simulation (sets to FINISHED without resetting time)."""
    if not _manager.stop_run(run_id):
        raise HTTPException(404, "Simulation not found")
    return {"status": "stopped"}


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


@app.delete("/simulations/{run_id}", status_code=204)
def delete_simulation(run_id: str):
    """Delete a simulation run."""
    _manager.delete_run(run_id)
    if not _db.delete_run(run_id):
        raise HTTPException(404, "Simulation not found")

@app.delete("/scenarios/{scenario_id}/runs", status_code=204)
def delete_scenario_runs(scenario_id: str):
    """Delete all simulation runs for a scenario."""
    active_runs = _manager.list_runs()
    for r in active_runs:
        if r["scenario_id"] == scenario_id:
            _manager.delete_run(r["run_id"])
    _db.delete_scenario_runs(scenario_id)


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
    # Return logs directly, they are already simple dicts
    return log


# ---------------------------------------------------------------------------
# Telemetry (DB queries)
# ---------------------------------------------------------------------------


@app.get("/telemetry")
def get_telemetry(run_id: str | None = None):
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
    return _db.get_all_runs()


@app.get("/telemetry/records/{run_id}/latest")
def get_latest_telemetry(run_id: str):
    """Get the most recent persisted telemetry record for a run."""
    record = _manager.get_persisted_telemetry(run_id)
    if record is None:
        raise HTTPException(404, "No telemetry found for this run")
    return record


@app.get("/telemetry/history")
def get_telemetry_history(station_id: str, run_id: str | None = None):
    """Get the timeline of telemetry records for a station."""
    return _db.get_records_timeline(station_id, run_id)


@app.get("/telemetry/records/{record_id}")
def get_telemetry_record(record_id: int):
    """Get a specific telemetry record by ID."""
    rec = _db.get_record_by_id(record_id)
    if not rec:
        raise HTTPException(404, "Record not found")
    return rec


@app.delete("/telemetry/records/{record_id}", status_code=204)
def delete_telemetry_record(record_id: int):
    """Delete a specific telemetry record by ID."""
    if not _db.get_record_by_id(record_id):
        raise HTTPException(404, "Record not found")
    _db.delete_record(record_id)


@app.get("/telemetry/runs/{run_id}/metadata")
def get_run_metadata(run_id: str):
    meta = _db.get_run_metadata(run_id)
    if not meta:
        raise HTTPException(404, "Run metadata not found in database")
    return meta


@app.get("/telemetry/runs/{run_id}/components/{component_id}/history")
def get_component_history(run_id: str, component_id: str):
    return _db.get_component_history(run_id, component_id)


@app.get("/telemetry/runs/{run_id}/connections/{connection_id}/history")
def get_connection_history(run_id: str, connection_id: str):
    return _db.get_connection_history(run_id, connection_id)


@app.get("/telemetry/runs/{run_id}/external/history")
def get_external_history(run_id: str):
    return _db.get_external_history(run_id)


@app.get("/telemetry/runs/{run_id}/events")
def get_run_events(run_id: str):
    return _db.get_run_events(run_id)


class GlobalToleranceRequest(BaseModel):
    value: float


@app.post("/simulations/{run_id}/tolerance/global")
def set_global_tolerance(run_id: str, req: GlobalToleranceRequest):
    rec = _manager.get_run(run_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Run not found")

    # Engine should have global_tolerance attribute
    rec.engine.global_tolerance = req.value
    return {"status": "ok", "global_tolerance": req.value}


class ComponentToleranceRequest(BaseModel):
    value: float


@app.post("/simulations/{run_id}/tolerance/component/{component_id}")
def set_component_tolerance(
    run_id: str, component_id: str, req: ComponentToleranceRequest
):
    rec = _manager.get_run(run_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Run not found")

    if component_id not in rec.engine.state.base_components:
        raise HTTPException(status_code=404, detail="Component not found in simulation")

    comp = rec.engine.state.base_components[component_id]

    # Update specification's tolerance
    comp.value["tolerance"] = req.value
    return {"status": "ok", "component": component_id, "tolerance": req.value}


@app.post("/simulations/{run_id}/component/{component_id}/state")
def set_component_state(run_id: str, component_id: str, updates: dict = Body(...)):  # noqa: B008
    rec = _manager.get_run(run_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Run not found")

    if component_id not in rec.engine.state.base_components:
        raise HTTPException(status_code=404, detail="Component not found in simulation")

    # Update state fields
    comp = rec.engine.state.base_components[component_id]
    for k, v in updates.items():
        comp.value[k] = v

    return {"status": "ok", "component": component_id, "updates": updates}
