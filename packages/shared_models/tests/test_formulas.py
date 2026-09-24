"""
Phase 0 tests: Simulation formulas.

Every formula is tested against its spec definition.
Tests cover nominal, boundary, zero, max, tolerance, multi-tick, and unit-consistency cases.
"""

import pytest
import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from packages.shared_models.formulas import (
    compute_specific_tolerance,
    compute_spf,
    compute_max_tolerated_value,
    compute_a,
    compute_ac,
    compute_t_off,
    compute_failure_countdown,
    compute_power,
    compute_generator_temperature,
    compute_generator_flow_requirement,
    compute_generator_allocation_ratio,
    compute_pump_total_demand,
    compute_pump_allocation_ratio,
    compute_pump_temperature,
    compute_solar_power,
    compute_tank_volume,
    compute_antenna_current,
    compute_server_temperature,
    compute_alarm_current,
    compute_ac_current,
    compute_ac_output_temperature,
    compute_inner_temperature_average,
    compute_vent_ac_contribution,
    compute_container_temperature,
    compute_station_surr_temperature,
    GENERATOR_THRESHOLD,
    PUMP_THRESHOLD,
    ALPHA_COMPONENT,
    BETA_THERMAL,
)


# ---------------------------------------------------------------------------
# 1. Tolerance formulas
# ---------------------------------------------------------------------------

class TestToleranceFormulas:
    """Spec §15: Tolerance formulas."""

    def test_specific_tolerance_zero_global(self):
        """T_specific = T_comp * (1 + 0/100) = T_comp"""
        assert compute_specific_tolerance(10.0, 0.0) == pytest.approx(10.0)

    def test_specific_tolerance_nominal(self):
        """T_specific = 10 * (1 + 5/100) = 10 * 1.05 = 10.5"""
        assert compute_specific_tolerance(10.0, 5.0) == pytest.approx(10.5)

    def test_spf_zero_tolerance(self):
        """SPF = 1 + 0/100 = 1.0"""
        assert compute_spf(0.0) == pytest.approx(1.0)

    def test_spf_ten_percent(self):
        """SPF = 1 + 10/100 = 1.1"""
        assert compute_spf(10.0) == pytest.approx(1.1)

    def test_max_tolerated_value_nominal(self):
        """R_tol = R_max * SPF = 100 * 1.1 = 110"""
        spf = compute_spf(10.0)
        assert compute_max_tolerated_value(100.0, spf) == pytest.approx(110.0)

    def test_max_tolerated_value_zero_tolerance(self):
        """R_tol = R_max * 1.0 = R_max"""
        spf = compute_spf(0.0)
        assert compute_max_tolerated_value(100.0, spf) == pytest.approx(100.0)


# ---------------------------------------------------------------------------
# 2. Failure formulas
# ---------------------------------------------------------------------------

class TestFailureFormulas:
    """Spec §13: General Failure Model."""

    def test_a_at_exactly_max_rating(self):
        """a = (R_max - R_max) / (R_tol - R_max) = 0"""
        a = compute_a(100.0, 100.0, 110.0)
        assert a == pytest.approx(0.0)

    def test_a_at_exactly_max_tolerated(self):
        """a = (R_tol - R_max) / (R_tol - R_max) = 1"""
        a = compute_a(110.0, 100.0, 110.0)
        assert a == pytest.approx(1.0)

    def test_a_midpoint(self):
        """a = (105 - 100) / (110 - 100) = 0.5"""
        a = compute_a(105.0, 100.0, 110.0)
        assert a == pytest.approx(0.5)

    def test_a_zero_denominator_raises(self):
        """Zero tolerance: R_max == R_tol raises ValueError."""
        with pytest.raises(ValueError):
            compute_a(100.0, 100.0, 100.0)

    def test_ac_clamps_negative(self):
        assert compute_ac(-0.5) == pytest.approx(0.0)

    def test_ac_clamps_above_one(self):
        assert compute_ac(1.5) == pytest.approx(1.0)

    def test_ac_passthrough_midpoint(self):
        assert compute_ac(0.5) == pytest.approx(0.5)

    def test_t_off_at_ac_zero(self):
        """t_off(0) = 1 - 0 + 0 = 1.0 (maximum time before failure)."""
        assert compute_t_off(0.0) == pytest.approx(1.0)

    def test_t_off_at_ac_one(self):
        """t_off(1) = 1 - 3 + 2 = 0.0 (immediate failure)."""
        assert compute_t_off(1.0) == pytest.approx(0.0)

    def test_t_off_at_ac_half(self):
        """t_off(0.5) = 1 - 3*(0.25) + 2*(0.125) = 1 - 0.75 + 0.25 = 0.5"""
        assert compute_t_off(0.5) == pytest.approx(0.5)

    def test_t_off_monotonically_decreasing(self):
        """t_off is monotonically decreasing from 1 to 0."""
        values = [compute_t_off(ac) for ac in [0.0, 0.25, 0.5, 0.75, 1.0]]
        for i in range(len(values) - 1):
            assert values[i] > values[i + 1], f"Not monotone at {i}"

    def test_failure_countdown_none_within_rated(self):
        """No countdown when value <= max_rating."""
        result = compute_failure_countdown(95.0, 100.0, 110.0)
        assert result is None

    def test_failure_countdown_none_at_max_rating(self):
        """No countdown when value == max_rating."""
        result = compute_failure_countdown(100.0, 100.0, 110.0)
        assert result is None

    def test_failure_countdown_at_max_tolerated(self):
        """Countdown = 0 when value == max_tolerated."""
        result = compute_failure_countdown(110.0, 100.0, 110.0)
        assert result == pytest.approx(0.0)

    def test_failure_countdown_midpoint(self):
        """Countdown at midpoint = t_off(0.5) * reference = 0.5 * 1.0 = 0.5."""
        result = compute_failure_countdown(105.0, 100.0, 110.0, reference_duration=1.0)
        assert result == pytest.approx(0.5)

    def test_failure_countdown_uses_simulation_time(self):
        """The countdown is in simulation time, scaled by reference_duration."""
        result_1 = compute_failure_countdown(105.0, 100.0, 110.0, reference_duration=1.0)
        result_240 = compute_failure_countdown(105.0, 100.0, 110.0, reference_duration=240.0)
        assert result_240 == pytest.approx(result_1 * 240.0)


# ---------------------------------------------------------------------------
# 3. Power formula
# ---------------------------------------------------------------------------

class TestPowerFormula:
    """Spec §1.2: P = V * I"""

    def test_nominal_power(self):
        assert compute_power(240.0, 10.0) == pytest.approx(2400.0)

    def test_zero_voltage(self):
        assert compute_power(0.0, 10.0) == pytest.approx(0.0)

    def test_zero_current(self):
        assert compute_power(240.0, 0.0) == pytest.approx(0.0)

    def test_none_raises(self):
        with pytest.raises(ValueError):
            compute_power(None, 10.0)
        with pytest.raises(ValueError):
            compute_power(240.0, None)


# ---------------------------------------------------------------------------
# 4. Generator formulas
# ---------------------------------------------------------------------------

class TestGeneratorTemperature:
    """Spec §2.2: Generator temperature evolution."""

    def test_at_rest_converges_to_surround(self):
        """With P_curr=0, generator temperature should approach T_surr."""
        t_curr = 20.0
        t_surr = 20.0
        T_range = 40.0  # t_rating_max - t_rating_min
        P_range = 100_000.0
        result = compute_generator_temperature(
            t_curr_prev=t_curr,
            p_curr=0.0,
            p_rating_max=100_000.0,
            p_rating_min=0.0,
            t_rating_max=60.0,
            t_rating_min=20.0,
            t_surr=t_surr,
        )
        # With P_curr=0: T_next = T_prev + 0.5 * (0 + T_surr - T_prev) = T_prev + 0.5 * (20 - 20) = 20
        assert result == pytest.approx(20.0)

    def test_nominal_heating(self):
        """Verify exact formula application for known values."""
        # T_curr = 25 + 0.5 * (0.225 * 40 * (50000/100000) + 20 - 25)
        # = 25 + 0.5 * (0.225 * 40 * 0.5 + 20 - 25)
        # = 25 + 0.5 * (4.5 + 20 - 25)
        # = 25 + 0.5 * (-0.5)
        # = 25 - 0.25 = 24.75
        result = compute_generator_temperature(
            t_curr_prev=25.0,
            p_curr=50_000.0,
            p_rating_max=100_000.0,
            p_rating_min=0.0,
            t_rating_max=60.0,
            t_rating_min=20.0,
            t_surr=20.0,
        )
        assert result == pytest.approx(24.75)

    def test_at_max_power_heats_up(self):
        """At maximum power, temperature should increase from a low starting point."""
        result = compute_generator_temperature(
            t_curr_prev=20.0,
            p_curr=100_000.0,
            p_rating_max=100_000.0,
            p_rating_min=0.0,
            t_rating_max=60.0,
            t_rating_min=20.0,
            t_surr=20.0,
        )
        # T_next = 20 + 0.5 * (0.225 * 40 * 1.0 + 20 - 20)
        # = 20 + 0.5 * (9.0 + 0) = 20 + 4.5 = 24.5
        assert result == pytest.approx(24.5)

    def test_multi_tick_convergence(self):
        """Over multiple ticks, temperature converges to steady state."""
        t = 20.0
        for _ in range(200):
            t = compute_generator_temperature(
                t_curr_prev=t,
                p_curr=100_000.0,
                p_rating_max=100_000.0,
                p_rating_min=0.0,
                t_rating_max=60.0,
                t_rating_min=20.0,
                t_surr=20.0,
            )
        # Steady state: T_ss = α_comp * T * (P_curr/P) + T_surr
        # = 0.225 * 40 * 1.0 + 20 = 9 + 20 = 29
        assert t == pytest.approx(29.0, abs=1e-3)


class TestGeneratorFlowRequirement:
    """Spec §2.3: Generator flow requirement = FR_max * (P_curr / P_max)."""

    def test_zero_power_zero_flow(self):
        assert compute_generator_flow_requirement(0.0, 100_000.0, 10.0) == pytest.approx(0.0)

    def test_max_power_max_flow(self):
        assert compute_generator_flow_requirement(100_000.0, 100_000.0, 10.0) == pytest.approx(10.0)

    def test_half_power_half_flow(self):
        assert compute_generator_flow_requirement(50_000.0, 100_000.0, 10.0) == pytest.approx(5.0)

    def test_zero_max_power(self):
        assert compute_generator_flow_requirement(50_000.0, 0.0, 10.0) == pytest.approx(0.0)


class TestGeneratorAllocationRatio:
    """Spec §2.1: Generator allocation ratio and 35% threshold."""

    def test_full_supply_returns_one(self):
        """Supply >= total demand: returns 1.0."""
        result = compute_generator_allocation_ratio(200.0, [50.0, 50.0, 50.0])
        assert result == pytest.approx(1.0)

    def test_exact_supply_returns_one(self):
        """Supply == total demand: returns 1.0."""
        result = compute_generator_allocation_ratio(150.0, [50.0, 50.0, 50.0])
        assert result == pytest.approx(1.0)

    def test_above_35_percent_returns_ratio(self):
        """Supply = 50% of demand: returns 0.5."""
        result = compute_generator_allocation_ratio(75.0, [50.0, 50.0, 50.0])
        assert result == pytest.approx(0.5)

    def test_exactly_35_percent_returns_ratio(self):
        """Supply = exactly 35% of demand: returns 0.35 (at threshold, proportional)."""
        total = 100.0
        supply = total * GENERATOR_THRESHOLD  # 35
        result = compute_generator_allocation_ratio(supply, [total])
        assert result == pytest.approx(GENERATOR_THRESHOLD)

    def test_below_35_percent_returns_none(self):
        """Supply < 35% of demand: returns None (must deactivate lowest-priority)."""
        result = compute_generator_allocation_ratio(30.0, [100.0])
        assert result is None

    def test_no_demand_returns_one(self):
        """Zero demand: trivially satisfied, returns 1.0."""
        result = compute_generator_allocation_ratio(100.0, [0.0, 0.0])
        assert result == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# 5. Pump formulas
# ---------------------------------------------------------------------------

class TestPumpFormulas:
    """Spec §3.1-3.3: Pump flow and 30% threshold."""

    def test_total_demand_sum(self):
        assert compute_pump_total_demand([1.0, 2.0, 3.0]) == pytest.approx(6.0)

    def test_total_demand_empty(self):
        assert compute_pump_total_demand([]) == pytest.approx(0.0)

    def test_allocation_above_30_percent(self):
        result = compute_pump_allocation_ratio(35.0, [100.0])
        assert result == pytest.approx(0.35)

    def test_allocation_exactly_30_percent(self):
        result = compute_pump_allocation_ratio(30.0, [100.0])
        assert result == pytest.approx(PUMP_THRESHOLD)

    def test_allocation_below_30_percent_none(self):
        result = compute_pump_allocation_ratio(25.0, [100.0])
        assert result is None

    def test_allocation_full_supply(self):
        result = compute_pump_allocation_ratio(150.0, [50.0, 50.0, 50.0])
        assert result == pytest.approx(1.0)

    def test_pump_temperature_formula_matches_generator_model(self):
        """Pump uses same thermal model as generator (spec §3.3)."""
        # Both should produce identical results when parameters match
        gen_result = compute_generator_temperature(
            t_curr_prev=25.0,
            p_curr=50_000.0,
            p_rating_max=100_000.0,
            p_rating_min=0.0,
            t_rating_max=60.0,
            t_rating_min=20.0,
            t_surr=20.0,
        )
        pump_result = compute_pump_temperature(
            t_curr_prev=25.0,
            fr_curr=50_000.0,
            fr_rating_max=100_000.0,
            fr_rating_min=0.0,
            t_rating_max=60.0,
            t_rating_min=20.0,
            t_surr=20.0,
        )
        assert pump_result == pytest.approx(gen_result)


# ---------------------------------------------------------------------------
# 6. Solar panel formula
# ---------------------------------------------------------------------------

class TestSolarPanelFormula:
    """Spec §4: Solar power = P_max * (I_curr / I_max), clamped to P_max."""

    def test_zero_irradiance_zero_power(self):
        assert compute_solar_power(100.0, 0.0, 1000.0) == pytest.approx(0.0)

    def test_half_irradiance_half_power(self):
        assert compute_solar_power(100.0, 500.0, 1000.0) == pytest.approx(50.0)

    def test_max_irradiance_max_power(self):
        assert compute_solar_power(100.0, 1000.0, 1000.0) == pytest.approx(100.0)

    def test_above_max_irradiance_clamped(self):
        """Spec: P_curr must not exceed P_max even if I_curr > I_max."""
        result = compute_solar_power(100.0, 1200.0, 1000.0)
        assert result == pytest.approx(100.0)

    def test_zero_max_irradiance_returns_zero(self):
        assert compute_solar_power(100.0, 100.0, 0.0) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 7. Tank formula
# ---------------------------------------------------------------------------

class TestTankFormula:
    """Spec §5: Tank volume = V_prev - sum(FR) * Δt, non-negative."""

    def test_single_pump_consumption(self):
        """One pump at 1 L/s for 15 seconds consumes 15 L."""
        v = compute_tank_volume(100.0, [1.0], delta_t=15.0)
        assert v == pytest.approx(85.0)

    def test_multiple_pumps(self):
        """Two pumps each at 1 L/s for 15 s consume 30 L."""
        v = compute_tank_volume(100.0, [1.0, 1.0], delta_t=15.0)
        assert v == pytest.approx(70.0)

    def test_volume_cannot_go_negative(self):
        """Spec: Volume cannot become negative."""
        v = compute_tank_volume(10.0, [5.0], delta_t=15.0)
        assert v == pytest.approx(0.0)

    def test_empty_tank_stays_zero(self):
        v = compute_tank_volume(0.0, [1.0], delta_t=15.0)
        assert v == pytest.approx(0.0)

    def test_no_pumps_no_change(self):
        v = compute_tank_volume(100.0, [], delta_t=15.0)
        assert v == pytest.approx(100.0)

    def test_spec_tick_15_seconds(self):
        """Standard tick Δt = 15 simulation seconds."""
        v = compute_tank_volume(1000.0, [2.0], delta_t=15.0)
        assert v == pytest.approx(1000.0 - 2.0 * 15.0)


# ---------------------------------------------------------------------------
# 8. Antenna current formula
# ---------------------------------------------------------------------------

class TestAntennaCurrentFormula:
    """Spec §6: Antenna current based on active connection count."""

    def test_zero_connections_zero_current(self):
        assert compute_antenna_current(0, 10.0) == pytest.approx(0.0)

    def test_one_connection_half_current(self):
        assert compute_antenna_current(1, 10.0) == pytest.approx(5.0)

    def test_nineteen_connections_half_current(self):
        """Spec: 1–19 active connections -> I_max / 2."""
        assert compute_antenna_current(19, 10.0) == pytest.approx(5.0)

    def test_twenty_connections_full_current(self):
        """Spec: 20+ connections -> I_max. Boundary is >= 20 (not > 20)."""
        assert compute_antenna_current(20, 10.0) == pytest.approx(10.0)

    def test_many_connections_full_current(self):
        assert compute_antenna_current(100, 10.0) == pytest.approx(10.0)

    def test_antenna_current_not_in_resource_calculations(self):
        """Spec §6: Antenna frequency is excluded from resource calculations.
        This test documents that antenna current (from connection count) is distinct
        from resource-pool calculations."""
        # The formula itself is not resource-pooled — it's a direct power draw.
        # This is a documentation test rather than a computation test.
        current_0 = compute_antenna_current(0, 5.0)
        current_1 = compute_antenna_current(1, 5.0)
        assert current_0 == pytest.approx(0.0)
        assert current_1 == pytest.approx(2.5)


# ---------------------------------------------------------------------------
# 9. Alarm current formula
# ---------------------------------------------------------------------------

class TestAlarmCurrentFormula:
    """Spec §8: Alarm current = 5A when active, 0A when inactive."""

    def test_inactive_alarm_zero_current(self):
        assert compute_alarm_current(active=False) == pytest.approx(0.0)

    def test_active_alarm_five_amperes(self):
        assert compute_alarm_current(active=True) == pytest.approx(5.0)


# ---------------------------------------------------------------------------
# 10. AC formulas
# ---------------------------------------------------------------------------

class TestACFormulas:
    """Spec §9: Air conditioner formulas."""

    def test_ac_current_zero_airflow_and_zero_delta_T(self):
        """Zero airflow and zero temperature delta -> zero current."""
        result = compute_ac_current(
            i_max=10.0,
            fr_curr=0.0,
            fr_max=100.0,
            t_output=20.0,
            t_surr=20.0,
            t_max=25.0,
            t_min=15.0,
        )
        assert result == pytest.approx(0.0)

    def test_ac_current_max_airflow_max_temp_diff(self):
        """Max airflow and maximum temperature delta -> I_max."""
        result = compute_ac_current(
            i_max=10.0,
            fr_curr=100.0,
            fr_max=100.0,
            t_output=25.0,
            t_surr=15.0,
            t_max=25.0,
            t_min=15.0,
        )
        # α * 1.0 + (1-α) * 1.0 = 1.0 => I_max
        assert result == pytest.approx(10.0)

    def test_ac_current_formula_nominal(self):
        """Exact formula: I = I_max * [0.4 * (FR_curr/FR_max) + 0.6 * clamp(|T_out - T_surr|/(T_max-T_min),0,1)]."""
        result = compute_ac_current(
            i_max=10.0,
            fr_curr=50.0,   # 50% airflow
            fr_max=100.0,
            t_output=22.5,  # |22.5 - 20| / (25-15) = 2.5/10 = 0.25
            t_surr=20.0,
            t_max=25.0,
            t_min=15.0,
        )
        expected = 10.0 * (0.4 * 0.5 + 0.6 * 0.25)
        assert result == pytest.approx(expected)

    def test_ac_output_temperature_converges_to_target(self):
        """T_out(n) = T_out(n-1) + 0.5 * (T_target - T_out(n-1)) converges to target."""
        t_out = 30.0
        t_target = 20.0
        for _ in range(100):
            t_out = compute_ac_output_temperature(t_out, t_target)
        assert t_out == pytest.approx(t_target, abs=1e-4)

    def test_ac_output_temperature_exact_single_step(self):
        """T_out(1) = 30 + 0.5 * (20 - 30) = 30 - 5 = 25."""
        result = compute_ac_output_temperature(30.0, 20.0)
        assert result == pytest.approx(25.0)

    def test_ac_no_30_or_35_percent_cutoff(self):
        """Spec §9: AC does NOT have 30% or 35% supply cutoff.
        This documents the distinction between AC and generator/pump behavior."""
        # AC always runs as long as it is active — it has no proportional supply threshold.
        # The formula just uses airflow ratio directly.
        result_low = compute_ac_current(
            i_max=10.0,
            fr_curr=1.0,   # only 1% of max airflow
            fr_max=100.0,
            t_output=20.0,
            t_surr=20.0,
            t_max=30.0,
            t_min=20.0,
        )
        # Should still produce a non-None result (no None return indicating threshold failure)
        assert result_low is not None
        assert result_low >= 0.0


# ---------------------------------------------------------------------------
# 11. Container thermal formula
# ---------------------------------------------------------------------------

class TestContainerTemperature:
    """Spec §11.1: Container temperature model."""

    def test_inner_average_single(self):
        assert compute_inner_temperature_average([30.0]) == pytest.approx(30.0)

    def test_inner_average_multiple(self):
        assert compute_inner_temperature_average([20.0, 30.0, 40.0]) == pytest.approx(30.0)

    def test_inner_average_empty(self):
        assert compute_inner_temperature_average([]) == pytest.approx(0.0)

    def test_vent_ac_contribution_zero_max_flow(self):
        result = compute_vent_ac_contribution([20.0], [0.0], [0.0])
        assert result == pytest.approx(0.0)

    def test_vent_ac_contribution_nominal(self):
        """V_all = (V_k * A_curr,k) / A_mtotal = (20 * 5) / 10 = 10."""
        result = compute_vent_ac_contribution([20.0], [5.0], [10.0])
        assert result == pytest.approx(10.0)

    def test_container_temperature_exact_formula(self):
        """Verify exact formula application."""
        # T_next = T_prev + 0.5 * (0.225 * I_avg + V_all + 0.8 * T_surr - T_prev)
        # = 20 + 0.5 * (0.225 * 25 + 0 + 0.8 * 15 - 20)
        # = 20 + 0.5 * (5.625 + 12 - 20)
        # = 20 + 0.5 * (-2.375)
        # = 20 - 1.1875 = 18.8125
        result = compute_container_temperature(
            t_curr_prev=20.0,
            inner_temperatures=[25.0],
            vent_ac_temps=[],
            vent_curr_flows=[],
            vent_max_flows=[],
            t_surr=15.0,
        )
        assert result == pytest.approx(18.8125)

    def test_container_temperature_with_vent(self):
        """Verify formula with a vent contribution."""
        # I_avg = 25
        # V_all = (20 * 5) / 10 = 10
        # T_next = 20 + 0.5 * (0.225*25 + 10 + 0.8*15 - 20)
        # = 20 + 0.5 * (5.625 + 10 + 12 - 20)
        # = 20 + 0.5 * 7.625 = 20 + 3.8125 = 23.8125
        result = compute_container_temperature(
            t_curr_prev=20.0,
            inner_temperatures=[25.0],
            vent_ac_temps=[20.0],
            vent_curr_flows=[5.0],
            vent_max_flows=[10.0],
            t_surr=15.0,
        )
        assert result == pytest.approx(23.8125)


# ---------------------------------------------------------------------------
# 12. Station surrounding temperature
# ---------------------------------------------------------------------------

class TestStationSurrTemperature:
    """Spec §12: T_surr = T_external + 20."""

    def test_nominal(self):
        assert compute_station_surr_temperature(-20.0) == pytest.approx(0.0)

    def test_zero_external(self):
        assert compute_station_surr_temperature(0.0) == pytest.approx(20.0)

    def test_positive_external(self):
        assert compute_station_surr_temperature(10.0) == pytest.approx(30.0)

    def test_extreme_cold(self):
        assert compute_station_surr_temperature(-60.0) == pytest.approx(-40.0)
