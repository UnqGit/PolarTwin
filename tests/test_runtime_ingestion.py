import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory
import json

from twin_sim.ingestion.models import (
    to_canonical,
    canonicalize_measurement,
    WeatherModel,
    NetworkModel,
    ExternalModel
)
from twin_sim.ingestion.loaders import initialize_simulation_state

class TestRuntimeIngestion(unittest.TestCase):
    
    def test_unit_conversions(self):
        # Voltage
        self.assertEqual(to_canonical(2000, "mV"), 2.0)
        self.assertEqual(to_canonical(1.5, "kV"), 1500.0)
        # Power
        self.assertEqual(to_canonical(5, "kW"), 5000.0)
        # Energy
        self.assertEqual(to_canonical(1, "kWh"), 3600000.0)
        # Temp
        self.assertAlmostEqual(to_canonical(273.15, "K"), 0.0)
        self.assertAlmostEqual(to_canonical(32, "F"), 0.0)
        # Time / Flowrate
        self.assertEqual(to_canonical(3600, "L/hr"), 1.0)

    def test_canonicalize_measurement_dict(self):
        data = {"value": 100, "unit": "mV"}
        res = canonicalize_measurement(data)
        self.assertEqual(res["value"], 0.1)
        
        data2 = {"min": 0, "max": 100, "unit": "C"}
        res2 = canonicalize_measurement(data2)
        self.assertEqual(res2["max"], 100)
        
    def test_external_model_validation(self):
        data = {
            "weather": {
                "temperature": {"value": 32, "unit": "F"},
                "wind_speed": {"value": 15},
                "humidity": {"value": 50},
                "o2_level": {"value": 21, "unit": "%"},
                "co2_level": {"value": 0.04, "unit": "%"},
                "wind_direction": {"value": 90},
                "visibility": {"value": 10000},
                "pressure": {"value": 1013},
                "dew_frost_point": {"value": -5, "unit": "C"}
            },
            "network": {
                "bandwidth": {"value": 100, "unit": "MHz"},
                "mainland_connectivity": True,
                "upload_window": False,
                "upload_speed": {"value": 1000},
                "download_speed": {"value": 5000}
            },
            "supplies": [
                {
                    "ETA": 5.5,
                    "mode": "air",
                    "description": "Food rations"
                }
            ]
        }
        
        ext = ExternalModel.model_validate(data)
        
        self.assertAlmostEqual(ext.weather.temperature, 0.0)
        self.assertAlmostEqual(ext.weather.o2_level, 0.21)
        self.assertEqual(ext.network.bandwidth, 100000000.0)
        self.assertEqual(len(ext.supplies), 1)

    def test_initialize_simulation_state(self):
        with TemporaryDirectory() as tmp_dir:
            dir_path = Path(tmp_dir)
            h_path = dir_path / "hierarchy.json"
            c_path = dir_path / "connection.json"
            s_path = dir_path / "spec.json"
            
            h_path.write_text(json.dumps([
                {"name": "Gen1", "type": "generator", "is_backup": False}
            ]))
            
            c_path.write_text(json.dumps([
                {"source": "Gen1", "target": "Battery1", "type": "power", "relation": "supply"}
            ]))
            
            s_path.write_text(json.dumps([
                {
                    "name": "Gen1",
                    "type": "generator",
                    "rating": {
                        "output": {
                            "power": {"min": 0, "max": 100, "unit": "kW"}
                        },
                        "state": {
                            "temperature": {"value": 50, "unit": "C"}
                        }
                    },
                    "dimension": {
                        "length": {"value": 2, "unit": "m"}
                    }
                }
            ]))
            
            components, connections, external = initialize_simulation_state(h_path, c_path, s_path)
            
            self.assertEqual(len(components), 1)
            comp = components[0]
            self.assertEqual(comp.name, "Gen1")
            self.assertEqual(comp.status, "active")
            self.assertEqual(comp.value["length"]["value"], 2)
            self.assertEqual(comp.value["power"]["max"], 100000.0) # kW to W conversion
            self.assertEqual(comp.value["temperature"]["value"], 50)
            
            self.assertEqual(len(connections), 1)
            conn = connections[0]
            self.assertEqual(conn.source, "Gen1")
            self.assertEqual(conn.type, "power")
            self.assertEqual(conn.status, "active")
            
if __name__ == "__main__":
    unittest.main()
