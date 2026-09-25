import unittest
import os
import json
from twin_sim.telemetry.database import TelemetryDatabase
from twin_sim.ingestion.models import RuntimeComponent, RuntimeConnection, ExternalModel, WeatherModel, NetworkModel

class TestTelemetryDatabase(unittest.TestCase):
    def test_insert_and_retrieve(self):
        db = TelemetryDatabase(":memory:")
        
        comp1 = RuntimeComponent(name="Gen1", type="generator", is_backup=False, status="active", value={"power": 100})
        conn1 = RuntimeConnection(source="Gen1", target="Grid", type="power", status="active")
        ext = ExternalModel(
            weather=WeatherModel(temperature=-10.0, wind_speed=5.0, humidity=50, o2_level=21, co2_level=0, wind_direction=180, visibility=1000, pressure=1000, dew_frost_point=-15),
            network=NetworkModel(bandwidth=100, mainland_connectivity=True, upload_window=False, upload_speed=10, download_speed=10),
            supplies=[]
        )
        
        records = [{
            "time": 1.0,
            "persistence_time": 1000.0,
            "components": [comp1],
            "connections": [conn1],
            "external": ext
        }]
        
        db.insert_telemetry_batch("run-123", "station-abc", "SIMULATION", records)
        
        latest = db.get_latest_record("run-123")
        self.assertEqual(latest["time"], 1.0)
        self.assertEqual(len(latest["components"]), 1)
        self.assertEqual(latest["components"][0]["component_name"], "Gen1")
        self.assertEqual(latest["components"][0]["value_json"]["power"], 100)
        
        self.assertEqual(len(latest["connections"]), 1)
        self.assertEqual(latest["connections"][0]["source_name"], "Gen1")
        
        self.assertEqual(latest["external"]["network"]["bandwidth"], 100)

if __name__ == "__main__":
    unittest.main()
