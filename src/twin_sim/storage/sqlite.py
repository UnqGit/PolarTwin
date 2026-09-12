"""SQLite implementation of the database adapter contract."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from twin_sim.telemetry import TelemetryMessage, serialize

from .base import DatabaseAdapter


class SQLiteAdapter(DatabaseAdapter):
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.connection: sqlite3.Connection | None = None

    def start(self) -> None:
        if self.connection is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.connection = sqlite3.connect(self.path, check_same_thread=False)
            self.connection.execute("""
                CREATE TABLE IF NOT EXISTS telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    message_type TEXT NOT NULL,
                    component TEXT,
                    component_type TEXT,
                    payload TEXT NOT NULL
                )
            """)
            self.connection.execute("""
                CREATE TABLE IF NOT EXISTS experiments (
                    run_id TEXT PRIMARY KEY,
                    seed INTEGER,
                    topology_hash TEXT NOT NULL,
                    specification_hash TEXT NOT NULL,
                    scenario_hash TEXT,
                    configuration TEXT,
                    start_timestamp TEXT NOT NULL,
                    end_timestamp TEXT NOT NULL
                )
            """)
            self.connection.commit()

    def write(self, telemetry: TelemetryMessage) -> None:
        if self.connection is None:
            self.start()
        document = telemetry.to_dict()
        component = document.get("component") or {}
        message_type = "measurement" if telemetry.measurement is not None else "event" if telemetry.event is not None else "state"
        self.connection.execute(
            "INSERT INTO telemetry (run_id, timestamp, message_type, component, component_type, payload) VALUES (?, ?, ?, ?, ?, ?)",
            (telemetry.run_id, telemetry.timestamp, message_type, component.get("name"), component.get("type"), serialize(telemetry)),
        )

    def record_experiment(
        self,
        run_id: str,
        seed: int | None,
        topology_hash: str,
        specification_hash: str,
        scenario_hash: str | None,
        configuration: str | None,
        start_timestamp: str,
        end_timestamp: str,
    ) -> None:
        if self.connection is None:
            self.start()
        self.connection.execute(
            """
            INSERT INTO experiments (
                run_id, seed, topology_hash, specification_hash, scenario_hash, configuration, start_timestamp, end_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                seed,
                topology_hash,
                specification_hash,
                scenario_hash,
                configuration,
                start_timestamp,
                end_timestamp,
            ),
        )
        self.connection.commit()

    def flush(self) -> None:
        if self.connection is not None:
            self.connection.commit()

    def close(self) -> None:
        self.flush()
        if self.connection is not None:
            self.connection.close()
            self.connection = None