"""Configuration-driven local sink construction."""

from __future__ import annotations

from typing import Any

from .base import TelemetrySink
from .csv import CsvSink
from .jsonl import JsonlSink
from .sqlite import SqliteSink
from .stdout import StdoutSink


def create_sink(configuration: dict[str, Any]) -> TelemetrySink:
    sink_type = configuration.get("type")
    if sink_type == "stdout":
        return StdoutSink()
    if sink_type == "jsonl":
        return JsonlSink(configuration["path"])
    if sink_type == "csv":
        return CsvSink(configuration["path"])
    if sink_type == "sqlite":
        return SqliteSink(configuration["path"])
    raise ValueError(f"unsupported telemetry sink '{sink_type}'")