"""Egress pipeline (Demodulator) for expanding compressed telemetry before storage."""

from typing import Any
from .base import TelemetrySink
from twin_sim.telemetry.model import TelemetryMessage, DeltaTelemetryMessage

class TelemetryDemodulator(TelemetrySink):
    """Wraps an existing TelemetrySink and expands DeltaTelemetryMessages into standard TelemetryMessages."""
    
    def __init__(self, sink: TelemetrySink) -> None:
        self.sink = sink
        
    def _interpolate(self, delta: DeltaTelemetryMessage) -> list[TelemetryMessage]:
        messages = []
        
        # If count < 2, just fallback
        if delta.count < 2:
            return []
            
        time_step = (delta.end_timestamp - delta.start_timestamp) / (delta.count - 1)
        
        # Calculate steps for each measurement key
        start_meas = delta.start_measurement or {}
        end_meas = delta.end_measurement or {}
        
        keys = set(start_meas.keys()).intersection(end_meas.keys())
        val_steps = {}
        for k in keys:
            val_steps[k] = (end_meas[k] - start_meas[k]) / (delta.count - 1)
            
        for i in range(delta.count):
            t = delta.start_timestamp + i * time_step
            
            # Interpolate measurements
            interpolated_meas = {}
            for k in keys:
                interpolated_meas[k] = start_meas[k] + i * val_steps[k]
                
            msg = TelemetryMessage(
                schema_version=delta.schema_version,
                run_id=delta.run_id,
                timestamp=t,
                component=delta.component,
                measurement=interpolated_meas,
                state=None,  # State is lost during compression
                quality=delta.quality,
                source=delta.source,
                context=delta.context,
                active_events=[],
                event=None
            )
            messages.append(msg)
            
        return messages

    def write(self, telemetry: Any) -> None:
        if isinstance(telemetry, DeltaTelemetryMessage):
            for expanded in self._interpolate(telemetry):
                self.sink.write(expanded)
        else:
            self.sink.write(telemetry)

    def write_batch(self, telemetries: list[Any]) -> None:
        expanded_batch = []
        for msg in telemetries:
            if isinstance(msg, DeltaTelemetryMessage):
                expanded_batch.extend(self._interpolate(msg))
            else:
                expanded_batch.append(msg)
        self.sink.write_batch(expanded_batch)

    def flush(self) -> None:
        self.sink.flush()

    def close(self) -> None:
        self.sink.close()

    def start(self) -> None:
        self.sink.start()
