import pytest
from fastapi.testclient import TestClient
from twin_sim.api.main import app

client = TestClient(app)

def test_scenario_comparison_telemetry_endpoints(tmp_path):
    # This test ensures that the endpoints required for scenario comparison (Phase 30)
    # exist and return expected structured data.
    
    # 1. Fetch runs for station
    runs_res = client.get("/telemetry/runs")
    assert runs_res.status_code == 200
    runs = runs_res.json()
    assert isinstance(runs, list)
    
    # We cannot test actual history easily without running a simulation or mocking DB,
    # but we can verify the history endpoint works even if empty.
    hist_res = client.get("/telemetry/history?station_id=test_station")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert isinstance(hist, list)

    # 2. Check if a non-existent run ID history endpoint works without crashing
    hist_filtered_res = client.get("/telemetry/history?station_id=test_station&run_id=nonexistent")
    assert hist_filtered_res.status_code == 200
    assert hist_filtered_res.json() == []

    # 3. Check failure on bad record ID
    rec_res = client.get("/telemetry/records/999999")
    assert rec_res.status_code == 404
