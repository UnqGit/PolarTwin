import sqlite3
import json
import time
from typing import Dict, Any, List


class TelemetryDatabase:
    def __init__(self, db_path: str = ":memory:"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        with self.conn:
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS stations (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    created_at REAL
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS station_models (
                    id TEXT PRIMARY KEY,
                    station_id TEXT,
                    hierarchy_json TEXT,
                    connection_json TEXT,
                    spec_json TEXT,
                    created_at REAL,
                    FOREIGN KEY(station_id) REFERENCES stations(id)
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS scenarios (
                    id TEXT PRIMARY KEY,
                    station_id TEXT,
                    name TEXT,
                    description TEXT,
                    created_at REAL,
                    FOREIGN KEY(station_id) REFERENCES stations(id)
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS event_definitions (
                    id TEXT PRIMARY KEY,
                    scenario_id TEXT,
                    component TEXT,
                    field TEXT,
                    value_json TEXT,
                    start_time REAL,
                    duration REAL,
                    FOREIGN KEY(scenario_id) REFERENCES scenarios(id)
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS simulation_runs (
                    id TEXT PRIMARY KEY,
                    scenario_id TEXT,
                    station_model_id TEXT,
                    start_time REAL,
                    end_time REAL,
                    status TEXT,
                    FOREIGN KEY(scenario_id) REFERENCES scenarios(id),
                    FOREIGN KEY(station_model_id) REFERENCES station_models(id)
                )
            """)

            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS scenario_files (
                    id TEXT PRIMARY KEY,
                    station_id TEXT,
                    name TEXT,
                    source TEXT,
                    created_at REAL,
                    updated_at REAL
                )
            """)

            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS event_files (
                    id TEXT PRIMARY KEY,
                    station_id TEXT,
                    name TEXT,
                    source TEXT,
                    created_at REAL,
                    updated_at REAL
                )
            """)

            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT,
                    station_id TEXT,
                    simulation_time REAL,
                    persistence_time REAL,
                    source TEXT,
                    FOREIGN KEY(run_id) REFERENCES simulation_runs(id)
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_component_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER,
                    component_name TEXT,
                    type TEXT,
                    status TEXT,
                    value_json TEXT,
                    FOREIGN KEY(record_id) REFERENCES telemetry_records(id)
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_connection_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER,
                    source_name TEXT,
                    target_name TEXT,
                    type TEXT,
                    status TEXT,
                    FOREIGN KEY(record_id) REFERENCES telemetry_records(id)
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_external_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER,
                    external_json TEXT,
                    FOREIGN KEY(record_id) REFERENCES telemetry_records(id)
                )
            """)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS simulation_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT,
                    simulation_time REAL,
                    level TEXT,
                    message TEXT,
                    FOREIGN KEY(run_id) REFERENCES simulation_runs(id)
                )
            """)

            # Indexes
            self.conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_record_run ON telemetry_records(run_id, simulation_time)"
            )
            self.conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_comp_record ON telemetry_component_states(record_id)"
            )
            self.conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_conn_record ON telemetry_connection_states(record_id)"
            )

    def create_simulation_run(
        self, run_id: str, station_id: str, scenario_id: str | None = None
    ):
        with self.conn:
            self.conn.execute(
                "INSERT INTO simulation_runs (id, station_model_id, scenario_id, start_time, status) VALUES (?, ?, ?, ?, ?)",
                (run_id, station_id, scenario_id, time.time(), "RUNNING"),
            )

    def update_run_status(self, run_id: str, status: str):
        with self.conn:
            self.conn.execute(
                "UPDATE simulation_runs SET status = ?, end_time = ? WHERE id = ?",
                (status, time.time(), run_id),
            )

    def get_next_run_number(self, station_id: str, scenario_id: str | None) -> int:
        query = "SELECT COUNT(*) FROM simulation_runs WHERE station_model_id = ? AND scenario_id"
        if scenario_id is None:
            query += " IS NULL"
            args = (station_id,)
        else:
            query += " = ?"
            args = (station_id, scenario_id)
        with self.conn:
            cursor = self.conn.execute(query, args)
            row = cursor.fetchone()
            return (row[0] if row else 0) + 1

    def insert_telemetry_batch(
        self, run_id: str, station_id: str, source: str, records: List[Dict[str, Any]]
    ):
        """
        Inserts a batch of telemetry records generated by the engine.
        Each record should have:
        {
            "time": 0.00416,
            "persistence_time": 1690000000.0,
            "components": [ ... ],
            "connections": [ ... ],
            "external": { ... }
        }
        """
        with self.conn:
            for rec in records:
                cur = self.conn.execute(
                    "INSERT INTO telemetry_records (run_id, station_id, simulation_time, persistence_time, source) VALUES (?, ?, ?, ?, ?)",
                    (
                        run_id,
                        station_id,
                        rec["time"],
                        rec.get("persistence_time", 0.0),
                        source,
                    ),
                )
                rec_id = cur.lastrowid

                # Insert components
                if "components" in rec:
                    self.conn.executemany(
                        "INSERT INTO telemetry_component_states (record_id, component_name, type, status, value_json) VALUES (?, ?, ?, ?, ?)",
                        [
                            (
                                rec_id,
                                c.name,
                                getattr(c, "type", ""),
                                c.status,
                                json.dumps(c.value),
                            )
                            for c in rec["components"]
                        ],
                    )

                # Insert connections
                if "connections" in rec:
                    self.conn.executemany(
                        "INSERT INTO telemetry_connection_states (record_id, source_name, target_name, type, status) VALUES (?, ?, ?, ?, ?)",
                        [
                            (rec_id, c.source, c.target, c.type, c.status)
                            for c in rec["connections"]
                        ],
                    )

                # Insert external
                if "external" in rec:
                    ext_data = rec["external"]
                    # If it's a pydantic model, convert to dict
                    if hasattr(ext_data, "model_dump"):
                        ext_data = ext_data.model_dump()
                    elif hasattr(ext_data, "dict"):
                        ext_data = ext_data.dict()

                    self.conn.execute(
                        "INSERT INTO telemetry_external_states (record_id, external_json) VALUES (?, ?)",
                        (rec_id, json.dumps(ext_data)),
                    )

    def get_latest_record(self, run_id: str) -> Dict[str, Any]:
        cur = self.conn.execute(
            "SELECT * FROM telemetry_records WHERE run_id = ? ORDER BY simulation_time DESC LIMIT 1",
            (run_id,),
        )
        row = cur.fetchone()
        if not row:
            return {}

        rec_id = row["id"]

        # Fetch components
        comps = self.conn.execute(
            "SELECT * FROM telemetry_component_states WHERE record_id = ?", (rec_id,)
        ).fetchall()

        # Fetch connections
        conns = self.conn.execute(
            "SELECT * FROM telemetry_connection_states WHERE record_id = ?", (rec_id,)
        ).fetchall()

        # Fetch external
        ext = self.conn.execute(
            "SELECT * FROM telemetry_external_states WHERE record_id = ?", (rec_id,)
        ).fetchone()

        return {
            "time": row["simulation_time"],
            "components": [
                dict(c, value_json=json.loads(c["value_json"])) for c in comps
            ],
            "connections": [dict(c) for c in conns],
            "external": json.loads(ext["external_json"]) if ext else {},
        }

    def get_records_timeline(
        self, station_id: str, run_id: str | None = None
    ) -> List[Dict[str, Any]]:
        query = """
            SELECT r.id, r.run_id, r.station_id, r.simulation_time, r.persistence_time, r.source,
                   (SELECT COUNT(*) FROM telemetry_component_states WHERE record_id = r.id) as component_count,
                   (SELECT COUNT(*) FROM telemetry_connection_states WHERE record_id = r.id) as connection_count
            FROM telemetry_records r
            WHERE LOWER(r.station_id) = LOWER(?)
        """
        params = [station_id]
        if run_id:
            query += " AND r.run_id = ?"
            params.append(run_id)
        query += " ORDER BY r.simulation_time ASC"

        cur = self.conn.execute(query, params)
        return [dict(row) for row in cur.fetchall()]

    def get_record_by_id(self, record_id: int) -> Dict[str, Any]:
        cur = self.conn.execute(
            "SELECT * FROM telemetry_records WHERE id = ?", (record_id,)
        )
        row = cur.fetchone()
        if not row:
            return {}

        comps = self.conn.execute(
            "SELECT * FROM telemetry_component_states WHERE record_id = ?", (record_id,)
        ).fetchall()
        conns = self.conn.execute(
            "SELECT * FROM telemetry_connection_states WHERE record_id = ?",
            (record_id,),
        ).fetchall()
        ext = self.conn.execute(
            "SELECT * FROM telemetry_external_states WHERE record_id = ?", (record_id,)
        ).fetchone()

        return {
            "id": row["id"],
            "run_id": row["run_id"],
            "station_id": row["station_id"],
            "source": row["source"],
            "time": row["simulation_time"],
            "persistence_time": row["persistence_time"],
            "components": [
                dict(c, value_json=json.loads(c["value_json"])) for c in comps
            ],
            "connections": [dict(c) for c in conns],
            "external": json.loads(ext["external_json"]) if ext else {},
        }

    def delete_record(self, record_id: int) -> None:
        """Delete a telemetry record by ID."""
        self.conn.execute("DELETE FROM telemetry_records WHERE id = ?", (record_id,))
        self.conn.commit()

    def get_run_metadata(self, run_id: str) -> Dict[str, Any]:
        cur = self.conn.execute(
            """
            SELECT id, scenario_id, station_model_id, start_time, end_time, status
            FROM simulation_runs
            WHERE id = ?
        """,
            (run_id,),
        )
        row = cur.fetchone()
        if not row:
            return {}

        # Get count of records
        count_cur = self.conn.execute(
            "SELECT COUNT(*) as cnt FROM telemetry_records WHERE run_id = ?", (run_id,)
        )
        count = count_cur.fetchone()["cnt"]

        return {
            "id": row["id"],
            "scenario_id": row["scenario_id"],
            "station_model_id": row["station_model_id"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "status": row["status"],
            "record_count": count,
        }

    def get_component_history(
        self, run_id: str, component_name: str
    ) -> List[Dict[str, Any]]:
        query = """
            SELECT r.simulation_time, c.value_json, c.status
            FROM telemetry_records r
            JOIN telemetry_component_states c ON r.id = c.record_id
            WHERE r.run_id = ? AND LOWER(c.component_name) = LOWER(?)
            ORDER BY r.simulation_time ASC
        """
        cur = self.conn.execute(query, (run_id, component_name))
        return [
            {
                "time": row["simulation_time"],
                "status": row["status"],
                "value": json.loads(row["value_json"]),
            }
            for row in cur.fetchall()
        ]

    def get_connection_history(
        self, run_id: str, connection_id: str
    ) -> List[Dict[str, Any]]:
        # connection_id format from frontend: source--target--index
        try:
            if "--" in connection_id:
                parts = connection_id.split("--")
                source, target = parts[0], parts[1]
            else:
                source, target, _ = connection_id.split("-")
        except ValueError:
            return []

        query = """
            SELECT r.simulation_time, c.status
            FROM telemetry_records r
            JOIN telemetry_connection_states c ON r.id = c.record_id
            WHERE r.run_id = ? AND c.source_name = ? AND c.target_name = ?
            ORDER BY r.simulation_time ASC
        """
        cur = self.conn.execute(query, (run_id, source, target))
        return [
            {"time": row["simulation_time"], "status": row["status"], "value": {}}
            for row in cur.fetchall()
        ]

    def get_external_history(self, run_id: str) -> List[Dict[str, Any]]:
        query = """
            SELECT r.simulation_time, e.external_json
            FROM telemetry_records r
            JOIN telemetry_external_states e ON r.id = e.record_id
            WHERE r.run_id = ?
            ORDER BY r.simulation_time ASC
        """
        cur = self.conn.execute(query, (run_id,))
        return [
            {
                "time": row["simulation_time"],
                "external": json.loads(row["external_json"]),
            }
            for row in cur.fetchall()
        ]

    def get_run_events(self, run_id: str) -> List[Dict[str, Any]]:
        query = """
            SELECT id, simulation_time, source
            FROM telemetry_records
            WHERE run_id = ? AND source != 'SIMULATION'
            ORDER BY simulation_time ASC
        """
        cur = self.conn.execute(query, (run_id,))
        return [dict(row) for row in cur.fetchall()]

    def get_all_runs(self) -> List[Dict[str, Any]]:
        query = """
            SELECT r.id as run_id, r.scenario_id, r.station_model_id, r.start_time, r.end_time, r.status,
                   (SELECT COUNT(*) FROM telemetry_records WHERE run_id = r.id) as record_count
            FROM simulation_runs r
            ORDER BY r.start_time DESC
        """
        cur = self.conn.execute(query)
        runs = [dict(row) for row in cur.fetchall()]

        # Populate run metadata (counts) if necessary, or just return them
        return runs

    def insert_simulation_logs(self, run_id: str, logs: List[Dict[str, Any]]) -> None:
        if not logs:
            return
        with self.conn:
            self.conn.executemany(
                "INSERT INTO simulation_logs (run_id, simulation_time, level, message) VALUES (?, ?, ?, ?)",
                [(run_id, log["time"], log["level"], log["message"]) for log in logs],
            )

    def get_simulation_logs(self, run_id: str) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT simulation_time, level, message FROM simulation_logs WHERE run_id = ? ORDER BY id ASC",
            (run_id,),
        )
        return [
            {"time": row[0], "level": row[1], "message": row[2]}
            for row in cursor.fetchall()
        ]
