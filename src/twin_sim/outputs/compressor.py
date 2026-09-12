"""Telemetry compression utilities to handle backpressure."""

from typing import Any
from ..telemetry.model import TelemetryMessage, DeltaTelemetryMessage

def _is_numeric_measurement(measurement: dict[str, Any] | None) -> bool:
    if not measurement:
        return False
    return all(isinstance(v, (int, float)) for v in measurement.values())

def compress_telemetry_batch(messages: list[Any]) -> list[Any]:
    """Compress a batch of telemetry messages by merging numeric measurements per component."""
    if not messages:
        return []
    
    compressed: list[Any] = []
    
    # component_id -> (start_msg, end_msg, count)
    active_compressions: dict[str, tuple[TelemetryMessage, TelemetryMessage, int]] = {}
    
    def _flush_comp(comp_id: str):
        if comp_id in active_compressions:
            start_msg, end_msg, count = active_compressions.pop(comp_id)
            if count == 1:
                compressed.append(start_msg)
            else:
                delta = DeltaTelemetryMessage(
                    schema_version=start_msg.schema_version,
                    run_id=start_msg.run_id,
                    start_timestamp=start_msg.timestamp,
                    end_timestamp=end_msg.timestamp,
                    count=count,
                    component=start_msg.component,
                    start_measurement=start_msg.measurement,
                    end_measurement=end_msg.measurement,
                    quality=start_msg.quality,
                    source=start_msg.source,
                    context=start_msg.context
                )
                compressed.append(delta)

    for msg in messages:
        if not isinstance(msg, TelemetryMessage):
            compressed.append(msg)
            continue
            
        comp_dict = msg.component
        comp_id = comp_dict.get("id") if comp_dict else None
        
        if not comp_id or not _is_numeric_measurement(msg.measurement):
            compressed.append(msg)
            continue
            
        if comp_id in active_compressions:
            start_msg, end_msg, count = active_compressions[comp_id]
            # Ensure same run_id
            if start_msg.run_id == msg.run_id:
                active_compressions[comp_id] = (start_msg, msg, count + 1)
            else:
                _flush_comp(comp_id)
                active_compressions[comp_id] = (msg, msg, 1)
        else:
            active_compressions[comp_id] = (msg, msg, 1)
            
    # Flush remaining
    for comp_id in list(active_compressions.keys()):
        _flush_comp(comp_id)
        
    return compressed
