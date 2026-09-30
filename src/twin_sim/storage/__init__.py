"""Durable storage adapter interfaces."""

from .base import DatabaseAdapter
from .outbox import OutboxRecord, SQLiteOutbox
from .sqlite import SQLiteAdapter

__all__ = ["DatabaseAdapter", "OutboxRecord", "SQLiteAdapter", "SQLiteOutbox"]
