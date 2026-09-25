import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile

from twin_sim.dsl.models import EventDefinition, SceneEvent
from twin_sim.dsl.event_parser import parse_event_file, EventParseError
from twin_sim.dsl.scene_parser import parse_scene_file, SceneParseError

class TestDSLParsers(unittest.TestCase):
    
    def test_parse_event_file_failure(self):
        content = (
            "target @component.type | @component.name\n"
            "where is_backup=false\n"
            "set status=failure\n"
        )
        with NamedTemporaryFile(mode="w", delete=False, suffix=".event", encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            event = parse_event_file(f_path)
            self.assertEqual(event.target, "@component.type | @component.name")
            self.assertEqual(event.where, ["is_backup=false"])
            self.assertEqual(event.set_fixed, {"status": "failure"})
            self.assertFalse(event.set_fields_allowed)
        finally:
            f_path.unlink()

    def test_parse_event_file_network_outage(self):
        content = (
            "target @external.network\n"
            "set {\n"
            "  mainland_connectivity=false\n"
            "  upload_speed=0.00\n"
            "  download_speed=0.05\n"
            "}\n"
        )
        with NamedTemporaryFile(mode="w", delete=False, suffix=".event", encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            event = parse_event_file(f_path)
            self.assertEqual(event.target, "@external.network")
            self.assertEqual(event.set_fixed["mainland_connectivity"], False)
            self.assertEqual(event.set_fixed["upload_speed"], 0.0)
            self.assertEqual(event.set_fixed["download_speed"], 0.05)
        finally:
            f_path.unlink()

    def test_parse_event_file_set_component(self):
        content = (
            "target @component.name\n"
            "set {\n"
            "  value\n"
            "  status=failure\n"
            "}\n"
        )
        with NamedTemporaryFile(mode="w", delete=False, suffix=".event", encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            event = parse_event_file(f_path)
            self.assertEqual(event.target, "@component.name")
            self.assertIn("value", event.set_allowed)
            self.assertEqual(event.set_fixed["status"], "failure")
        finally:
            f_path.unlink()
            
    def test_parse_scene_file_single_lines(self):
        content = (
            "event:failure @Generator1 at=1.0 for=2.0\n"
            "event:network_outage at=2.0 for=inf\n"
        )
        with NamedTemporaryFile(mode="w", delete=False, suffix=".scene", encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            events = parse_scene_file(f_path)
            self.assertEqual(len(events), 2)
            
            self.assertEqual(events[0].event_ref, "failure")
            self.assertEqual(events[0].selector, "@Generator1")
            self.assertEqual(events[0].at, 1.0)
            self.assertEqual(events[0].duration, 2.0)
            
            self.assertEqual(events[1].event_ref, "network_outage")
            self.assertIsNone(events[1].selector)
            self.assertEqual(events[1].at, 2.0)
            self.assertEqual(events[1].duration, float('inf'))
        finally:
            f_path.unlink()
            
    def test_parse_scene_file_blocks(self):
        content = (
            "event:set_component @Generator1 at=1.2 for=inf {\n"
            "    set {\n"
            "        value {\n"
            "            voltage=121.7\n"
            "            current=50.2\n"
            "        }\n"
            "    }\n"
            "}\n"
        )
        with NamedTemporaryFile(mode="w", delete=False, suffix=".scene", encoding="utf-8") as f:
            f.write(content)
            f_path = Path(f.name)
            
        try:
            events = parse_scene_file(f_path)
            self.assertEqual(len(events), 1)
            
            payload = events[0].payload
            self.assertIn("value", payload)
            self.assertEqual(payload["value"]["voltage"], 121.7)
            self.assertEqual(payload["value"]["current"], 50.2)
        finally:
            f_path.unlink()

if __name__ == "__main__":
    unittest.main()
