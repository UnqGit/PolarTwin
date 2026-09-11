"""Durable storage adapter interfaces."""

from .base import DatabaseAdapter
from .sqlite import SQLiteAdapter
from .outbox import OutboxRecord, SQLiteOutbox

__all__ = ["DatabaseAdapter", "OutboxRecord", "SQLiteAdapter", "SQLiteOutbox"]