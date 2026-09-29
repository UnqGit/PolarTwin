import requests
import time
import uuid

API = "http://127.0.0.1:8000"

# Get station
stations = requests.get(f"{API}/stations").json()
st_id = stations[0]['station_id']

# Create scenario
sc = requests.post(f"{API}/stations/{st_id}/scenarios", json={
    "name": f"test_active_{uuid.uuid4().hex[:8]}",
    "source": "event:foo at=0.0 for=5.0 set value.voltage=500 where @Gen1"
}).json()
sc_id = sc.get('id', sc.get('scenario_id'))

# Start simulation
sim = requests.post(f"{API}/simulations", json={
    "station_id": st_id,
    "scenario_id": sc_id,
    "global_tolerance": 10.0
}).json()
run_id = sim['runId']

print("Run ID:", run_id)
requests.post(f"{API}/simulations/{run_id}/play")

time.sleep(2)
requests.post(f"{API}/simulations/{run_id}/pause")
state = requests.get(f"{API}/simulations/{run_id}/state").json()
print("Time:", state['simulation_time'])
print("Active Events:", state['active_events'])
print("Upcoming Events:", state['upcoming_events'])

requests.post(f"{API}/simulations/{run_id}/stop")
