import math
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, model_validator

# ---------------------------------------------------------
# Phase 3 - Canonical Unit Conversions
# ---------------------------------------------------------

UNIT_MULTIPLIERS = {
    # Voltage -> V
    "V": 1.0, "mV": 1e-3, "kV": 1e3,
    # Current -> A
    "A": 1.0, "mA": 1e-3,
    # Power -> W
    "W": 1.0, "kW": 1e3,
    # Energy -> J
    "J": 1.0, "kJ": 1e3, "Wh": 3600.0, "kWh": 3.6e6,
    # Light Irradiance -> W/m2
    "W/m2": 1.0,
    # Frequency -> Hz
    "Hz": 1.0, "kHz": 1e3, "MHz": 1e6, "mHz": 1e-3,
    # Temperature (Handled separately)
    "C": None, "K": None, "F": None,
    # Flowrate -> L/s
    "L/s": 1.0, "cc/s": 1e-3, "m3/hr": 1000.0 / 3600.0, "CFM": 28.316846592 / 60.0, "L/hr": 1.0 / 3600.0, "ltr/hr": 1.0 / 3600.0,
    # Air Particulates -> ppm
    "ppm": 1.0, "bpm": 1.0,
    # O2 / CO2 level -> 0-1
    "%": 0.01,
    # Volume -> L
    "L": 1.0, "m3": 1000.0, "cm3": 1e-3, "ml": 1e-3,
    # Weight -> kg
    "kg": 1.0, "g": 1e-3, "mg": 1e-6,
}

def to_canonical(value: float, unit: str) -> float:
    unit = unit.strip()
    if unit in ("C", "K", "F"):
        if unit == "C": return value
        if unit == "K": return value - 273.15
        if unit == "F": return (value - 32) * 5.0 / 9.0
        
    multiplier = UNIT_MULTIPLIERS.get(unit)
    if multiplier is None:
        # Default fallback or no-op if unrecognized
        return value
    return value * multiplier

def canonicalize_measurement(data: Union[float, int, dict]) -> Union[float, dict]:
    """
    If the data is a scalar, we assume it's canonical already (or unitless like 'count').
    If the data is a dict representing a RatingValue from spec.json: { "value": 100, "unit": "V" }
    or { "min": 0, "max": 100, "unit": "C" }, we apply the conversion.
    """
    if isinstance(data, (float, int)):
        return float(data)
    
    if isinstance(data, dict):
        if "unit" in data:
            unit = data["unit"]
            res = {}
            if "value" in data: res["value"] = to_canonical(float(data["value"]), unit)
            if "min" in data: res["min"] = to_canonical(float(data["min"]), unit)
            if "max" in data: res["max"] = to_canonical(float(data["max"]), unit)
            return res
        else:
            # Maybe unitless
            res = {}
            if "value" in data: res["value"] = float(data["value"])
            if "min" in data: res["min"] = float(data["min"])
            if "max" in data: res["max"] = float(data["max"])
            return res
            
    return data

# ---------------------------------------------------------
# Phase 7 - External Models
# ---------------------------------------------------------

class WeatherModel(BaseModel):
    temperature: float
    wind_speed: float
    humidity: float
    o2_level: float
    co2_level: float
    wind_direction: float
    visibility: float
    pressure: float
    dew_frost_point: float
    
    @model_validator(mode='before')
    @classmethod
    def convert_weather_units(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k, v in data.items():
                if isinstance(v, dict) and "value" in v:
                    data[k] = to_canonical(v["value"], v.get("unit", ""))
        return data

class NetworkModel(BaseModel):
    bandwidth: float
    mainland_connectivity: bool
    upload_window: bool
    upload_speed: float
    download_speed: float
    
    @model_validator(mode='before')
    @classmethod
    def convert_network_units(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k, v in data.items():
                if isinstance(v, dict) and "value" in v:
                    data[k] = to_canonical(v["value"], v.get("unit", ""))
        return data

class SupplyModel(BaseModel):
    ETA: float
    description: str
    mode: str

class ExternalModel(BaseModel):
    weather: WeatherModel
    network: NetworkModel
    supplies: List[SupplyModel]

# ---------------------------------------------------------
# Phase 7 - Component Models (Runtime component.json)
# ---------------------------------------------------------

class RuntimeComponent(BaseModel):
    name: str
    type: str
    is_backup: bool
    status: str
    value: Dict[str, Any]

class RuntimeConnection(BaseModel):
    source: str
    target: str
    type: str
    status: str
