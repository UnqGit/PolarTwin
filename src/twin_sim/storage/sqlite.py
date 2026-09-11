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
            self.connection = sqlite3.connect(self.path)
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

    def flush(self) -> None:
        if self.connection is not None:
            self.connection.commit()

    def close(self) -> None:
        self.flush()
        if self.connection is not None:
            self.connection.close()
            self.connection = None