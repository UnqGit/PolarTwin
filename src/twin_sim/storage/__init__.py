"""Durable storage adapter interfaces."""

from .base import DatabaseAdapter
from .sqlite import SQLiteAdapter

__all__ = ["DatabaseAdapter", "SQLiteAdapter"]