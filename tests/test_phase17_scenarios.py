"""
test_phase17_scenarios.py — Comprehensive tests for Phase 17 (Scenario & Event Endpoints).
"""

import tempfile
from pathlib import Path
import unittest

from fastapi.testclient import TestClient

from twin_sim.api.main import app, _scenario_manager


class TestScenarioEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a temp directory for the data_dir
        cls.tmp_dir = tempfile.TemporaryDirectory()
        cls.data_dir = Path(cls.tmp_dir.name)
        
        # Override the scenario manager's data_dir
        _scenario_manager.data_dir = cls.data_dir
        _scenario_manager.source_dir = cls.data_dir / "source"
        _scenario_manager.events_dir = cls.data_dir / "events"
        _scenario_manager.events_dir.mkdir(parents=True, exist_ok=True)
        
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp_dir.cleanup()

    def setUp(self):
        # Clear out source dir before each test
        if _scenario_manager.source_dir.exists():
            import shutil
            shutil.rmtree(_scenario_manager.source_dir)
        _scenario_manager.source_dir.mkdir(parents=True, exist_ok=True)

    def test_create_and_list_scenarios(self):
        # List should be empty
        r = self.client.get("/stations/Maitri/scenarios")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 0)
        
        # Create
        r = self.client.post("/stations/Maitri/scenarios", json={
            "name": "TestScenario",
            "source": "event:failure @Gen1 at=1.0 for=2.0"
        })
        self.assertEqual(r.status_code, 201)
        scenario_id = r.json()["id"]
        self.assertEqual(scenario_id, "Maitri:TestScenario")
        
        # List should have 1
        r = self.client.get("/stations/Maitri/scenarios")
        self.assertEqual(r.status_code, 200)
        scenarios = r.json()
        self.assertEqual(len(scenarios), 1)
        self.assertEqual(scenarios[0]["name"], "TestScenario")

    def test_get_and_update_scenario(self):
        # Create
        r = self.client.post("/stations/Maitri/scenarios", json={
            "name": "TestScenario",
            "source": "event:failure @Gen1 at=1.0 for=2.0"
        })
        scenario_id = r.json()["id"]
        
        # Get metadata
        r = self.client.get(f"/scenarios/{scenario_id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["name"], "TestScenario")
        
        # Get source
        r = self.client.get(f"/scenarios/{scenario_id}/source")
        self.assertEqual(r.status_code, 200)
        self.assertIn("event:failure", r.json()["source"])
        
        # Update source
        r = self.client.put(f"/scenarios/{scenario_id}/source", json={
            "source": "event:network_outage at=0.0 for=inf"
        })
        self.assertEqual(r.status_code, 200)
        
        # Verify update
        r = self.client.get(f"/scenarios/{scenario_id}/source")
        self.assertIn("event:network_outage", r.json()["source"])

    def test_duplicate_and_delete_scenario(self):
        r = self.client.post("/stations/Maitri/scenarios", json={
            "name": "ToDuplicate",
            "source": "event:something at=1.0 for=1.0"
        })
        scenario_id = r.json()["id"]
        
        # Duplicate
        r = self.client.post(f"/scenarios/{scenario_id}/duplicate")
        self.assertEqual(r.status_code, 201)
        new_id = r.json()["id"]
        self.assertEqual(new_id, "Maitri:ToDuplicate_copy")
        
        # Delete original
        r = self.client.delete(f"/scenarios/{scenario_id}")
        self.assertEqual(r.status_code, 204)
        
        # List
        r = self.client.get("/stations/Maitri/scenarios")
        scenarios = r.json()
        self.assertEqual(len(scenarios), 1)
        self.assertEqual(scenarios[0]["id"], new_id)

    def test_validate_scenario(self):
        # Create valid
        r = self.client.post("/stations/Maitri/scenarios", json={
            "name": "ValidScenario",
            "source": "event:failure @Gen1 at=1.0 for=2.0"
        })
        valid_id = r.json()["id"]
        
        r = self.client.post(f"/scenarios/{valid_id}/validate")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["valid"])
        self.assertEqual(r.json()["parsed_event_count"], 1)
        
        # Create invalid
        r = self.client.post("/stations/Maitri/scenarios", json={
            "name": "InvalidScenario",
            "source": "this is not a valid scene file"
        })
        invalid_id = r.json()["id"]
        
        r = self.client.post(f"/scenarios/{invalid_id}/validate")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["valid"])
        self.assertGreater(len(r.json()["errors"]), 0)


class TestEventDefinitionsEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = tempfile.TemporaryDirectory()
        cls.data_dir = Path(cls.tmp_dir.name)
        _scenario_manager.data_dir = cls.data_dir
        _scenario_manager.source_dir = cls.data_dir / "source"
        _scenario_manager.events_dir = cls.data_dir / "events"
        _scenario_manager.events_dir.mkdir(parents=True, exist_ok=True)
        
        # Create some event files manually (API is read-only for event definitions)
        (cls.data_dir / "events" / "failure.event").write_text("set status=failure", encoding="utf-8")
        
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.tmp_dir.cleanup()

    def test_list_and_get_events(self):
        r = self.client.get("/event-definitions")
        self.assertEqual(r.status_code, 200)
        events = r.json()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["name"], "failure")
        
        r = self.client.get("/event-definitions/failure")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["source"], "set status=failure")
        
        r = self.client.get("/event-definitions/nonexistent")
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
