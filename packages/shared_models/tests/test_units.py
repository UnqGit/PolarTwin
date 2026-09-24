"""
Phase 0 tests: Unit conversion system.

Every accepted/canonical unit pair is tested.
Boundary and zero values are tested.
Error cases for unsupported units are tested.
"""

import pytest
import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from packages.shared_models.units import (
    to_canonical,
    validate_unit,
    canonical_unit,
    UnitConversionError,
    ACCEPTED_UNITS,
    CANONICAL_UNITS,
)


class TestVoltageConversion:
    """Spec §3.6: voltage canonical unit is V."""

    def test_V_is_passthrough(self):
        assert to_canonical("voltage", 240.0, "V") == pytest.approx(240.0)

    def test_mV_to_V(self):
        assert to_canonical("voltage", 1000.0, "mV") == pytest.approx(1.0)

    def test_kV_to_V(self):
        assert to_canonical("voltage", 1.0, "kV") == pytest.approx(1000.0)

    def test_zero_voltage(self):
        assert to_canonical("voltage", 0.0, "V") == pytest.approx(0.0)
        assert to_canonical("voltage", 0.0, "mV") == pytest.approx(0.0)
        assert to_canonical("voltage", 0.0, "kV") == pytest.approx(0.0)

    def test_unsupported_unit_raises(self):
        with pytest.raises(UnitConversionError):
            to_canonical("voltage", 1.0, "MV")

    def test_canonical_unit_is_V(self):
        assert canonical_unit("voltage") == "V"


class TestCurrentConversion:
    """Spec §3.6: current canonical unit is A."""

    def test_A_is_passthrough(self):
        assert to_canonical("current", 5.0, "A") == pytest.approx(5.0)

    def test_mA_to_A(self):
        assert to_canonical("current", 1000.0, "mA") == pytest.approx(1.0)

    def test_zero_current(self):
        assert to_canonical("current", 0.0, "A") == pytest.approx(0.0)

    def test_unsupported_unit_raises(self):
        with pytest.raises(UnitConversionError):
            to_canonical("current", 1.0, "kA")

    def test_canonical_unit_is_A(self):
        assert canonical_unit("current") == "A"


class TestPowerConversion:
    """Spec §3.6: power canonical unit is W."""

    def test_W_is_passthrough(self):
        assert to_canonical("power", 300.0, "W") == pytest.approx(300.0)

    def test_kW_to_W(self):
        assert to_canonical("power", 1.0, "kW") == pytest.approx(1000.0)

    def test_kW_generator_example(self):
        # Typical generator: 100 kW = 100,000 W
        assert to_canonical("power", 100.0, "kW") == pytest.approx(100_000.0)

    def test_zero_power(self):
        assert to_canonical("power", 0.0, "W") == pytest.approx(0.0)
        assert to_canonical("power", 0.0, "kW") == pytest.approx(0.0)

    def test_canonical_unit_is_W(self):
        assert canonical_unit("power") == "W"


class TestEnergyConversion:
    """Spec §3.6: energy canonical unit is J."""

    def test_J_is_passthrough(self):
        assert to_canonical("energy", 1000.0, "J") == pytest.approx(1000.0)

    def test_kJ_to_J(self):
        assert to_canonical("energy", 1.0, "kJ") == pytest.approx(1000.0)

    def test_Wh_to_J(self):
        assert to_canonical("energy", 1.0, "Wh") == pytest.approx(3600.0)

    def test_kWh_to_J(self):
        assert to_canonical("energy", 1.0, "kWh") == pytest.approx(3_600_000.0)

    def test_canonical_unit_is_J(self):
        assert canonical_unit("energy") == "J"


class TestFrequencyConversion:
    """Spec §3.6: frequency canonical unit is Hz."""

    def test_Hz_is_passthrough(self):
        assert to_canonical("frequency", 50.0, "Hz") == pytest.approx(50.0)

    def test_kHz_to_Hz(self):
        assert to_canonical("frequency", 1.0, "kHz") == pytest.approx(1000.0)

    def test_MHz_to_Hz(self):
        assert to_canonical("frequency", 1.0, "MHz") == pytest.approx(1_000_000.0)

    def test_mHz_to_Hz(self):
        assert to_canonical("frequency", 1000.0, "mHz") == pytest.approx(1.0)

    def test_canonical_unit_is_Hz(self):
        assert canonical_unit("frequency") == "Hz"


class TestTemperatureConversion:
    """Spec §3.6: temperature canonical unit is C (Celsius)."""

    def test_C_is_passthrough(self):
        assert to_canonical("temperature", 25.0, "C") == pytest.approx(25.0)

    def test_K_to_C(self):
        assert to_canonical("temperature", 273.15, "K") == pytest.approx(0.0, abs=1e-9)

    def test_K_to_C_room_temp(self):
        assert to_canonical("temperature", 298.15, "K") == pytest.approx(25.0, abs=1e-9)

    def test_F_to_C_freezing(self):
        assert to_canonical("temperature", 32.0, "F") == pytest.approx(0.0, abs=1e-9)

    def test_F_to_C_boiling(self):
        assert to_canonical("temperature", 212.0, "F") == pytest.approx(100.0, abs=1e-9)

    def test_F_to_C_body_temp(self):
        assert to_canonical("temperature", 98.6, "F") == pytest.approx(37.0, abs=1e-4)

    def test_canonical_unit_is_C(self):
        assert canonical_unit("temperature") == "C"


class TestFlowrateConversion:
    """Spec §3.6: flowrate canonical unit is L/s."""

    def test_L_s_is_passthrough(self):
        assert to_canonical("flowrate", 1.0, "L/s") == pytest.approx(1.0)

    def test_cc_s_to_L_s(self):
        assert to_canonical("flowrate", 1000.0, "cc/s") == pytest.approx(1.0)

    def test_m3_hr_to_L_s(self):
        # 1 m3/hr = 1000 L / 3600 s = 1000/3600 L/s
        assert to_canonical("flowrate", 1.0, "m3/hr") == pytest.approx(1000.0 / 3600.0)

    def test_CFM_to_L_s(self):
        # 1 CFM ≈ 0.47195 L/s
        assert to_canonical("flowrate", 1.0, "CFM") == pytest.approx(0.471947443, rel=1e-4)

    def test_L_hr_to_L_s(self):
        # L/hr is used in spec defaults (e.g. flowrate=0:135 L/hr)
        assert to_canonical("flowrate", 3600.0, "L/hr") == pytest.approx(1.0)

    def test_canonical_unit_is_L_s(self):
        assert canonical_unit("flowrate") == "L/s"


class TestAirParticulatesConversion:
    """Spec §3.6: air_particulates canonical unit is ppm."""

    def test_ppm_is_passthrough(self):
        assert to_canonical("air_particulates", 400.0, "ppm") == pytest.approx(400.0)

    def test_bpm_same_as_ppm(self):
        assert to_canonical("air_particulates", 400.0, "bpm") == pytest.approx(400.0)

    def test_canonical_unit_is_ppm(self):
        assert canonical_unit("air_particulates") == "ppm"


class TestO2LevelConversion:
    """Spec §3.6: o2_level canonical unit is 0-1 (fraction)."""

    def test_percent_to_fraction(self):
        assert to_canonical("o2_level", 21.0, "%") == pytest.approx(0.21)

    def test_zero_o2(self):
        assert to_canonical("o2_level", 0.0, "%") == pytest.approx(0.0)

    def test_100_percent_o2(self):
        assert to_canonical("o2_level", 100.0, "%") == pytest.approx(1.0)

    def test_canonical_unit_is_fraction(self):
        assert canonical_unit("o2_level") == "0-1"


class TestCO2LevelConversion:
    """Spec §3.6: co2_level canonical unit is 0-1 (fraction)."""

    def test_percent_to_fraction(self):
        assert to_canonical("co2_level", 0.04, "%") == pytest.approx(0.0004)

    def test_canonical_unit_is_fraction(self):
        assert canonical_unit("co2_level") == "0-1"


class TestVolumeConversion:
    """Spec §3.6: volume canonical unit is L."""

    def test_L_is_passthrough(self):
        assert to_canonical("volume", 100.0, "L") == pytest.approx(100.0)

    def test_m3_to_L(self):
        assert to_canonical("volume", 1.0, "m3") == pytest.approx(1000.0)

    def test_cm3_to_L(self):
        assert to_canonical("volume", 1000.0, "cm3") == pytest.approx(1.0)

    def test_ml_to_L(self):
        assert to_canonical("volume", 1000.0, "ml") == pytest.approx(1.0)

    def test_canonical_unit_is_L(self):
        assert canonical_unit("volume") == "L"


class TestWeightConversion:
    """Spec §3.6: weight canonical unit is kg."""

    def test_kg_is_passthrough(self):
        assert to_canonical("weight", 50.0, "kg") == pytest.approx(50.0)

    def test_g_to_kg(self):
        assert to_canonical("weight", 1000.0, "g") == pytest.approx(1.0)

    def test_mg_to_kg(self):
        assert to_canonical("weight", 1_000_000.0, "mg") == pytest.approx(1.0)

    def test_canonical_unit_is_kg(self):
        assert canonical_unit("weight") == "kg"


class TestLightIrradianceConversion:
    """Spec §3.6: light_irradiance canonical unit is W/m2."""

    def test_W_m2_is_passthrough(self):
        assert to_canonical("light_irradiance", 1000.0, "W/m2") == pytest.approx(1000.0)

    def test_canonical_unit_is_W_m2(self):
        assert canonical_unit("light_irradiance") == "W/m2"


class TestUnknownMeasurementType:
    """Error cases for unsupported measurement types."""

    def test_unknown_type_raises(self):
        with pytest.raises(UnitConversionError) as exc_info:
            to_canonical("resistance", 100.0, "Ohm")
        assert "resistance" in str(exc_info.value)

    def test_validate_unit_unknown_type_raises(self):
        with pytest.raises(UnitConversionError):
            validate_unit("resistance", "Ohm")

    def test_canonical_unit_unknown_type_raises(self):
        with pytest.raises(UnitConversionError):
            canonical_unit("resistance")


class TestValidateUnit:
    """Unit validation for each accepted set."""

    @pytest.mark.parametrize("unit", ["V", "mV", "kV"])
    def test_valid_voltage_units(self, unit):
        validate_unit("voltage", unit)  # Should not raise

    def test_invalid_voltage_unit_raises(self):
        with pytest.raises(UnitConversionError):
            validate_unit("voltage", "MV")

    @pytest.mark.parametrize("unit", ["W", "kW"])
    def test_valid_power_units(self, unit):
        validate_unit("power", unit)

    @pytest.mark.parametrize("unit", ["C", "K", "F"])
    def test_valid_temperature_units(self, unit):
        validate_unit("temperature", unit)
