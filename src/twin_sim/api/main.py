from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI(title="PolarTwin Backend API", version="1.0.0")

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
    return {"runId": "sim-123"}

@app.get("/simulations/{run_id}")
def get_simulation(run_id: str):
    return {"runId": run_id}

@app.post("/simulations/{run_id}/play")
def play_simulation(run_id: str):
    return {"status": "playing"}

@app.post("/simulations/{run_id}/pause")
def pause_simulation(run_id: str):
    return {"status": "paused"}

@app.post("/simulations/{run_id}/step")
def step_simulation(run_id: str):
    return {"status": "stepped"}

@app.post("/simulations/{run_id}/reset")
def reset_simulation(run_id: str):
    return {"status": "reset"}

@app.post("/simulations/{run_id}/telemetry/start")
def start_telemetry(run_id: str):
    return {"telemetry": "started"}

@app.post("/simulations/{run_id}/telemetry/stop")
def stop_telemetry(run_id: str):
    return {"telemetry": "stopped"}

@app.get("/simulations/{run_id}/state")
def get_simulation_state(run_id: str):
    return {"time": 0.0, "components": [], "connections": []}

@app.get("/simulations/{run_id}/log")
def get_simulation_log(run_id: str):
    return []

# ---------------------------------------------------------
# Telemetry
# ---------------------------------------------------------
@app.get("/telemetry")
def get_telemetry():
    return []

@app.get("/telemetry/runs")
def get_telemetry_runs():
    return []
