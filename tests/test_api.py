import unittest
from fastapi.testclient import TestClient
from twin_sim.api.main import app

class TestBackendAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_stations_routes(self):
        response = self.client.get("/stations")
        self.assertEqual(response.status_code, 200)
        
        response = self.client.get("/stations/123")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": "123"})
        
        response = self.client.get("/stations/123/runtime")
        self.assertEqual(response.status_code, 200)

    def test_scenarios_routes(self):
        response = self.client.get("/stations/123/scenarios")
        self.assertEqual(response.status_code, 200)
        
        response = self.client.post("/stations/123/scenarios", json={"name": "test"})
        self.assertEqual(response.status_code, 200)
        
        response = self.client.put("/scenarios/456", json={"name": "updated"})
        self.assertEqual(response.status_code, 200)

    def test_event_definition_routes(self):
        response = self.client.get("/event-definitions")
        self.assertEqual(response.status_code, 200)
        
        response = self.client.get("/event-definitions/failure")
        self.assertEqual(response.status_code, 200)

    def test_simulations_routes(self):
        response = self.client.post("/simulations", json={"station_id": "123"})
        self.assertEqual(response.status_code, 200)
        run_id = response.json()["runId"]
        
        response = self.client.post(f"/simulations/{run_id}/play")
        self.assertEqual(response.status_code, 200)
        
        response = self.client.post(f"/simulations/{run_id}/telemetry/start")
        self.assertEqual(response.status_code, 200)
        
        response = self.client.get(f"/simulations/{run_id}/state")
        self.assertEqual(response.status_code, 200)

    def test_telemetry_routes(self):
        response = self.client.get("/telemetry")
        self.assertEqual(response.status_code, 200)
        
        response = self.client.get("/telemetry/runs")
        self.assertEqual(response.status_code, 200)

if __name__ == "__main__":
    unittest.main()
