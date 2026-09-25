import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile

from packages.shared_models.domain import HierarchyComponent
from compiler.parser.spec_parser import parse_spec_file, SpecParseError

class TestSpecParser(unittest.TestCase):
    def setUp(self):
        def hc(name, type):
            return HierarchyComponent(
                name=name, type=type, parent=None, priority=0, 
                floor=0, is_backup=False, backup=[], 
                external_field=None, children=[], tags=[]
            )
        self.hierarchy = [
            hc("Gen1", "generator"),
            hc("Sensor1", "sensor"),
            hc("Station1", "station"),
        ]

    def test_valid_spec_with_inheritance(self):
        content = """
        default:generator {
            rating@input {
                fuel_flow=10:50 unit="L/hr"
            }
            rating@output {
                power=0:100 unit=kW
            }
            dimension {
                length=2 unit=m
            }
            representation=gen_model
        }
        
        Gen1:generator {
            rating@output {
                power=0:200 unit=kW
            }
        }
        
        Sensor1:sensor measures=power {
            rating@input {
                accuracy=0.1
            }
        }
        """
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            specs = parse_spec_file(f_path, self.hierarchy)
            self.assertEqual(len(specs), 3)
            
            gen_spec = next(s for s in specs if s.name == "Gen1")
            self.assertEqual(gen_spec.representation, "gen_model")
            self.assertEqual(gen_spec.dimension["length"]["value"], 2)
            self.assertEqual(gen_spec.rating["input"]["fuel_flow"]["unit"], "L/hr")
            self.assertEqual(gen_spec.rating["output"]["power"]["max"], 200) # Overridden

            sensor_spec = next(s for s in specs if s.name == "Sensor1")
            self.assertEqual(sensor_spec.measures, "power")
            self.assertEqual(sensor_spec.rating["input"]["accuracy"], 0.1)
            
        finally:
            f_path.unlink()

    def test_missing_sensor_measures(self):
        content = "Sensor1:sensor {\n}"
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            with self.assertRaisesRegex(SpecParseError, "must define a 'measures' property"):
                parse_spec_file(f_path, self.hierarchy)
        finally:
            f_path.unlink()

    def test_invalid_dimension_field(self):
        content = "Gen1:generator {\n  dimension {\n    weight=100\n  }\n}"
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            with self.assertRaisesRegex(SpecParseError, "unsupported dimension property 'weight'"):
                parse_spec_file(f_path, self.hierarchy)
        finally:
            f_path.unlink()

    def test_unsupported_inner_scope(self):
        content = "Gen1:generator {\n  unknown@scope {\n  }\n}"
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            with self.assertRaisesRegex(SpecParseError, "unsupported inner scope 'unknown@scope'"):
                parse_spec_file(f_path, self.hierarchy)
        finally:
            f_path.unlink()

    def test_component_missing_from_hierarchy(self):
        content = "Gen2:generator {\n}"
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            with self.assertRaisesRegex(SpecParseError, "missing from hierarchy"):
                parse_spec_file(f_path, self.hierarchy)
        finally:
            f_path.unlink()

if __name__ == "__main__":
    unittest.main()
