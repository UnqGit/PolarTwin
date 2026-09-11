"""Asynchronous MQTT delivery backed by a durable outbox."""

from __future__ import annotations

import threading
import time
from pathlib import Path

from twin_sim.storage import SQLiteOutbox
from twin_sim.telemetry import TelemetryMessage

from .base import TelemetrySink
from .connectivity import ConnectivityPolicy
from .mqtt import MqttClient, create_paho_client, topic_for


class MqttStoreForwardSink(TelemetrySink):
    def __init__(
        self,
        host: str,
        outbox_path: str | Path,
        port: int = 1883,
        topic_prefix: str = "twin/telemetry",
        qos: int = 1,
        retain: bool = False,
        client: MqttClient | None = None,
        worker: bool = True,
        retry_base: float = 1.0,
        connectivity_policy: ConnectivityPolicy | None = None,
    ) -> None:
        self.host = host
        self.port = port
        self.topic_prefix = topic_prefix
        self.qos = qos
        self.retain = retain
        self.client = client
        self.outbox = SQLiteOutbox(outbox_path)
        self.retry_base = retry_base
        self._sequence = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.connected = False
        self.worker_enabled = worker
        self.connectivity_policy = connectivity_policy or ConnectivityPolicy()

    def start(self) -> None:
        self.outbox.start()
        if self.worker_enabled and self._thread is None:
            self._thread = threading.Thread(target=self._run, name="mqtt-outbox", daemon=True)
            self._thread.start()

    def write(self, telemetry: TelemetryMessage) -> None:
        self.start()
        self._sequence += 1
        message_id = f"{telemetry.run_id}-{self._sequence:08d}"
        payload = __import__("json").dumps(telemetry.to_dict(), sort_keys=True, separators=(",", ":"))
        self.outbox.enqueue(message_id, topic_for(telemetry, self.topic_prefix), payload, self.qos, self.retain)

    def _connect(self) -> None:
        if self.client is None:
            self.client = create_paho_client()
        if not self.connected:
            self.client.connect(self.host, self.port, 60)
            self.client.loop_start()
            self.connected = True

    def drain_once(self, now: float | None = None) -> bool:
        record = self.outbox.claim_pending(time.time() if now is None else now)
        if record is None:
            return False
        try:
            environment = {}
            try:
                environment = __import__("json").loads(record.payload).get("context", {}).get("environment", {})
            except (TypeError, ValueError):
                pass
            self.connectivity_policy.delay(environment)
            if not self.connectivity_policy.allow(environment):
                raise ConnectionError("simulated network loss")
            self._connect()
            self.client.publish(record.topic, record.payload, record.qos, record.retain)
            self.outbox.mark_delivered(record.message_id)
        except Exception as exc:
            self.connected = False
            current_time = time.time() if now is None else now
            self.outbox.mark_failed(record.message_id, str(exc), current_time + self.retry_base * (2 ** (record.attempts - 1)))
        return True

    def _run(self) -> None:
        while not self._stop.is_set():
            if not self.drain_once():
                self._stop.wait(0.05)

    def flush(self) -> None:
        while self.drain_once():
            pass

    def close(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None
        if self.client is not None and self.connected:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False
        self.outbox.close()