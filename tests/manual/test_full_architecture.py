import sqlite3
import requests

API_URL = 'http://localhost:8000'

def test():
    req = {
        'station_id': 'Maitri',
        'scenario_id': 'Maitri:e2e_test_1790691340',
        'global_tolerance': 20.0,
    }
    res = requests.post(f'{API_URL}/simulations', json=req).json()
    run_id = res['runId']
    print(f'Started run {run_id}')
    
    requests.post(f'{API_URL}/simulations/{run_id}/telemetry/start')
    
    # Run 250 steps (250 * 0.00416 = 1.04 hours)
    for i in range(250):
        requests.post(f'{API_URL}/simulations/{run_id}/step')
    
    state = requests.get(f'{API_URL}/simulations/{run_id}/state').json()
    
    print("External Weather Temperature at t=1.04:", state['external']['weather']['temperature'])
            
    requests.post(f'{API_URL}/simulations/{run_id}/stop')
    requests.post(f'{API_URL}/simulations/{run_id}/telemetry/flush')

if __name__ == '__main__':
    test()
