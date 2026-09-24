import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile

from compiler.parser.hierarchy_parser import parse_hierarchy_file, HierarchyParseError

class TestHierarchyParser(unittest.TestCase):
    def test_valid_hierarchy(self):
        content = """
        Station:station @0 %critical {
            HVACBlock:block @0 {
                HeatingSystem:system @0 {
                    MainConditioner:air_conditioner @0 %primary
                    BackupConditioner:air_conditioner @0 backup(MainConditioner) %backup
                }
            }
            GroundFloor:floor @level=0 @0 {
                EnergyBlock:block @1 {
                    MainGen:generator @0 external@power.gen1
                }
            }
        }
        """
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            components = parse_hierarchy_file(f_path)
            self.assertEqual(len(components), 8)
            
            # Check BackupConditioner
            bc = next(c for c in components if c.name == "BackupConditioner")
            self.assertTrue(bc.is_backup)
            self.assertEqual(bc.backup, ["MainConditioner"])
            self.assertEqual(bc.tags, ["backup"])
            
            # Check GroundFloor
            gf = next(c for c in components if c.name == "GroundFloor")
            self.assertEqual(gf.floor, 0)
            
            # Check MainGen
            mg = next(c for c in components if c.name == "MainGen")
            self.assertEqual(mg.external_field, "power.gen1")
            
        finally:
            f_path.unlink()

    def test_missing_priority(self):
        content = "Station:station %critical {\n}"
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            with self.assertRaisesRegex(HierarchyParseError, "Priority '@<integer>' is required"):
                parse_hierarchy_file(f_path)
        finally:
            f_path.unlink()

    def test_floor_missing_level(self):
        content = "Station:station @0 {\n  GroundFloor:floor @0 {\n  }\n}"
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            with self.assertRaisesRegex(HierarchyParseError, "missing required '@level=<integer>'"):
                parse_hierarchy_file(f_path)
        finally:
            f_path.unlink()

    def test_duplicate_name(self):
        content = "A:station @0 {\n  A:block @0\n}"
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            with self.assertRaisesRegex(HierarchyParseError, "Duplicate identifier 'A'"):
                parse_hierarchy_file(f_path)
        finally:
            f_path.unlink()

if __name__ == "__main__":
    unittest.main()
