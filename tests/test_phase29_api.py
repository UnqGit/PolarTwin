import time
import pytest
from fastapi.testclient import TestClient

from twin_sim.api.server import app, manager


from pathlib import Path
from twin_sim.ingestion.validator import load_json

EXAMPLES = Path(__file__).resolve().parent.parent / "examples" / "minimal"

@pytest.fixture
def client():
    manager._runs.clear()
    return TestClient(app)

def _get_minimal_payload():
    return {
        "topology": load_json(EXAMPLES / "topology.json"),
        "specification": load_json(EXAMPLES / "specification.json"),
    }

def test_create_and_manage_run(client):
    payload = _get_minimal_payload()
    payload["config"] = {"tick_interval": 0.1, "time_scale": 1.0}
    
    # 1. Create Run
    response = client.post("/runs", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert "run_id" in data
    assert data["status"] == "running"
    run_id = data["run_id"]
    
    # 2. Get Run
    time.sleep(0.2)  # give it time to start ticking
    response = client.get(f"/runs/{run_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["run_id"] == run_id
    assert data["status"] == "running"
    
    # 3. Pause Run
    response = client.post(f"/runs/{run_id}/pause")
    assert response.status_code == 200
    assert response.json()["status"] == "paused"
    
    # Verify paused
    response = client.get(f"/runs/{run_id}")
    assert response.json()["status"] == "paused"
    
    # 4. Get State
    response = client.get(f"/runs/{run_id}/state")
    assert response.status_code == 200
    state = response.json()["state"]
    assert "Generator" in state
    
    # 5. Inject Event
    response = client.post(f"/runs/{run_id}/events", json={
        "timestamp": 10.0,
        "event": "test_event",
        "target": "Generator"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "event_scheduled"
    
    # 6. Resume Run
    response = client.post(f"/runs/{run_id}/resume")
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    
    # 7. Stop Run
    response = client.post(f"/runs/{run_id}/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "stopped"


def test_get_telemetry(client):
    payload = _get_minimal_payload()
    response = client.post("/runs", json=payload)
    assert response.status_code == 201
    run_id = response.json()["run_id"]
    
    time.sleep(0.1) # wait for a tick
    
    client.post(f"/runs/{run_id}/stop")
    
    response = client.get(f"/runs/{run_id}/telemetry")
    assert response.status_code == 200
    data = response.json()
    assert "telemetry" in data
    assert isinstance(data["telemetry"], list)


def test_invalid_run_id(client):
    response = client.get("/runs/invalid-id")
    assert response.status_code == 404
