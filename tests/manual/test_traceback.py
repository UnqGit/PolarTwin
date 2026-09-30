import asyncio
from twin_sim.api.main import app
from fastapi.testclient import TestClient
import time
import traceback

with TestClient(app) as client:
    sm_payload = {
        'name': f'gen_fail_{int(time.time())}',
        'source': 'event:failure @MainGenerator at=0.5 for=2.0\n'
    }
    res_scen = client.post('/stations/Maitri/scenarios', json=sm_payload)
    scenario_id = res_scen.json()['id']

    req = {
        'station_id': 'Maitri',
        'scenario_id': scenario_id,
        'global_tolerance': 20.0,
    }
    res = client.post('/simulations', json=req)
    run_id = res.json()['runId']

    client.post(f'/simulations/{run_id}/telemetry/start')

    for i in range(300):
        res = client.post(f'/simulations/{run_id}/step')
        if res.status_code != 200:
            print(f"Step {i} failed: {res.text}")
            break
