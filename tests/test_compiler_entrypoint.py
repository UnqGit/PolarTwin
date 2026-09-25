import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from compiler.core import compile_station

class TestCompilerEntrypoint(unittest.TestCase):
    def test_end_to_end_compile(self):
        with TemporaryDirectory() as tmp_dir:
            input_dir = Path(tmp_dir) / "input"
            output_dir = Path(tmp_dir) / "output"
            input_dir.mkdir()
            
            # hierarchy.twin
            (input_dir / "hierarchy.twin").write_text(
                "Station:station @0 {\n"
                "  BlockA:block @0 {\n"
                "    Gen1:generator @0\n"
                "    GenSensor:sensor @0\n"
                "    Antenna1:antenna @0\n"
                "  }\n"
                "}\n",
                encoding="utf-8"
            )
            
            # connection.twin
            (input_dir / "connection.twin").write_text(
                "Gen1:GenSensor[data]@measure\n"
                "GenSensor:Antenna1[data]@transmit\n",
                encoding="utf-8"
            )
            
            # spec.twin
            (input_dir / "spec.twin").write_text(
                "Gen1:generator {\n"
                "  rating@output {\n"
                "    power=0:100 unit=kW\n"
                "  }\n"
                "}\n"
                "GenSensor:sensor measures=power\n"
                "Antenna1:antenna\n"
                "Station:station\n"
                "BlockA:block\n",
                encoding="utf-8"
            )
            
            # Run compilation
            compile_station(input_dir, output_dir)
            
            # Verify outputs
            self.assertTrue((output_dir / "hierarchy.json").exists())
            self.assertTrue((output_dir / "connection.json").exists())
            self.assertTrue((output_dir / "spec.json").exists())
            
            # Verify parsed data
            hierarchy = json.loads((output_dir / "hierarchy.json").read_text(encoding="utf-8"))
            self.assertEqual(len(hierarchy), 5)
            
            connections = json.loads((output_dir / "connection.json").read_text(encoding="utf-8"))
            self.assertEqual(len(connections), 2)
            
            specs = json.loads((output_dir / "spec.json").read_text(encoding="utf-8"))
            self.assertEqual(len(specs), 5)
            
            gen_spec = next(s for s in specs if s["name"] == "Gen1")
            self.assertEqual(gen_spec["rating"]["output"]["power"]["max"], 100)

if __name__ == "__main__":
    unittest.main()
