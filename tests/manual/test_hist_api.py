import requests

API_URL = 'http://localhost:8000'
run_id = 'Maitrigen_fail_17906967041'

hist_res = requests.get(f'{API_URL}/telemetry/runs/{run_id}/components/MainGenerator/history').json()
print(f"Returned {len(hist_res)} points")
for pt in hist_res[::50]:
    print(f"Time: {pt['time']:.3f} | Status: {pt['status']} | Value: {pt['value']}")
