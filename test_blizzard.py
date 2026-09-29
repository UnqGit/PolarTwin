import requests
import time

API_URL = 'http://localhost:8000'

def test():
    sm_payload = {
        'name': f'blizz_{int(time.time())}',
        'source': 'event:weather_blizzard at=0.5 for=2.0\n'
    }
    res_scen = requests.post(f'{API_URL}/stations/Maitri/scenarios', json=sm_payload)
    scenario_id = res_scen.json()['id']
    
    req = {
        'station_id': 'Maitri',
        'scenario_id': scenario_id,
        'global_tolerance': 20.0,
    }
    run_id = requests.post(f'{API_URL}/simulations', json=req).json()['runId']
    
    requests.post(f'{API_URL}/simulations/{run_id}/telemetry/start')
    
    for i in range(300):
        res = requests.post(f'{API_URL}/simulations/{run_id}/step')
        if res.status_code != 200:
            print("Step failed:", res.text)
            return

    requests.post(f'{API_URL}/simulations/{run_id}/stop')
    requests.post(f'{API_URL}/simulations/{run_id}/telemetry/flush')
        
    hist_res = requests.get(f'{API_URL}/telemetry/runs/{run_id}/components/EnergyBlock/history').json()
    for pt in hist_res[::50]:
        print(f"Time: {pt['time']:.3f} | Value: {pt['value']}")
        
if __name__ == '__main__':
    test()
