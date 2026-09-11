"""Configuration-driven local sink construction."""

from __future__ import annotations

from typing import Any

from .base import TelemetrySink
from .csv import CsvSink
from .database import DatabaseSink
from .jsonl import JsonlSink
from .mqtt import MqttSink
from .sqlite import SqliteSink
from .stdout import StdoutSink
from twin_sim.storage import SQLiteAdapter


def create_sink(configuration: dict[str, Any]) -> TelemetrySink:
    sink_type = configuration.get("type")
    if sink_type == "stdout":
        return StdoutSink()
    if sink_type == "jsonl":
        return JsonlSink(configuration["path"])
    if sink_type == "csv":
        return CsvSink(configuration["path"])
    if sink_type == "sqlite":
        return DatabaseSink(SQLiteAdapter(configuration["path"]))
    if sink_type == "mqtt":
        return MqttSink(
            host=configuration["host"],
            port=configuration.get("port", 1883),
            topic_prefix=configuration.get("topic_prefix", "twin/telemetry"),
            qos=configuration.get("qos", 1),
            retain=configuration.get("retain", False),
        )
    raise ValueError(f"unsupported telemetry sink '{sink_type}'")