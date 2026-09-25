from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import uuid

from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.simulation.engine_core import SimulationEngineCore
from twin_sim.ingestion.models import ExternalModel, WeatherModel, NetworkModel

app = FastAPI(title="PolarTwin Backend API", version="1.0.0")

# In-memory store for active simulations
SIMULATIONS: Dict[str, SimulationEngineCore] = {}


# ---------------------------------------------------------
# Stations
# ---------------------------------------------------------
@app.get("/stations")
def get_stations():
    return []

@app.get("/stations/{station_id}")
def get_station(station_id: str):
    return {"id": station_id}

@app.get("/stations/{station_id}/model")
def get_station_model(station_id: str):
    return {"id": station_id, "model": {}}

@app.get("/stations/{station_id}/hierarchy")
def get_station_hierarchy(station_id: str):
    return []

@app.get("/stations/{station_id}/connections")
def get_station_connections(station_id: str):
    return []

@app.get("/stations/{station_id}/spec")
def get_station_spec(station_id: str):
    return {}

@app.get("/stations/{station_id}/runtime")
def get_station_runtime(station_id: str):
    return {}

# ---------------------------------------------------------
# Scenarios
# ---------------------------------------------------------
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

# ---------------------------------------------------------
# Event Definitions
# ---------------------------------------------------------
@app.get("/event-definitions")
def get_event_definitions():
    return []

@app.get("/event-definitions/{name}")
def get_event_definition(name: str):
    return {"name": name}

# ---------------------------------------------------------
# Simulations
# ---------------------------------------------------------
@app.post("/simulations")
def create_simulation(payload: Dict[str, Any]):
    run_id = f"sim-{uuid.uuid4().hex[:8]}"
    
    # Initialize a dummy TimelineStateManager for the API for now, 
    # in production this would load real specs based on payload["station_id"]
    ext = ExternalModel(
        weather=WeatherModel(temperature=-10.0, wind_speed=5.0, humidity=50, o2_level=21, co2_level=0, wind_direction=180, visibility=1000, pressure=1000, dew_frost_point=-15),
        network=NetworkModel(bandwidth=100, mainland_connectivity=True, upload_window=False, upload_speed=10, download_speed=10),
        supplies=[]
    )
    state = TimelineStateManager(components=[], connections=[], external=ext)
    engine = SimulationEngineCore(state, [])
    SIMULATIONS[run_id] = engine
    
    return {"runId": run_id}

@app.get("/simulations/{run_id}")
def get_simulation(run_id: str):
    if run_id not in SIMULATIONS:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"runId": run_id, "time": SIMULATIONS[run_id].time}

@app.post("/simulations/{run_id}/play")
def play_simulation(run_id: str):
    if run_id not in SIMULATIONS:
        raise HTTPException(status_code=404, detail="Simulation not found")
    # In a real backend, this would spawn a background worker task.
    # For now, we simulate success.
    return {"status": "playing"}

@app.post("/simulations/{run_id}/pause")
def pause_simulation(run_id: str):
    if run_id not in SIMULATIONS:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"status": "paused"}

@app.post("/simulations/{run_id}/step")
def step_simulation(run_id: str):
    if run_id not in SIMULATIONS:
        raise HTTPException(status_code=404, detail="Simulation not found")
    SIMULATIONS[run_id].run_tick()
    return {"status": "stepped", "time": SIMULATIONS[run_id].time}

@app.post("/simulations/{run_id}/reset")
def reset_simulation(run_id: str):
    if run_id not in SIMULATIONS:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"status": "reset"}

@app.post("/simulations/{run_id}/telemetry/start")
def start_telemetry(run_id: str):
    return {"telemetry": "started"}

@app.post("/simulations/{run_id}/telemetry/stop")
def stop_telemetry(run_id: str):
    return {"telemetry": "stopped"}

@app.get("/simulations/{run_id}/state")
def get_simulation_state(run_id: str):
    if run_id not in SIMULATIONS:
        raise HTTPException(status_code=404, detail="Simulation not found")
        
    engine = SIMULATIONS[run_id]
    eff_state = engine.state.get_effective_state_dict()
    
    return {
        "time": engine.time, 
        "components": [c.model_dump() for c in eff_state["components"]], 
        "connections": eff_state["connections"]
    }

@app.get("/simulations/{run_id}/log")
def get_simulation_log(run_id: str):
    if run_id not in SIMULATIONS:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return SIMULATIONS[run_id].telemetry

# ---------------------------------------------------------
# Telemetry
# ---------------------------------------------------------
@app.get("/telemetry")
def get_telemetry():
    return []

@app.get("/telemetry/runs")
def get_telemetry_runs():
    return []
