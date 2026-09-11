"""Zero-dependency SQLite telemetry sink."""

from __future__ import annotations

from pathlib import Path

from twin_sim.storage import SQLiteAdapter

from .database import DatabaseSink


class SqliteSink(DatabaseSink):
    def __init__(self, path: str | Path) -> None:
        super().__init__(SQLiteAdapter(path))