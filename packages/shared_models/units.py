"""
Canonical unit conversion for PolarTwin.

Per specification §3.6, all values must be stored internally in canonical units.
The simulation does not store units alongside canonical values (spec §5.1).

Measurement types and their canonical units (spec §3.6):
  voltage         V, mV, kV          -> V
  current         A, mA              -> A
  power           W, kW              -> W
  energy          Wh, kWh, J, kJ     -> J
  light_irradiance W/m2              -> W/m2
  frequency       Hz, kHz, MHz, mHz  -> Hz
  temperature     C, K, F            -> C
  flowrate        cc/s, m3/hr, L/s, CFM, L/hr -> L/s
  air_particulates ppm, bpm          -> ppm
  o2_level        %                  -> 0-1
  co2_level       %                  -> 0-1
  volume          L, m3, cm3, ml     -> L
  weight          kg, g, mg          -> kg
  count           -                  -> -
"""

from __future__ import annotations
from typing import Callable


class UnitConversionError(ValueError):
    """Raised when an unsupported or invalid unit is used."""


# ---------------------------------------------------------------------------
# Conversion functions: all return value in canonical unit
# ---------------------------------------------------------------------------

def _voltage_to_V(value: float, unit: str) -> float:
    match unit:
        case "V":    return value
        case "mV":   return value / 1000.0
        case "kV":   return value * 1000.0
        case _:      raise UnitConversionError(f"Unsupported voltage unit: {unit!r}")


def _current_to_A(value: float, unit: str) -> float:
    match unit:
        case "A":    return value
        case "mA":   return value / 1000.0
        case _:      raise UnitConversionError(f"Unsupported current unit: {unit!r}")


def _power_to_W(value: float, unit: str) -> float:
    match unit:
        case "W":    return value
        case "kW":   return value * 1000.0
        case _:      raise UnitConversionError(f"Unsupported power unit: {unit!r}")


def _energy_to_J(value: float, unit: str) -> float:
    match unit:
        case "J":    return value
        case "kJ":   return value * 1000.0
        case "Wh":   return value * 3600.0
        case "kWh":  return value * 3_600_000.0
        case _:      raise UnitConversionError(f"Unsupported energy unit: {unit!r}")


def _light_irradiance_to_W_m2(value: float, unit: str) -> float:
    match unit:
        case "W/m2": return value
        case _:      raise UnitConversionError(f"Unsupported light_irradiance unit: {unit!r}")


def _frequency_to_Hz(value: float, unit: str) -> float:
    match unit:
        case "Hz":   return value
        case "kHz":  return value * 1_000.0
        case "MHz":  return value * 1_000_000.0
        case "mHz":  return value / 1_000.0
        case _:      raise UnitConversionError(f"Unsupported frequency unit: {unit!r}")


def _temperature_to_C(value: float, unit: str) -> float:
    match unit:
        case "C":    return value
        case "K":    return value - 273.15
        case "F":    return (value - 32.0) * 5.0 / 9.0
        case _:      raise UnitConversionError(f"Unsupported temperature unit: {unit!r}")


# Spec §3.6: flowrate canonical unit is L/s
# Accepted: cc/s, m3/hr, L/s, CFM
def _flowrate_to_L_s(value: float, unit: str) -> float:
    match unit:
        case "L/s":    return value
        case "cc/s":   return value / 1000.0         # 1 L = 1000 cc
        case "m3/hr":  return value * 1000.0 / 3600.0  # 1 m3 = 1000 L, 1 hr = 3600 s
        case "CFM":    return value * 0.471947443     # 1 CFM ≈ 0.4719 L/s
        # L/hr is an officially accepted flowrate unit (spec §3.6, confirmed).
        case "L/hr":   return value / 3600.0          # L/hr -> L/s
        case _:        raise UnitConversionError(f"Unsupported flowrate unit: {unit!r}")


def _air_particulates_to_ppm(value: float, unit: str) -> float:
    match unit:
        case "ppm":  return value
        case "bpm":  return value  # bpm is treated as ppm per spec (same canonical)
        case _:      raise UnitConversionError(f"Unsupported air_particulates unit: {unit!r}")


def _o2_level_to_fraction(value: float, unit: str) -> float:
    match unit:
        case "%":    return value / 100.0
        case _:      raise UnitConversionError(f"Unsupported o2_level unit: {unit!r}")


def _co2_level_to_fraction(value: float, unit: str) -> float:
    match unit:
        case "%":    return value / 100.0
        case _:      raise UnitConversionError(f"Unsupported co2_level unit: {unit!r}")


def _volume_to_L(value: float, unit: str) -> float:
    match unit:
        case "L":    return value
        case "m3":   return value * 1000.0
        case "cm3":  return value / 1000.0
        case "ml":   return value / 1000.0
        case _:      raise UnitConversionError(f"Unsupported volume unit: {unit!r}")


def _weight_to_kg(value: float, unit: str) -> float:
    match unit:
        case "kg":   return value
        case "g":    return value / 1000.0
        case "mg":   return value / 1_000_000.0
        case _:      raise UnitConversionError(f"Unsupported weight unit: {unit!r}")


def _count_passthrough(value: float, unit: str) -> float:
    """Count has no unit conversion; pass through as-is."""
    return value


# ---------------------------------------------------------------------------
# Measurement-type dispatch table
# ---------------------------------------------------------------------------

CONVERTERS: dict[str, Callable[[float, str], float]] = {
    "voltage":          _voltage_to_V,
    "current":          _current_to_A,
    "power":            _power_to_W,
    "energy":           _energy_to_J,
    "light_irradiance": _light_irradiance_to_W_m2,
    "frequency":        _frequency_to_Hz,
    "temperature":      _temperature_to_C,
    "flowrate":         _flowrate_to_L_s,
    "air_particulates": _air_particulates_to_ppm,
    "o2_level":         _o2_level_to_fraction,
    "co2_level":        _co2_level_to_fraction,
    "volume":           _volume_to_L,
    "weight":           _weight_to_kg,
    "count":            _count_passthrough,
}

# Canonical unit label per measurement type (for display/documentation).
CANONICAL_UNITS: dict[str, str] = {
    "voltage":          "V",
    "current":          "A",
    "power":            "W",
    "energy":           "J",
    "light_irradiance": "W/m2",
    "frequency":        "Hz",
    "temperature":      "C",
    "flowrate":         "L/s",
    "air_particulates": "ppm",
    "o2_level":         "0-1",
    "co2_level":        "0-1",
    "volume":           "L",
    "weight":           "kg",
    "count":            "-",
}

# All accepted units per measurement type (for validation).
ACCEPTED_UNITS: dict[str, list[str]] = {
    "voltage":          ["V", "mV", "kV"],
    "current":          ["A", "mA"],
    "power":            ["W", "kW"],
    "energy":           ["Wh", "kWh", "J", "kJ"],
    "light_irradiance": ["W/m2"],
    "frequency":        ["Hz", "kHz", "MHz", "mHz"],
    "temperature":      ["C", "K", "F"],
    "flowrate":         ["cc/s", "m3/hr", "L/s", "CFM", "L/hr"],
    "air_particulates": ["ppm", "bpm"],
    "o2_level":         ["%"],
    "co2_level":        ["%"],
    "volume":           ["L", "m3", "cm3", "ml"],
    "weight":           ["kg", "g", "mg"],
    "count":            ["-", ""],
}


def to_canonical(measurement_type: str, value: float, unit: str) -> float:
    """Convert value from the given unit to its canonical unit.

    Args:
        measurement_type: One of the supported measurement type strings (spec §3.6).
        value: Numeric value in the given unit.
        unit: Source unit string (must be an accepted unit for the type).

    Returns:
        Value in canonical unit.

    Raises:
        UnitConversionError: If measurement_type or unit is not supported.
    """
    if measurement_type not in CONVERTERS:
        raise UnitConversionError(
            f"Unknown measurement type: {measurement_type!r}. "
            f"Supported types: {sorted(CONVERTERS)}"
        )
    return CONVERTERS[measurement_type](value, unit)


def validate_unit(measurement_type: str, unit: str) -> None:
    """Raise UnitConversionError if unit is not accepted for measurement_type."""
    if measurement_type not in ACCEPTED_UNITS:
        raise UnitConversionError(f"Unknown measurement type: {measurement_type!r}")
    accepted = ACCEPTED_UNITS[measurement_type]
    # count has no unit; treat empty/dash as valid
    if measurement_type == "count":
        return
    if unit not in accepted:
        raise UnitConversionError(
            f"Unit {unit!r} is not accepted for measurement type {measurement_type!r}. "
            f"Accepted: {accepted}"
        )


def canonical_unit(measurement_type: str) -> str:
    """Return the canonical unit label for a measurement type."""
    if measurement_type not in CANONICAL_UNITS:
        raise UnitConversionError(f"Unknown measurement type: {measurement_type!r}")
    return CANONICAL_UNITS[measurement_type]
