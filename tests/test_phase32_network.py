import pytest
import time
from twin_sim.outputs.mqtt_store_forward import MqttStoreForwardSink
from twin_sim.outputs.connectivity import ConnectivityPolicy
from twin_sim.telemetry import TelemetryMessage
import random

class MockOutbox:
    def __init__(self):
        self.queue = []
        self.delivered = []
        self.failed = []
        
    def start(self): pass
    def close(self): pass
    def enqueue(self, message_id, topic, payload, qos, retain):
        self.queue.append({"message_id": message_id, "topic": topic, "payload": payload, "qos": qos, "retain": retain, "attempts": 1, "next_attempt": 0})
        
    def claim_pending(self, now):
        for msg in self.queue:
            if msg["next_attempt"] <= now:
                self.queue.remove(msg)
                class Record:
                    def __init__(self, m):
                        self.message_id = m["message_id"]
                        self.topic = m["topic"]
                        self.payload = m["payload"]
                        self.qos = m["qos"]
                        self.retain = m["retain"]
                        self.attempts = m["attempts"]
                return Record(msg)
        return None
        
    def mark_delivered(self, message_id):
        self.delivered.append(message_id)
        
    def mark_failed(self, message_id, error, next_attempt):
        self.failed.append(f"{message_id}: {error}")
        self.queue.append({"message_id": message_id, "topic": "dummy", "payload": "{}", "qos": 1, "retain": False, "attempts": 2, "next_attempt": next_attempt})
        
class MockMqttClient:
    def connect(self, *args): pass
    def publish(self, *args): pass
    def loop_start(self): pass
    def loop_stop(self): pass
    def disconnect(self): pass

def test_connectivity_outage():
    outbox = MockOutbox()
    policy = ConnectivityPolicy(random_value=random.random)
    sink = MqttStoreForwardSink("localhost", "dummy.db", client=MockMqttClient(), worker=False, connectivity_policy=policy)
    sink.outbox = outbox
    
    # Tick simulation by 1s.
    env = {"connectivity_to_mainland": 0.0}
    sink.tick(1.0, env)
    
    msg = TelemetryMessage(schema_version="1.0", run_id="run1", timestamp=1.0, source={}, context={"environment": env}, measurement={})
    sink.write(msg)
    
    assert len(outbox.queue) == 1
    sink.drain_once(now=1.0)
    # The drain should have failed and re-queued
    assert len(outbox.delivered) == 0
    assert len(outbox.failed) == 1

def test_upload_window():
    outbox = MockOutbox()
    policy = ConnectivityPolicy(random_value=random.random)
    sink = MqttStoreForwardSink("localhost", "dummy.db", client=MockMqttClient(), worker=False, connectivity_policy=policy)
    sink.outbox = outbox
    
    env = {"connectivity_to_mainland": 1.0, "upload_window": "off"}
    sink.tick(1.0, env)
    
    msg = TelemetryMessage(schema_version="1.0", run_id="run1", timestamp=1.0, source={}, context={"environment": env}, measurement={})
    sink.write(msg)
    
    assert len(outbox.queue) == 1
    sink.drain_once(now=1.0)
    assert len(outbox.delivered) == 0
    assert len(outbox.failed) == 1

def test_capacity_limit():
    outbox = MockOutbox()
    policy = ConnectivityPolicy(random_value=random.random)
    sink = MqttStoreForwardSink("localhost", "dummy.db", client=MockMqttClient(), worker=False, connectivity_policy=policy)
    sink.outbox = outbox
    
    env = {"connectivity_to_mainland": 1.0, "upload_window": "on", "upload_speed_mbps": 0.001, "bandwidth": 10.0} # 1 Kbps
    sink.tick(1.0, env) # Add 1 Kbit capacity
    
    msg = TelemetryMessage(schema_version="1.0", run_id="run1", timestamp=1.0, source={}, context={"environment": env}, measurement={"data": "x" * 200}) # 1600 bits > 1000 bits
    sink.write(msg)
    
    # Attempt to drain - should fail due to capacity and NOT mark as failed (remains pending)
    assert len(outbox.queue) == 1
    # Mocking outbox update
    sink.outbox.connection = type('MockConn', (), {'execute': lambda self, *args: None, 'commit': lambda self: None})()
    res = sink.drain_once(now=1.0)
    assert len(outbox.failed) == 0, f"Failed with errors: {outbox.failed}"
    assert res is False
    assert len(outbox.delivered) == 0
    
def test_capacity_drain():
    outbox = MockOutbox()
    policy = ConnectivityPolicy(random_value=random.random)
    sink = MqttStoreForwardSink("localhost", "dummy.db", client=MockMqttClient(), worker=False, connectivity_policy=policy)
    sink.outbox = outbox
    
    env = {"connectivity_to_mainland": 1.0, "upload_window": "on", "upload_speed_mbps": 10.0, "bandwidth": 10.0}
    sink.tick(1.0, env) # 10 Mbits capacity
    
    msg = TelemetryMessage(schema_version="1.0", run_id="run1", timestamp=1.0, source={}, context={"environment": env}, measurement={"data": "x"})
    sink.write(msg)
    
    assert len(outbox.queue) == 1
    res = sink.drain_once(now=1.0)
    assert res is True
    assert len(outbox.delivered) == 1
