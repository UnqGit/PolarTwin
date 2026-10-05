import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile

from twin_sim.dsl.event_parser import parse_event_file, parse_event_string
from twin_sim.dsl.scene_parser import parse_scene_file


class TestDSLParsers(unittest.TestCase):

    # ------------------------------------------------------------------
    # Event file parser – Spec §8 examples
    # ------------------------------------------------------------------

    def test_parse_event_file_failure(self):
        content = (
            "target @component.type | @component.name\n"
            "where is_backup=false\n"
            "set status=failure\n"
        )
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".event", encoding="utf-8"
        ) as f:
            f.write(content)
            f_path = Path(f.name)

        try:
            event = parse_event_file(f_path)
            self.assertEqual(event.target, "@component.type | @component.name")
            self.assertEqual(event.target_kind, "component.any")
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
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".event", encoding="utf-8"
        ) as f:
            f.write(content)
            f_path = Path(f.name)

        try:
            event = parse_event_file(f_path)
            self.assertEqual(event.target, "@external.network")
            self.assertEqual(event.target_kind, "external.network")
            self.assertEqual(event.set_fixed["mainland_connectivity"], False)
            self.assertEqual(event.set_fixed["upload_speed"], 0.0)
            self.assertEqual(event.set_fixed["download_speed"], 0.05)
        finally:
            f_path.unlink()

    def test_parse_event_file_set_component_block(self):
        """Spec multiline set block in event file"""
        content = (
            "target @component.name\n"
            "set {\n"
            "  value\n"
            "  status=failure\n"
            "}\n"
        )
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".event", encoding="utf-8"
        ) as f:
            f.write(content)
            f_path = Path(f.name)

        try:
            event = parse_event_file(f_path)
            self.assertEqual(event.target, "@component.name")
            self.assertEqual(event.target_kind, "component.name")
            self.assertIn("value", event.set_allowed)
            self.assertEqual(event.set_fixed["status"], "failure")
        finally:
            f_path.unlink()

    def test_parse_event_string_set_fields_keyword(self):
        """Spec §11.1: set fields"""
        content = "target @external\nset fields\n"
        ev = parse_event_string(content, name="set_external")
        self.assertEqual(ev.target_kind, "external")
        self.assertTrue(ev.set_fields_allowed)
        self.assertEqual(ev.set_allowed, [])

    def test_parse_event_string_set_fields_inline_block(self):
        """Spec §11.2 / §8 set_component.event: set fields { value }"""
        content = "target @component.name\nset fields { value }\n"
        ev = parse_event_string(content, name="set_component")
        self.assertEqual(ev.target_kind, "component.name")
        self.assertTrue(ev.set_fields_allowed)
        self.assertIn("value", ev.set_allowed)

    def test_parse_event_string_set_single_line_block(self):
        """Spec §11.2: set { value } on a single line"""
        content = "target @component.name\nset { value }\n"
        ev = parse_event_string(content, name="test_single_block")
        self.assertEqual(ev.target_kind, "component.name")
        self.assertIn("value", ev.set_allowed)
        self.assertFalse(ev.set_fields_allowed)

    def test_parse_event_string_combined_set_block(self):
        """Spec §11.4: multi-line set block with editable, fixed, and fields"""
        content = (
            "target @component.name\n"
            "set {\n"
            "  values.temperature\n"
            "  values.voltage.output=120\n"
            "  status=failure\n"
            "  fields\n"
            "}\n"
        )
        ev = parse_event_string(content, name="combined")
        self.assertIn("values.temperature", ev.set_allowed)
        self.assertEqual(ev.set_fixed["values.voltage.output"], 120)
        self.assertEqual(ev.set_fixed["status"], "failure")
        self.assertTrue(ev.set_fields_allowed)

    def test_parse_event_string_connection_target(self):
        """Spec §9.2: target @connection"""
        content = "target @connection\nset status=failure\n"
        ev = parse_event_string(content, name="connection_failure")
        self.assertEqual(ev.target_kind, "connection")

    def test_parse_event_string_connection_source(self):
        """Spec §9.2 field-specific: target @connection.source"""
        content = "target @connection.source\nset status=failure\n"
        ev = parse_event_string(content, name="conn_src")
        self.assertEqual(ev.target_kind, "connection.source")

    def test_parse_event_string_connection_multi(self):
        """Spec §9.2 multi-field: target @connection.(source & type)"""
        content = "target @connection.(source & type)\nset status=failure\n"
        ev = parse_event_string(content, name="conn_multi")
        self.assertEqual(ev.target_kind, "connection.multi")
        self.assertIn("source", ev.connection_multi_fields)
        self.assertIn("type", ev.connection_multi_fields)

    def test_parse_event_string_where_continuation(self):
        """Spec §10.3: where with & continuation"""
        content = (
            "target @connection\n"
            "where @component(source).type=generator\n"
            "& type=data\n"
            "& @component(target).type=sensor\n"
            "set status=failure\n"
        )
        ev = parse_event_string(content, name="filtered_conn")
        self.assertEqual(len(ev.where), 3)
        self.assertEqual(ev.where[0], "@component(source).type=generator")
        self.assertEqual(ev.where[1], "type=data")
        self.assertEqual(ev.where[2], "@component(target).type=sensor")

    def test_invalid_bare_component_target(self):
        """Spec §9.1: bare @component is invalid"""
        content = "target @component\nset status=failure\n"
        with self.assertRaises(Exception):
            parse_event_string(content, name="bad")

    def test_invalid_set_clause(self):
        """Unrecognised set clause should raise"""
        content = "target @component.name\nset unknown_keyword\n"
        with self.assertRaises(Exception):
            parse_event_string(content, name="bad")

    # ------------------------------------------------------------------
    # Scene file parser – Spec §7
    # ------------------------------------------------------------------

    def test_parse_scene_file_single_lines(self):
        content = (
            "event:failure @Generator1 at=1.0 for=2.0\n"
            "event:network_outage at=2.0 for=inf\n"
        )
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".scene", encoding="utf-8"
        ) as f:
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
            self.assertEqual(events[1].duration, float("inf"))
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
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".scene", encoding="utf-8"
        ) as f:
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

    def test_parse_scene_file_connection_selector(self):
        """Spec §9.2: @(source|type|target) selector"""
        content = "event:connection_failure @(Generator1|data|Antenna1) at=1.0 for=2.0\n"
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".scene", encoding="utf-8"
        ) as f:
            f.write(content)
            f_path = Path(f.name)
        try:
            events = parse_scene_file(f_path)
            self.assertEqual(len(events), 1)
            self.assertEqual(events[0].selector, "@(Generator1|data|Antenna1)")
        finally:
            f_path.unlink()

    def test_parse_scene_file_partial_connection_selector(self):
        """Spec §9.2: @(|data|) — partial connection selector"""
        content = "event:connection_failure @(|data|) at=1.0 for=6.0\n"
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".scene", encoding="utf-8"
        ) as f:
            f.write(content)
            f_path = Path(f.name)
        try:
            events = parse_scene_file(f_path)
            self.assertEqual(len(events), 1)
            self.assertEqual(events[0].selector, "@(|data|)")
        finally:
            f_path.unlink()

    def test_parse_scene_file_stable_sort(self):
        """Spec §7.2: stable sort by at; same-at events keep scene order."""
        content = (
            "event:b @Generator1 at=1.0 for=2.0\n"
            "event:a @Generator1 at=1.0 for=2.0\n"
        )
        with NamedTemporaryFile(
            mode="w", delete=False, suffix=".scene", encoding="utf-8"
        ) as f:
            f.write(content)
            f_path = Path(f.name)
        try:
            events = parse_scene_file(f_path)
            self.assertEqual(events[0].event_ref, "b")
            self.assertEqual(events[1].event_ref, "a")
        finally:
            f_path.unlink()


if __name__ == "__main__":
    unittest.main()
