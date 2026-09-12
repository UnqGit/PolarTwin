import pytest
from twin_sim.ingestion.ingress import TelemetryModulator, ExternalTelemetryPayload
from twin_sim.outputs.compressor import compress_telemetry_batch
from twin_sim.outputs.egress import TelemetryDemodulator
from twin_sim.telemetry.model import TelemetryMessage, DeltaTelemetryMessage
from twin_sim.outputs.base import TelemetrySink

class MemorySink(TelemetrySink):
    def __init__(self):
        self.messages = []
    def write(self, message):
        self.messages.append(message)
    def write_batch(self, messages):
        self.messages.extend(messages)
    def start(self): pass
    def close(self): pass
    def flush(self): pass

def test_ingress_modulator_valid_conversion():
    modulator = TelemetryModulator()
    raw = {
        "sensor_id": "temp_1",
        "timestamp": 100.0,
        "value": 32.0,  # 32 F -> 0 C
        "unit": "F"
    }
    processed = modulator.process(raw)
    assert processed["component"] == "temp_1"
    assert processed["timestamp"] == 100.0
    assert processed["value"] == 0.0
    assert processed["original_unit"] == "F"

def test_ingress_modulator_invalid_payload():
    modulator = TelemetryModulator()
    raw = {
        "sensor_id": "temp_1",
        # missing timestamp
        "value": "not-a-number",
    }
    with pytest.raises(ValueError, match="Invalid telemetry payload"):
        modulator.process(raw)

def test_compress_telemetry_batch():
    m1 = TelemetryMessage(
        schema_version="1", run_id="run1", timestamp=1.0,
        component={"id": "comp1"}, measurement={"val": 10.0}
    )
    m2 = TelemetryMessage(
        schema_version="1", run_id="run1", timestamp=2.0,
        component={"id": "comp1"}, measurement={"val": 20.0}
    )
    m3 = TelemetryMessage(
        schema_version="1", run_id="run1", timestamp=3.0,
        component={"id": "comp1"}, measurement={"val": 30.0}
    )
    
    # Another component
    m4 = TelemetryMessage(
        schema_version="1", run_id="run1", timestamp=4.0,
        component={"id": "comp2"}, measurement={"val": 5.0}
    )

    batch = [m1, m2, m3, m4]
    compressed = compress_telemetry_batch(batch)
    
    assert len(compressed) == 2
    delta = compressed[0]
    assert isinstance(delta, DeltaTelemetryMessage)
    assert delta.count == 3
    assert delta.start_timestamp == 1.0
    assert delta.end_timestamp == 3.0
    assert delta.start_measurement["val"] == 10.0
    assert delta.end_measurement["val"] == 30.0
    
    single = compressed[1]
    assert isinstance(single, TelemetryMessage)
    assert single.component["id"] == "comp2"

def test_telemetry_demodulator():
    sink = MemorySink()
    demod = TelemetryDemodulator(sink)
    demod.start()
    
    delta = DeltaTelemetryMessage(
        schema_version="1", run_id="run1",
        start_timestamp=10.0, end_timestamp=12.0,
        count=3,
        component={"id": "comp1"},
        start_measurement={"val": 0.0},
        end_measurement={"val": 20.0}
    )
    
    demod.write(delta)
    
    assert len(sink.messages) == 3
    assert sink.messages[0].timestamp == 10.0
    assert sink.messages[0].measurement["val"] == 0.0
    
    assert sink.messages[1].timestamp == 11.0
    assert sink.messages[1].measurement["val"] == 10.0
    
    assert sink.messages[2].timestamp == 12.0
    assert sink.messages[2].measurement["val"] == 20.0
