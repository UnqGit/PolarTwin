from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from twin_sim.api.manager import SimulationManager
from twin_sim.telemetry import TelemetryMessage

app = FastAPI(title="PolarTwin Digital Twin API", version="0.1.0")
manager = SimulationManager()

class RunRequest(BaseModel):
    topology: Dict[str, Any]
    specification: Dict[str, Any]
    scenario: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None

class EventRequest(BaseModel):
    id: str = Field(default_factory=lambda: "event-api")
    timestamp: float
    event: str
    target: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    duration: Optional[float] = None

@app.post("/runs", status_code=status.HTTP_201_CREATED)
def create_run(request: RunRequest):
    try:
        run_id = manager.create_run(
            topology=request.topology,
            specification=request.specification,
            scenario=request.scenario,
            config=request.config
        )
        return {"run_id": run_id, "status": "running"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/runs")
def list_runs():
    return {"runs": manager.list_runs()}

@app.get("/runs/{run_id}")
def get_run(run_id: str):
    record = manager.get_run(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "run_id": record.run_id,
        "status": record.engine.status.value,
        "simulation_time": record.engine.simulation_time,
        "tick_count": record.engine.tick_count
    }

@app.post("/runs/{run_id}/pause")
def pause_run(run_id: str):
    if not manager.pause_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "paused"}

@app.post("/runs/{run_id}/resume")
def resume_run(run_id: str):
    if not manager.resume_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "running"}

@app.post("/runs/{run_id}/stop")
def stop_run(run_id: str):
    if not manager.stop_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "stopped"}

@app.get("/runs/{run_id}/state")
def get_run_state(run_id: str):
    state = manager.get_state(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"state": state}

@app.get("/runs/{run_id}/telemetry")
def get_run_telemetry(run_id: str, limit: int = 100):
    telemetry = manager.get_telemetry(run_id)
    if telemetry is None:
        raise HTTPException(status_code=404, detail="Run not found")
    # Return the latest `limit` telemetry items
    return {"telemetry": telemetry[-limit:] if limit > 0 else telemetry}

@app.post("/runs/{run_id}/events")
def inject_event(run_id: str, event_req: EventRequest):
    record = manager.get_run(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")
    
    event_dict = event_req.model_dump(exclude_none=True)
    
    # Schedule the event
    record.engine.schedule(event_req.timestamp, lambda t, p: None, event_dict)
    
    return {"status": "event_scheduled", "event_id": event_req.id}
