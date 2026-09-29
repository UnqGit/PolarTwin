import sqlite3
import requests
import json
import time

API_URL = 'http://localhost:8000'

def test():
    sm_payload = {
        'name': f'gen_fail_{int(time.time())}',
        'source': 'event:failure @MainGenerator at=0.5 for=2.0\n'
    }
    res_scen = requests.post(f'{API_URL}/stations/Maitri/scenarios', json=sm_payload)
    if res_scen.status_code != 201:
        print("Error creating scenario:", res_scen.text)
        return
        
    scenario_id = res_scen.json()['id']
    
    req = {
        'station_id': 'Maitri',
        'scenario_id': scenario_id,
        'global_tolerance': 20.0,
    }
    res = requests.post(f'{API_URL}/simulations', json=req).json()
    run_id = res['runId']
    print(f'Started run {run_id}')
    
    requests.post(f'{API_URL}/simulations/{run_id}/telemetry/start')
    
    for i in range(300):
        res = requests.post(f'{API_URL}/simulations/{run_id}/step')
        if res.status_code != 200:
            print("Step failed:", res.text)
            return

    requests.post(f'{API_URL}/simulations/{run_id}/stop')
    res_flush = requests.post(f'{API_URL}/simulations/{run_id}/telemetry/flush')
    if res_flush.status_code != 200:
        print("Flush failed:", res_flush.text)
        return
        
    hist_res = requests.get(f'{API_URL}/telemetry/runs/{run_id}/components/MainGenerator/history')
    if hist_res.status_code != 200:
        print("History failed:", hist_res.text)
        return
        
    hist_res = hist_res.json()
    print(f"Returned {len(hist_res)} points")
    for pt in hist_res[::50]:
        print(f"Time: {pt['time']:.3f} | Status: {pt['status']} | Value: {pt['value']}")
        
if __name__ == '__main__':
    test()
