import requests
import time

API_BASE = "http://127.0.0.1:8000"

def test_flow():
    # 1. Create scenario
    r = requests.post(f"{API_BASE}/stations/Maitri/scenarios", json={
        "name": "AuditScenario3",
        "source": "event:failure @Gen1 at=2.0 for=5.0\nevent:offline @SensorArray at=5.0 for=2.0"
    })
    scenario_id = r.json()["id"]
    print("Created Scenario:", scenario_id)

    # 2. Create simulation
    r = requests.post(f"{API_BASE}/simulations", json={
        "station_id": "Maitri",
        "scenario_id": scenario_id,
        "global_tolerance": 10.0
    })
    run_id = r.json()["runId"]
    print("Created Run:", run_id)

    # 3. Enable telemetry
    requests.post(f"{API_BASE}/simulations/{run_id}/telemetry/start")
    print("Started Telemetry")

    # 4. Play simulation
    r = requests.post(f"{API_BASE}/simulations/{run_id}/play", json={"tick_interval": 0.05})
    print("Played Simulation")

    # 5. Wait for simulation to run past tick 10 (which is time 10.0)
    for _ in range(10):
        time.sleep(1)
        r = requests.get(f"{API_BASE}/simulations/{run_id}/state")
        t = r.json().get("time", 0)
        print("Time:", t)
        if t >= 10.0:
            break
            
    # 6. Flush telemetry
    requests.post(f"{API_BASE}/simulations/{run_id}/telemetry/flush")
    print("Flushed Telemetry")

    # 7. Check History API
    r = requests.get(f"{API_BASE}/telemetry/runs/{run_id}/events")
    print("Events:", r.json())

test_flow()
