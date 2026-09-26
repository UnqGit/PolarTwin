"""MQTT telemetry sink kept independent from simulation execution."""

from __future__ import annotations

import json
from typing import Any, Protocol

from twin_sim.telemetry import TelemetryMessage

from .base import TelemetrySink


class MqttClient(Protocol):
    def connect(self, host: str, port: int, keepalive: int = 60) -> Any: ...
    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> Any: ...
    def loop_start(self) -> Any: ...
    def loop_stop(self) -> Any: ...
    def disconnect(self) -> Any: ...


def create_paho_client() -> MqttClient:
    try:
        import paho.mqtt.client as mqtt  # type: ignore
    except ModuleNotFoundError as exc:
        raise RuntimeError("MQTT output requires the optional 'paho-mqtt' package") from exc
    return mqtt.Client()


def message_type(message: TelemetryMessage) -> str:
    if message.measurement is not None:
        return "measurement"
    if message.event is not None:
        return "event"
    return "state"


def topic_for(message: TelemetryMessage, topic_prefix: str) -> str:
    prefix = topic_prefix.strip("/")
    component = (message.component or {}).get("name", "system")
    return f"{prefix}/{component}/{message_type(message)}"


class MqttSink(TelemetrySink):
    def __init__(
        self,
        host: str,
        port: int = 1883,
        topic_prefix: str = "twin/telemetry",
        qos: int = 1,
        retain: bool = False,
        keepalive: int = 60,
        client: MqttClient | None = None,
    ) -> None:
        if not host:
            raise ValueError("MQTT host must not be empty")
        if qos not in {0, 1, 2}:
            raise ValueError("MQTT qos must be 0, 1, or 2")
        self.host = host
        self.port = port
        self.topic_prefix = topic_prefix
        self.qos = qos
        self.retain = retain
        self.keepalive = keepalive
        self.client = client
        self.connected = False

    def start(self) -> None:
        if self.client is None:
            self.client = create_paho_client()
        self.client.connect(self.host, self.port, self.keepalive)
        self.client.loop_start()
        self.connected = True

    def write(self, telemetry: TelemetryMessage) -> None:
        if self.client is None or not self.connected:
            self.start()
        payload = json.dumps(telemetry.to_dict(), sort_keys=True, separators=(",", ":"))
        assert self.client is not None
        self.client.publish(topic_for(telemetry, self.topic_prefix), payload, self.qos, self.retain)

    def close(self) -> None:
        if self.client is not None and self.connected:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False