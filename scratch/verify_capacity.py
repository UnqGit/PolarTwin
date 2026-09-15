"""Manual capacity-deferral verification after the drain_once SQL fix."""
import time
from twin_sim.outputs.mqtt_store_forward import MqttStoreForwardSink
from twin_sim.simulation.environment import EnvironmentState
from twin_sim.telemetry import TelemetryMessage


class MockClient:
    def publish(self, *a, **kw): pass
    def connect(self, *a, **kw): pass
    def loop_start(self, *a, **kw): pass


sink = MqttStoreForwardSink(
    host="localhost", outbox_path=":memory:", worker=False
)
sink.client = MockClient()
sink.connected = True
sink._connect = lambda: None

env = EnvironmentState({
    "connectivity_to_mainland": 1.0,
    "upload_window": "on",
    "upload_speed_mbps": 0.0008,   # 800 bps
    "bandwidth": 0.0008,
})

# Enqueue one message
msg = TelemetryMessage(
    schema_version="1.0", run_id="cap-test", timestamp=0.0,
    context={"environment": dict(env.values)},
)
sink.write(msg)

# Helper to dump raw SQLite state
def dump_db():
    rows = sink.outbox.connection.execute(
        "SELECT message_id, status, attempts FROM mqtt_outbox"
    ).fetchall()
    for r in rows:
        print(f"    DB row: message_id={r[0]}, status={r[1]}, attempts={r[2]}")


payload_bytes = __import__("json").dumps(msg.to_dict(), sort_keys=True, separators=(",", ":")).encode()
payload_bits = len(payload_bytes) * 8
print(f"Payload size: {len(payload_bytes)} bytes = {payload_bits} bits")
print()

# --- Tick 1 ---
sink.tick(1.0, env)
print(f"Tick 1: available_capacity = {sink.available_capacity_bits:.0f} bits")
sink.drain_once(now=time.time() + 100)
pending = sink.outbox.count("PENDING")
delivered = sink.outbox.count("DELIVERED")
print(f"  pending={pending}, delivered={delivered}")
dump_db()
assert pending == 1 and delivered == 0, "FAIL: message should remain PENDING"
print("  ✓ message remains PENDING\n")

# --- Tick 2 ---
sink.tick(1.0, env)
print(f"Tick 2: available_capacity = {sink.available_capacity_bits:.0f} bits")
sink.drain_once(now=time.time() + 100)
pending = sink.outbox.count("PENDING")
delivered = sink.outbox.count("DELIVERED")
print(f"  pending={pending}, delivered={delivered}")
dump_db()
assert pending == 1 and delivered == 0, "FAIL: message should remain PENDING"
print("  ✓ message remains PENDING\n")

# --- Tick 3 ---
sink.tick(1.0, env)
print(f"Tick 3: available_capacity = {sink.available_capacity_bits:.0f} bits")
sink.drain_once(now=time.time() + 100)
pending = sink.outbox.count("PENDING")
delivered = sink.outbox.count("DELIVERED")
print(f"  pending={pending}, delivered={delivered}")
dump_db()
if payload_bits <= 2400:
    # Payload fits in 3 ticks
    assert delivered == 1, "FAIL: message should now be DELIVERED"
    print("  ✓ message DELIVERED\n")
else:
    assert pending == 1 and delivered == 0, "FAIL: message should remain PENDING (payload > 2400 bits)"
    print(f"  ✓ message remains PENDING (payload {payload_bits} > capacity 2400)\n")

    # --- Tick 4 ---
    sink.tick(1.0, env)
    print(f"Tick 4: available_capacity = {sink.available_capacity_bits:.0f} bits")
    sink.drain_once(now=time.time() + 100)
    pending = sink.outbox.count("PENDING")
    delivered = sink.outbox.count("DELIVERED")
    print(f"  pending={pending}, delivered={delivered}")
    dump_db()
    assert delivered == 1, f"FAIL: message should now be DELIVERED (capacity 3200 >= payload {payload_bits})"
    print("  ✓ message DELIVERED\n")

print("=== CAPACITY TEST PASS ===")
