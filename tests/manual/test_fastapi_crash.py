from twin_sim.api.main import app
from fastapi.testclient import TestClient

run_id = 'Maitrigen_fail_17907028491'
comp_id = 'MainGenerator'

with TestClient(app) as client:
    res = client.get(f'/telemetry/runs/{run_id}/components/{comp_id}/history')
    print("Status:", res.status_code)
    print("Response:", res.text)
