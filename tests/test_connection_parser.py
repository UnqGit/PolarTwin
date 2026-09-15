import unittest
from pathlib import Path

from compiler.parser.connection_parser import parse_connection_file, ConnectionParseError


class TestConnectionParser(unittest.TestCase):

    def setUp(self):
        self.topology_data = {
            "name": "Root",
            "type": "system",
            "children": [
                {"name": "Node1", "type": "component"},
                {"name": "Node2", "type": "component"},
                {"name": "Node3", "type": "component"},
                {"name": "Floor1", "type": "floor"}
            ]
        }
        self.test_file = Path("test_connections.twin")

    def tearDown(self):
        if self.test_file.exists():
            self.test_file.unlink()

    def test_valid_connections(self):
        self.test_file.write_text(
            "Node1-->Node2[data]@relation1\n"
            "Node2<-->Node3[resource]@relation2\n"
            "Node1-.->Node3[signal]@relation3\n",
            encoding="utf-8"
        )
        connections = parse_connection_file(self.test_file, self.topology_data)
        self.assertEqual(len(connections), 3)
        self.assertEqual(connections[0], {"source": "Node1", "target": "Node2", "type": "data", "relation": "relation1", "direction": "-->"})
        self.assertEqual(connections[1], {"source": "Node2", "target": "Node3", "type": "resource", "relation": "relation2", "direction": "<-->"})
        self.assertEqual(connections[2], {"source": "Node1", "target": "Node3", "type": "signal", "relation": "relation3", "direction": "-.->"})

    def test_old_syntax_fails(self):
        self.test_file.write_text("Node1-->Node2@relation1\n", encoding="utf-8")
        with self.assertRaises(ConnectionParseError) as ctx:
            parse_connection_file(self.test_file, self.topology_data)
        self.assertIn("Invalid connection syntax", str(ctx.exception))

    def test_missing_node_fails(self):
        self.test_file.write_text("Node1-->Unknown[data]@relation1\n", encoding="utf-8")
        with self.assertRaises(ConnectionParseError) as ctx:
            parse_connection_file(self.test_file, self.topology_data)
        self.assertIn("Unknown target identifier", str(ctx.exception))

    def test_floor_node_prohibited(self):
        self.test_file.write_text("Floor1-->Node2[data]@relation1\n", encoding="utf-8")
        with self.assertRaises(ConnectionParseError) as ctx:
            parse_connection_file(self.test_file, self.topology_data)
        self.assertIn("floor node 'Floor1' cannot be used", str(ctx.exception))

        self.test_file.write_text("Node1-->Floor1[data]@relation1\n", encoding="utf-8")
        with self.assertRaises(ConnectionParseError) as ctx:
            parse_connection_file(self.test_file, self.topology_data)
        self.assertIn("floor node 'Floor1' cannot be used", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
