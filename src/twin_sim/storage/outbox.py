"""Durable SQLite outbox for non-blocking MQTT delivery."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class OutboxRecord:
    message_id: str
    topic: str
    payload: str
    qos: int
    retain: bool
    attempts: int


class SQLiteOutbox:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.connection: sqlite3.Connection | None = None

    def start(self) -> None:
        if self.connection is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.connection = sqlite3.connect(self.path, check_same_thread=False)
            self.connection.execute("""
                CREATE TABLE IF NOT EXISTS mqtt_outbox (
                    message_id TEXT PRIMARY KEY,
                    topic TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    qos INTEGER NOT NULL,
                    retain INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    next_attempt REAL NOT NULL DEFAULT 0
                )
            """)
            self.connection.commit()

    def enqueue(self, message_id: str, topic: str, payload: str, qos: int, retain: bool) -> None:
        self.start()
        assert self.connection is not None
        self.connection.execute(
            "INSERT OR IGNORE INTO mqtt_outbox (message_id, topic, payload, qos, retain, status) VALUES (?, ?, ?, ?, ?, 'PENDING')",
            (message_id, topic, payload, qos, int(retain)),
        )
        self.connection.commit()

    def claim_pending(self, now: float = 0.0) -> OutboxRecord | None:
        self.start()
        assert self.connection is not None
        row = self.connection.execute(
            "SELECT message_id, topic, payload, qos, retain, attempts FROM mqtt_outbox WHERE status IN ('PENDING', 'FAILED') AND next_attempt <= ? ORDER BY rowid LIMIT 1",
            (now,),
        ).fetchone()
        if row is None:
            return None
        self.connection.execute(
            "UPDATE mqtt_outbox SET status = 'IN_FLIGHT', attempts = attempts + 1 WHERE message_id = ?",
            (row[0],),
        )
        self.connection.commit()
        return OutboxRecord(row[0], row[1], row[2], row[3], bool(row[4]), row[5] + 1)

    def mark_delivered(self, message_id: str) -> None:
        self.start()
        assert self.connection is not None
        self.connection.execute("UPDATE mqtt_outbox SET status = 'DELIVERED' WHERE message_id = ?", (message_id,))
        self.connection.commit()

    def mark_failed(self, message_id: str, error: str, next_attempt: float) -> None:
        self.start()
        assert self.connection is not None
        self.connection.execute(
            "UPDATE mqtt_outbox SET status = 'FAILED', last_error = ?, next_attempt = ? WHERE message_id = ?",
            (error, next_attempt, message_id),
        )
        self.connection.commit()

    def count(self, status: str | None = None) -> int:
        self.start()
        if self.connection is None:
            return 0
        if status is None:
            return self.connection.execute("SELECT COUNT(*) FROM mqtt_outbox").fetchone()[0]
        return self.connection.execute("SELECT COUNT(*) FROM mqtt_outbox WHERE status = ?", (status,)).fetchone()[0]

    def close(self) -> None:
        if self.connection is not None:
            self.connection.close()
            self.connection = None