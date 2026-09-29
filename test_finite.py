import requests
import json
import time

res = requests.post("http://127.0.0.1:8000/stations/Maitri/scenarios", json={"name": "test2", "source": "event:Override at=0.0 for=10.0 set value.temperature=99.0 target=@Generator"})
scenario_id = res.json()["id"]

res = requests.post(f"http://127.0.0.1:8000/simulations", json={"station_id": "Maitri", "scenario_id": scenario_id, "tick_rate": 20.0})
if "runId" in res.json():
    run_id = res.json()["runId"]
else:
    run_id = res.json()["run_id"]

requests.post(f"http://127.0.0.1:8000/simulations/{run_id}/play", json={"speed": 1.0})
time.sleep(1)
requests.post(f"http://127.0.0.1:8000/simulations/{run_id}/pause")

res = requests.get(f"http://127.0.0.1:8000/simulations/{run_id}")
print("EVENTS:")
print(json.dumps(res.json()["active_events"], indent=2))
