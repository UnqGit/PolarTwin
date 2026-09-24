"""
Authoritative simulation formulas for PolarTwin.

Every formula in this module is derived directly from the specification and must
not be approximated, "improved", or substituted with conceptually similar formulas.

Specification references are included for each formula.

All parameters use canonical units as defined in spec §3.6.
"""

from __future__ import annotations

import math


# ---------------------------------------------------------------------------
# Constants used in formulas
# ---------------------------------------------------------------------------

ALPHA_COMPONENT: float = 0.225
"""Coefficient for component self-heating (spec §2.2)."""

BETA_THERMAL: float = 0.5
"""Damping coefficient for thermal models (spec §2.2, §3.3, §9.4, §11.1)."""

ALPHA_INNER: float = 0.225
"""Container inner component temperature coefficient (spec §11.1)."""

ALPHA_SURR: float = 0.8
"""Container surrounding/parent temperature coefficient (spec §11.1)."""

ALPHA_AC: float = 0.4
"""Air conditioner current split coefficient (spec §9.1)."""

BETA_AC_OUTPUT: float = 0.5
"""Air conditioner output temperature damping (spec §9.4)."""

GENERATOR_THRESHOLD: float = 0.35
"""Generator must be able to supply at least 35% of demand to proportionally allocate (spec §2.1)."""

PUMP_THRESHOLD: float = 0.30
"""Pump must be able to supply at least 30% of demand to proportionally allocate (spec §3.2)."""

STATION_MIN_SURR_DELTA: float = 20.0
"""Station temperature is at least external + 20°C (spec §12)."""


# ---------------------------------------------------------------------------
# 1. Tolerance formulas (spec §15)
# ---------------------------------------------------------------------------

def compute_specific_tolerance(component_tolerance: float, global_tolerance: float) -> float:
    """
    Compute the specific (effective) tolerance for a component.

    Spec §15 (Tolerance):
        T_specific = T_component * (1 + T_global / 100)

    Args:
        component_tolerance: Component-specific tolerance percentage.
        global_tolerance: Global tolerance percentage.

    Returns:
        Specific tolerance percentage.
    """
    return component_tolerance * (1.0 + global_tolerance / 100.0)


def compute_spf(specific_tolerance: float) -> float:
    """
    Compute the Specific tolerance Factor (SPF).

    Spec §15:
        SPF = 1 + T_specific / 100

    Args:
        specific_tolerance: Specific tolerance percentage (from compute_specific_tolerance).

    Returns:
        SPF multiplier.
    """
    return 1.0 + specific_tolerance / 100.0


def compute_max_tolerated_value(max_rating_value: float, spf: float) -> float:
    """
    Compute the maximum tolerated (absolute) value.

    Spec §15:
        R_tol = R_max * SPF

    Args:
        max_rating_value: Maximum rated value in canonical unit.
        spf: Specific tolerance Factor from compute_spf.

    Returns:
        Maximum tolerated value in canonical unit.
    """
    return max_rating_value * spf


# ---------------------------------------------------------------------------
# 2. Failure duration formula (spec §13 General Failure Model)
# ---------------------------------------------------------------------------

def compute_a(
    current_value: float,
    max_rating_value: float,
    max_tolerated_value: float,
) -> float:
    """
    Compute the raw exceedance parameter 'a'.

    Spec §13:
        a = (current_value - max_rating_value)
            / (max_tolerated_value - max_rating_value)

    Args:
        current_value: Current state value in canonical unit.
        max_rating_value: Maximum rated value (R_max).
        max_tolerated_value: Maximum tolerated value (R_tol = R_max * SPF).

    Returns:
        Raw exceedance parameter. May be outside [0, 1].

    Raises:
        ValueError: If denominator is zero (max_tolerated_value == max_rating_value).
    """
    denominator = max_tolerated_value - max_rating_value
    if denominator == 0.0:
        raise ValueError(
            "Cannot compute failure parameter 'a': "
            "max_tolerated_value == max_rating_value (zero tolerance). "
            "Apply a non-zero tolerance or use direct failure logic."
        )
    return (current_value - max_rating_value) / denominator


def compute_ac(a: float) -> float:
    """
    Clamp 'a' to [0, 1] to produce 'a_c'.

    Spec §13:
        a_c = clamp(a, 0, 1)

    Args:
        a: Raw exceedance parameter from compute_a.

    Returns:
        Clamped parameter a_c in [0, 1].
    """
    return max(0.0, min(1.0, a))


def compute_t_off(ac: float) -> float:
    """
    Compute the normalized time-to-failure (t_off).

    Spec §13:
        t_off = 1 - 3*a_c^2 + 2*a_c^3

    This is a Hermite/smoothstep-based curve:
      - ac=0: t_off=1.0 (maximum time before failure)
      - ac=1: t_off=0.0 (immediate failure)
      - Monotonically decreasing from 1 to 0.

    Args:
        ac: Clamped parameter a_c in [0, 1] from compute_ac.

    Returns:
        Normalized time-to-failure in [0, 1].
        Multiply by a reference duration to get actual countdown time.
    """
    ac2 = ac * ac
    ac3 = ac2 * ac
    return 1.0 - 3.0 * ac2 + 2.0 * ac3


def compute_failure_countdown(
    current_value: float,
    max_rating_value: float,
    max_tolerated_value: float,
    reference_duration: float = 1.0,
) -> float | None:
    """
    Compute the failure countdown (in simulation time units) for a component
    that has exceeded its max_rating_value.

    Returns None if the current_value is within the rated range (no countdown needed).

    The countdown uses simulation time, not wall-clock time (spec §13).

    Args:
        current_value: Current state value.
        max_rating_value: Maximum rated value.
        max_tolerated_value: Maximum tolerated value (R_max * SPF).
        reference_duration: Base duration in simulation time units from which
                           t_off is scaled. Default 1.0 (normalized).

    Returns:
        Remaining simulation time before failure, or None if within rated range.
    """
    if current_value <= max_rating_value:
        return None

    try:
        a = compute_a(current_value, max_rating_value, max_tolerated_value)
    except ValueError:
        # Zero tolerance: any exceedance is immediate failure
        return 0.0

    ac = compute_ac(a)
    t_off = compute_t_off(ac)
    return t_off * reference_duration


# ---------------------------------------------------------------------------
# 3. General power formula (spec §1.2)
# ---------------------------------------------------------------------------

def compute_power(voltage: float | None, current: float | None) -> float:
    """
    Compute power from voltage and current.

    Spec §1.2:
        P = V * I

    If an explicit power value is provided by the component state, that value
    takes precedence and this function should NOT be called (caller responsibility).

    Args:
        voltage: Voltage in V (canonical).
        current: Current in A (canonical).

    Returns:
        Power in W (canonical).

    Raises:
        ValueError: If either argument is None.
    """
    if voltage is None or current is None:
        raise ValueError("Both voltage and current must be provided to compute power.")
    return voltage * current


# ---------------------------------------------------------------------------
# 4. Generator temperature formula (spec §2.2)
# ---------------------------------------------------------------------------

def compute_generator_temperature(
    t_curr_prev: float,
    p_curr: float,
    p_rating_max: float,
    p_rating_min: float,
    t_rating_max: float,
    t_rating_min: float,
    t_surr: float,
    alpha_component: float = ALPHA_COMPONENT,
    beta: float = BETA_THERMAL,
) -> float:
    """
    Compute the generator temperature for the current tick.

    Spec §2.2:
        T_curr(n) = T_curr(n-1) + β * (α_component * T * (P_curr / P) + T_surr - T_curr(n-1))

    where:
        T = maximum_rating_temperature - minimum_rating_temperature
        P = maximum_power_output - minimum_power_output
        α_component = 0.225
        β = 0.5

    Args:
        t_curr_prev: Generator temperature at previous tick (°C canonical).
        p_curr: Current power output (W canonical).
        p_rating_max: Maximum rated power output (W canonical).
        p_rating_min: Minimum rated power output (W canonical).
        t_rating_max: Maximum rated temperature (°C canonical).
        t_rating_min: Minimum rated temperature (°C canonical).
        t_surr: Surrounding temperature (containing container temperature, °C).
        alpha_component: Self-heating coefficient (default 0.225).
        beta: Damping coefficient (default 0.5).

    Returns:
        Generator temperature at current tick (°C canonical).
    """
    T = t_rating_max - t_rating_min  # temperature range
    P = p_rating_max - p_rating_min  # power range

    # If P == 0, power ratio is undefined; treat as zero contribution
    power_ratio = (p_curr / P) if P != 0.0 else 0.0

    return t_curr_prev + beta * (
        alpha_component * T * power_ratio + t_surr - t_curr_prev
    )


# ---------------------------------------------------------------------------
# 5. Generator flow requirement formula (spec §2.3)
# ---------------------------------------------------------------------------

def compute_generator_flow_requirement(
    p_curr: float,
    p_rating_max: float,
    fr_rating_max: float,
) -> float:
    """
    Compute required flowrate for the generator at current power.

    Spec §2.3:
        FR_required = FR_rating_max * (P_curr / P_rating_max)

    Args:
        p_curr: Current power output (W canonical).
        p_rating_max: Maximum rated power output (W canonical).
        fr_rating_max: Maximum rated flowrate (L/s canonical).

    Returns:
        Required flowrate in L/s canonical.
    """
    if p_rating_max == 0.0:
        return 0.0
    return fr_rating_max * (p_curr / p_rating_max)


# ---------------------------------------------------------------------------
# 6. Generator proportional allocation formula (spec §2.1)
# ---------------------------------------------------------------------------

def compute_generator_allocation_ratio(
    p_generator: float,
    demands: list[float],
) -> float | None:
    """
    Compute the proportional allocation ratio x for generator distribution.

    Spec §2.1:
        x = P_D / (P_A + P_B + P_C)

    If the generator can supply at least GENERATOR_THRESHOLD (35%) of total demand,
    return x. Otherwise return None (caller must deactivate lowest-priority component).

    Args:
        p_generator: Generator's available power output (W).
        demands: List of power demands from connected components (W).

    Returns:
        Ratio x in (0, 1] if supply >= 35% of demand, else None.
        Returns 1.0 (full supply) if p_generator >= total demand.
    """
    total_demand = sum(demands)
    if total_demand <= 0.0:
        return 1.0  # No demand; trivially satisfied

    if p_generator >= total_demand:
        return 1.0  # Full supply available

    ratio = p_generator / total_demand
    if ratio >= GENERATOR_THRESHOLD:
        return ratio
    return None  # Below threshold; must deactivate lowest-priority component


# ---------------------------------------------------------------------------
# 7. Pump flow formulas (spec §3)
# ---------------------------------------------------------------------------

def compute_pump_total_demand(demands: list[float]) -> float:
    """
    Compute total flowrate demand on a pump.

    Spec §3.1:
        FR_P = FR_A + FR_B + FR_C

    Args:
        demands: Flowrate demands from connected components (L/s).

    Returns:
        Total demand in L/s.
    """
    return sum(demands)


def compute_pump_allocation_ratio(
    fr_pump: float,
    demands: list[float],
) -> float | None:
    """
    Compute proportional allocation ratio for pump flow.

    Spec §3.2:
        x = FR_P / (FR_A + FR_B + FR_C)

    If FR_pump can supply at least PUMP_THRESHOLD (30%) of total demand, return x.
    Otherwise return None.

    Args:
        fr_pump: Pump's maximum available flowrate (L/s).
        demands: List of flowrate demands (L/s).

    Returns:
        Ratio x in (0, 1] if supply >= 30%, else None.
    """
    total_demand = sum(demands)
    if total_demand <= 0.0:
        return 1.0

    if fr_pump >= total_demand:
        return 1.0

    ratio = fr_pump / total_demand
    if ratio >= PUMP_THRESHOLD:
        return ratio
    return None


def compute_pump_temperature(
    t_curr_prev: float,
    fr_curr: float,
    fr_rating_max: float,
    fr_rating_min: float,
    t_rating_max: float,
    t_rating_min: float,
    t_surr: float,
    alpha_component: float = ALPHA_COMPONENT,
    beta: float = BETA_THERMAL,
) -> float:
    """
    Compute pump temperature using the generator temperature model but with flowrate ratio.

    Spec §3.3: Uses the same model as generator, with FR_curr/FR instead of P_curr/P.

    Args: Same structure as compute_generator_temperature, with flowrate substituted for power.

    Returns:
        Pump temperature at current tick (°C canonical).
    """
    T = t_rating_max - t_rating_min  # temperature range
    FR = fr_rating_max - fr_rating_min  # flowrate range

    flow_ratio = (fr_curr / FR) if FR != 0.0 else 0.0

    return t_curr_prev + beta * (
        alpha_component * T * flow_ratio + t_surr - t_curr_prev
    )


# ---------------------------------------------------------------------------
# 8. Solar panel power formula (spec §4)
# ---------------------------------------------------------------------------

def compute_solar_power(
    p_max: float,
    i_curr: float,
    i_max: float,
) -> float:
    """
    Compute solar panel current power output.

    Spec §4:
        P_curr = P_max * (I_curr / I_max)

    The resulting power must not exceed P_max.

    Args:
        p_max: Maximum rated output power (W canonical).
        i_curr: Current light irradiance (W/m² canonical).
        i_max: Maximum rated light irradiance (W/m² canonical).

    Returns:
        Current power output in W, clamped to [0, p_max].
    """
    if i_max <= 0.0:
        return 0.0
    return min(p_max, p_max * (i_curr / i_max))


# ---------------------------------------------------------------------------
# 9. Tank volume evolution formula (spec §5)
# ---------------------------------------------------------------------------

def compute_tank_volume(
    v_curr_prev: float,
    pump_flowrates: list[float],
    delta_t: float,
) -> float:
    """
    Compute current tank volume after one simulation tick.

    Spec §5:
        V_curr(n) = V_curr(n-1) - (sum FR_pump) * Δt

    Volume cannot become negative (spec §5).

    Alternate supply (spec §5): A tank's "alternate supply" means a secondary tank
    that serves the same consumers when the primary is empty. It is NOT an inflow
    from other components into this tank. Each tank only drains via connected pumps;
    replenishment comes from a separate modelled tank switching over.

    Args:
        v_curr_prev: Volume at previous tick (L canonical).
        pump_flowrates: List of flowrates drawn by connected pumps (L/s canonical).
        delta_t: Elapsed simulation time for this tick (seconds).
                 For standard tick: SECONDS_PER_SIMULATION_TICK = 15 seconds.

    Returns:
        Current volume in L canonical, clamped to non-negative.
    """
    total_outflow = sum(pump_flowrates) * delta_t
    return max(0.0, v_curr_prev - total_outflow)


# ---------------------------------------------------------------------------
# 10. Antenna current formula (spec §6)
# ---------------------------------------------------------------------------

def compute_antenna_current(
    active_connections: int,
    i_max: float,
) -> float:
    """
    Compute antenna current requirement based on active connection count.

    Spec §6:
        0 active connections    -> 0 A
        1–19 active connections -> I_max / 2
        20+ active connections  -> I_max

    The boundary is >= 20 for full current (NOT > 20).

    Args:
        active_connections: Number of currently active connections.
        i_max: Maximum rated current (A canonical).

    Returns:
        Required current in A canonical.
    """
    if active_connections == 0:
        return 0.0
    elif active_connections < 20:  # 1–19
        return i_max / 2.0
    else:  # 20 or more
        return i_max


# ---------------------------------------------------------------------------
# 11. Server temperature (spec §7)
# ---------------------------------------------------------------------------

def compute_server_temperature(
    t_curr_prev: float,
    p_required: float,
    p_rating_max: float,
    p_rating_min: float,
    t_rating_max: float,
    t_rating_min: float,
    t_surr: float,
    alpha_component: float = ALPHA_COMPONENT,
    beta: float = BETA_THERMAL,
) -> float:
    """
    Compute server temperature using the generator temperature model with P_required/P.

    Spec §7: Same model as generator, but uses P_required instead of P_curr.

    Args:
        t_curr_prev: Server temperature at previous tick (°C).
        p_required: Server's current power requirement (W).
        p_rating_max: Maximum rated input power (W).
        p_rating_min: Minimum rated input power (W).
        t_rating_max: Maximum rated temperature (°C).
        t_rating_min: Minimum rated temperature (°C).
        t_surr: Surrounding temperature (containing container, °C).
        alpha_component: Self-heating coefficient (default 0.225).
        beta: Damping coefficient (default 0.5).

    Returns:
        Server temperature at current tick (°C).
    """
    T = t_rating_max - t_rating_min
    P = p_rating_max - p_rating_min

    power_ratio = (p_required / P) if P != 0.0 else 0.0

    return t_curr_prev + beta * (
        alpha_component * T * power_ratio + t_surr - t_curr_prev
    )


# ---------------------------------------------------------------------------
# 12. Alarm current formula (spec §8)
# ---------------------------------------------------------------------------

def compute_alarm_current(active: bool) -> float:
    """
    Compute alarm current requirement.

    Spec §8:
        inactive -> 0 A
        active   -> 5 A

    Args:
        active: Whether the alarm is in active status.

    Returns:
        Required current in A canonical.
    """
    return 5.0 if active else 0.0


# ---------------------------------------------------------------------------
# 13. Air conditioner formulas (spec §9)
# ---------------------------------------------------------------------------

def compute_ac_current(
    i_max: float,
    fr_curr: float,
    fr_max: float,
    t_output: float,
    t_surr: float,
    t_max: float,
    t_min: float,
    alpha: float = ALPHA_AC,
) -> float:
    """
    Compute air conditioner current requirement.

    Spec §9.1:
        I_required = I_max * [α * (FR_curr / FR_max)
                              + (1 - α) * clamp(|T_output - T_surr| / (T_max - T_min), 0, 1)]

    where α = 0.4.

    Args:
        i_max: Maximum rated current (A canonical).
        fr_curr: Current airflow output (L/s canonical).
        fr_max: Maximum rated airflow output (L/s canonical).
        t_output: Current output temperature (°C).
        t_surr: Surrounding temperature (°C).
        t_max: Maximum rated output temperature (°C).
        t_min: Minimum rated output temperature (°C).
        alpha: Split coefficient (default 0.4).

    Returns:
        Required current in A canonical.
    """
    # Airflow term
    flow_ratio = (fr_curr / fr_max) if fr_max > 0.0 else 0.0

    # Temperature difference term (clamped to [0, 1])
    t_range = t_max - t_min
    if t_range > 0.0:
        t_diff_ratio = abs(t_output - t_surr) / t_range
    else:
        t_diff_ratio = 0.0
    t_diff_ratio = max(0.0, min(1.0, t_diff_ratio))

    return i_max * (alpha * flow_ratio + (1.0 - alpha) * t_diff_ratio)


def compute_ac_output_temperature(
    t_out_prev: float,
    t_target: float,
    beta: float = BETA_AC_OUTPUT,
) -> float:
    """
    Compute air conditioner output temperature evolution.

    Spec §9.4:
        T_out(n) = T_out(n-1) + β * (T_target - T_out(n-1))

    where β = 0.5.

    Args:
        t_out_prev: Output temperature at previous tick (°C).
        t_target: Current target temperature (°C).
        beta: Damping coefficient (default 0.5).

    Returns:
        Output temperature at current tick (°C).
    """
    return t_out_prev + beta * (t_target - t_out_prev)


# ---------------------------------------------------------------------------
# 14. Container thermal formula (spec §11.1)
# ---------------------------------------------------------------------------

def compute_inner_temperature_average(inner_temperatures: list[float]) -> float:
    """
    Compute I_avg: average temperature of inner components.

    Spec §11.1:
        I_avg = (1 / N_inner) * sum(T_k)

    Args:
        inner_temperatures: List of temperatures of inner components (°C).

    Returns:
        Average temperature in °C, or 0.0 if no inner components.
    """
    if not inner_temperatures:
        return 0.0
    return sum(inner_temperatures) / len(inner_temperatures)


def compute_vent_ac_contribution(
    vent_ac_temps: list[float],
    vent_curr_flows: list[float],
    vent_max_flows: list[float],
) -> float:
    """
    Compute V_all: airflow-weighted AC temperature contribution.

    Spec §11.1:
        V_all = (1 / A_mtotal) * sum(V_k * A_curr,k)
        A_mtotal = sum(A_max,k)

    Args:
        vent_ac_temps: Output temperature of AC associated with each vent (°C).
        vent_curr_flows: Current airflow through each vent (L/s canonical).
        vent_max_flows: Maximum airflow rating for each vent (L/s canonical).

    Returns:
        Airflow-weighted temperature contribution (°C), or 0.0 if no vents.
    """
    n = len(vent_ac_temps)
    if n == 0:
        return 0.0

    a_mtotal = sum(vent_max_flows)
    if a_mtotal <= 0.0:
        return 0.0

    weighted_sum = sum(
        vent_ac_temps[k] * vent_curr_flows[k]
        for k in range(n)
    )
    return weighted_sum / a_mtotal


def compute_container_temperature(
    t_curr_prev: float,
    inner_temperatures: list[float],
    vent_ac_temps: list[float],
    vent_curr_flows: list[float],
    vent_max_flows: list[float],
    t_surr: float,
    beta: float = BETA_THERMAL,
    alpha_inner: float = ALPHA_INNER,
    alpha_surr: float = ALPHA_SURR,
) -> float:
    """
    Compute container temperature at the current tick.

    Spec §11.1:
        T_curr(n) = T_curr(n-1) + β * (α_inner * I_avg + V_all + α_surr * T_surr - T_curr(n-1))

    where:
        β = 0.5
        α_inner = 0.225
        α_surr = 0.8

    Args:
        t_curr_prev: Container temperature at previous tick (°C).
        inner_temperatures: Temperatures of inner components (°C).
        vent_ac_temps: Output temperature of ACs for each vent (°C).
        vent_curr_flows: Current airflow through each vent (L/s).
        vent_max_flows: Maximum airflow rating for each vent (L/s).
        t_surr: Parent/surrounding container temperature (°C).
        beta: Damping coefficient (default 0.5).
        alpha_inner: Inner component influence coefficient (default 0.225).
        alpha_surr: Surrounding temperature influence coefficient (default 0.8).

    Returns:
        Container temperature at current tick (°C).
    """
    i_avg = compute_inner_temperature_average(inner_temperatures)
    v_all = compute_vent_ac_contribution(vent_ac_temps, vent_curr_flows, vent_max_flows)

    return t_curr_prev + beta * (
        alpha_inner * i_avg + v_all + alpha_surr * t_surr - t_curr_prev
    )


# ---------------------------------------------------------------------------
# 15. Station surrounding temperature formula (spec §12)
# ---------------------------------------------------------------------------

def compute_station_surr_temperature(t_external: float) -> float:
    """
    Compute the station's minimum surrounding temperature.

    Spec §12:
        T_surr = T_external + 20

    Args:
        t_external: Current external (outside) temperature (°C canonical).

    Returns:
        Station surrounding temperature (°C).
    """
    return t_external + STATION_MIN_SURR_DELTA
