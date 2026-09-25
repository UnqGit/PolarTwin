import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile

from packages.shared_models.domain import HierarchyComponent, CompiledConnection
from packages.shared_models.enums import ConnectionType
from compiler.parser.connection_parser import parse_connection_file, ConnectionParseError

class TestConnectionParser(unittest.TestCase):
    def setUp(self):
        def hc(name, type, floor=0):
            return HierarchyComponent(
                name=name, type=type, parent=None, priority=0, 
                floor=floor, is_backup=False, backup=[], 
                external_field=None, children=[], tags=[]
            )
        self.hierarchy = [
            hc("Node1", "component"),
            hc("Node2", "component"),
            hc("Node3", "component"),
            hc("Floor1", "floor", floor=1),
        ]
        self.hc = hc

    def test_valid_connections(self):
        content = (
            "Node1:Node2[power]@relation1\n"
            "Node2:Node3[resource]@relation2\n"
        )
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            conns = parse_connection_file(f_path, self.hierarchy)
            self.assertEqual(len(conns), 2)
            self.assertEqual(conns[0].source, "Node1")
            self.assertEqual(conns[0].target, "Node2")
            self.assertEqual(conns[0].type, ConnectionType.POWER)
            self.assertEqual(conns[0].relation, "relation1")
        finally:
            f_path.unlink()

    def test_old_syntax_fails(self):
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write("Node1-->Node2[data]@relation1\n")
            f_path = Path(f.name)
        try:
            with self.assertRaisesRegex(ConnectionParseError, "Invalid connection syntax"):
                parse_connection_file(f_path, self.hierarchy)
        finally:
            f_path.unlink()

    def test_missing_node_fails(self):
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write("Node1:Unknown[data]@relation1\n")
            f_path = Path(f.name)
        try:
            with self.assertRaisesRegex(ConnectionParseError, "Unknown target identifier 'Unknown'"):
                parse_connection_file(f_path, self.hierarchy)
        finally:
            f_path.unlink()

    def test_floor_node_prohibited(self):
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write("Floor1:Node2[data]@relation1\n")
            f_path = Path(f.name)
        try:
            with self.assertRaisesRegex(ConnectionParseError, "cannot participate in connections"):
                parse_connection_file(f_path, self.hierarchy)
        finally:
            f_path.unlink()

    def test_sensor_rules(self):
        # Missing antenna target
        hierarchy = self.hierarchy + [self.hc("Sensor1", "sensor")]
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write("Node1:Sensor1[data]@m1\nSensor1:Node2[data]@m2\n")
            f_path = Path(f.name)
        try:
            with self.assertRaisesRegex(ConnectionParseError, "must terminate at an antenna"):
                parse_connection_file(f_path, hierarchy)
        finally:
            f_path.unlink()

    def test_alarm_rules(self):
        hierarchy = self.hierarchy + [self.hc("Alarm1", "alarm")]
        with NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as f:
            f.write("Node1:Alarm1[signal]@m1\nAlarm1:Node2[signal]@m2\n")
            f_path = Path(f.name)
        try:
            with self.assertRaisesRegex(ConnectionParseError, "must not have any outgoing"):
                parse_connection_file(f_path, hierarchy)
        finally:
            f_path.unlink()

if __name__ == "__main__":
    unittest.main()
