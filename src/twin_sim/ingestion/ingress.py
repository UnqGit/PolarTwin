"""Ingress pipeline (Modulator) for validating and normalizing external telemetry."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field, ValidationError

class ExternalTelemetryPayload(BaseModel):
    """Pydantic schema for validating raw incoming sensor telemetry."""
    sensor_id: str = Field(..., description="Unique identifier of the sensor or component")
    timestamp: float = Field(..., description="Unix timestamp of the measurement")
    value: float = Field(..., description="The raw measured value")
    unit: str | None = Field(default=None, description="The unit of measurement (e.g., 'C', 'F', 'PSI')")


class TelemetryModulator:
    """Modulates incoming raw telemetry by validating bounds and normalizing units."""
    
    # Pre-defined linear translation map for common units to standard SI
    # Format: source_unit -> (multiplier, offset)
    # final_value = (raw_value * multiplier) + offset
    UNIT_CONVERSIONS: dict[str, tuple[float, float]] = {
        "F": (5.0 / 9.0, -32.0 * 5.0 / 9.0),   # F to C
        "C": (1.0, 0.0),                       # Base unit for temperature
        "K": (1.0, -273.15),                   # K to C
        "PSI": (6894.76, 0.0),                 # PSI to Pascals
        "Pa": (1.0, 0.0),                      # Base unit for pressure
        "lb": (0.453592, 0.0),                 # Pounds to kg
        "kg": (1.0, 0.0),                      # Base unit for mass
        "g": (0.001, 0.0),                     # Grams to kg
        "mg": (0.000001, 0.0)                  # Milligrams to kg
    }

    def __init__(self, conversion_map: dict[str, tuple[float, float]] | None = None) -> None:
        self.conversions = conversion_map if conversion_map is not None else self.UNIT_CONVERSIONS

    def process(self, raw_data: dict[str, Any]) -> dict[str, Any]:
        """Validates payload and normalizes its units. Returns standard dict for simulation."""
        try:
            # Pydantic validation
            payload = ExternalTelemetryPayload.model_validate(raw_data)
        except ValidationError as e:
            raise ValueError(f"Invalid telemetry payload: {e}") from e

        value = payload.value
        if payload.unit and payload.unit in self.conversions:
            multiplier, offset = self.conversions[payload.unit]
            value = (value * multiplier) + offset

        return {
            "component": payload.sensor_id,
            "timestamp": payload.timestamp,
            "value": value,
            "original_unit": payload.unit
        }
