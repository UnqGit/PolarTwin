import unittest
import sqlite3
import json
from twin_sim.telemetry.database import TelemetryDatabase


class TestPhase32Persistence(unittest.TestCase):

    def setUp(self):
        self.db = TelemetryDatabase(":memory:")

    def test_tables_created(self):
        """Test that all Phase 32 tables are created successfully."""
        tables = [
            "stations",
            "station_models",
            "scenarios",
            "event_definitions",
            "simulation_runs",
            "telemetry_records",
            "telemetry_component_states",
            "telemetry_connection_states",
            "telemetry_external_states",
        ]

        cur = self.db.conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = {row["name"] for row in cur.fetchall()}

        for table in tables:
            self.assertIn(table, existing_tables)

    def test_insert_and_retrieve_station(self):
        """Test basic insertion and retrieval from the stations table."""
        self.db.conn.execute(
            "INSERT INTO stations (id, name, created_at) VALUES (?, ?, ?)",
            ("st-1", "Test Station", 1000.0),
        )
        self.db.conn.commit()

        cur = self.db.conn.execute("SELECT * FROM stations WHERE id = 'st-1'")
        row = cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["name"], "Test Station")
        self.assertEqual(row["created_at"], 1000.0)

    def test_insert_and_retrieve_station_model(self):
        self.db.conn.execute(
            "INSERT INTO stations (id, name, created_at) VALUES (?, ?, ?)",
            ("st-1", "Test Station", 1000.0),
        )

        self.db.conn.execute(
            "INSERT INTO station_models (id, station_id, hierarchy_json, connection_json, spec_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("model-1", "st-1", "[]", "[]", "[]", 1005.0),
        )
        self.db.conn.commit()

        cur = self.db.conn.execute("SELECT * FROM station_models WHERE id = 'model-1'")
        row = cur.fetchone()
        self.assertEqual(row["station_id"], "st-1")

    def test_foreign_key_constraints(self):
        """Test that SQLite foreign key constraints are enforced (if enabled)."""
        # Enable FK constraints for this connection
        self.db.conn.execute("PRAGMA foreign_keys = ON")

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.conn.execute(
                "INSERT INTO station_models (id, station_id, hierarchy_json, connection_json, spec_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("model-1", "non-existent-st", "[]", "[]", "[]", 1005.0),
            )


if __name__ == "__main__":
    unittest.main()
