import math
from typing import Any, Dict

def clamp(val, min_val, max_val):
    return max(min_val, min(val, max_val))

def calculate_failure_countdown(current, max_rating, max_tolerated):
    """
    toff = 1 - 3ac^2 + 2ac^3
    where ac = clamp(a, 0, 1)
    and a = (current - max_rating) / (max_tolerated - max_rating)
    """
    if max_tolerated <= max_rating:
        return 1.0 # Avoid division by zero
    a = (current - max_rating) / (max_tolerated - max_rating)
    ac = clamp(a, 0.0, 1.0)
    return 1.0 - 3.0 * (ac ** 2) + 2.0 * (ac ** 3)

def get_max_tolerated_value(max_rating, comp_tolerance, global_tolerance):
    """
    Tspecific = Tcomponent * (1 + Tglobal/100)
    SPF = 1 + Tspecific/100
    max_tolerated = max_rating * SPF
    """
    t_specific = comp_tolerance * (1.0 + global_tolerance / 100.0)
    spf = 1.0 + t_specific / 100.0
    return max_rating * spf

def generator_temperature(t_prev: float, t_surr: float, p_curr: float, p_max: float, p_min: float,
                          t_max: float, t_min: float, alpha: float = 0.225, beta: float = 0.5):
    """
    Tcurr(n) = Tcurr(n-1) + beta * [ alpha * T * (Pcurr/P) + Tsurr - Tcurr(n-1) ]
    """
    p_range = p_max - p_min
    if p_range <= 0: p_range = 1
    t_range = t_max - t_min
    
    return t_prev + beta * (alpha * t_range * (p_curr / p_range) + t_surr - t_prev)

def pump_temperature(t_prev: float, t_surr: float, fr_curr: float, fr_max: float, fr_min: float,
                     t_max: float, t_min: float, alpha: float = 0.225, beta: float = 0.5):
    """
    Same as generator but using flowrate
    """
    fr_range = fr_max - fr_min
    if fr_range <= 0: fr_range = 1
    t_range = t_max - t_min
    
    return t_prev + beta * (alpha * t_range * (fr_curr / fr_range) + t_surr - t_prev)

def solar_panel_power(p_max: float, i_curr: float, i_max: float):
    """
    Pcurr = Pmax * (Icurr/Imax)
    """
    if i_max <= 0: return 0.0
    return min(p_max, p_max * (i_curr / i_max))

def tank_volume(v_prev: float, total_fr_pump: float, dt_hours: float):
    """
    Vcurr(n) = Vcurr(n-1) - (total_fr_pump * dt_hours)
    """
    return max(0.0, v_prev - (total_fr_pump * dt_hours))

def ac_current_requirement(i_max: float, fr_curr: float, fr_max: float, t_out: float, t_surr: float,
                           t_max: float, t_min: float, alpha: float = 0.4):
    """
    Irequired = Imax * [ alpha * (FRcurr/FRmax) + (1-alpha) * clamp( |Tout - Tsurr| / (Tmax - Tmin), 0, 1 ) ]
    """
    fr_ratio = (fr_curr / fr_max) if fr_max > 0 else 0
    t_range = t_max - t_min
    if t_range <= 0: t_range = 1
    
    temp_ratio = clamp(abs(t_out - t_surr) / t_range, 0.0, 1.0)
    return i_max * (alpha * fr_ratio + (1.0 - alpha) * temp_ratio)

def ac_output_temperature(t_out_prev: float, t_target: float, beta: float = 0.5):
    """
    Tout(n) = Tout(n-1) + beta * (Ttarget - Tout(n-1))
    """
    return t_out_prev + beta * (t_target - t_out_prev)

def container_temperature(t_prev: float, t_surr: float, inner_temps: list[float], 
                          ac_vents: list[Dict[str, float]], beta: float = 0.5, 
                          alpha_inner: float = 0.225, alpha_surr: float = 0.8):
    """
    Tcurr(n) = Tcurr(n-1) + beta * [ alpha_inner*Iavg + Vall + alpha_surr*Tsurr - Tcurr(n-1) ]
    """
    i_avg = sum(inner_temps) / len(inner_temps) if inner_temps else 0.0
    
    v_all = 0.0
    a_mtotal = sum(v["a_max"] for v in ac_vents)
    if a_mtotal > 0:
        v_all = sum(v["t_out"] * v["a_curr"] for v in ac_vents) / a_mtotal
        
    return t_prev + beta * (alpha_inner * i_avg + v_all + alpha_surr * t_surr - t_prev)

def server_temperature(t_prev: float, t_surr: float, p_req: float, p_max: float, p_min: float,
                       t_max: float, t_min: float, alpha: float = 0.225, beta: float = 0.5):
    """
    Same as generator temperature but uses P_req / P
    """
    p_range = p_max - p_min
    if p_range <= 0: p_range = 1
    t_range = t_max - t_min
    
    return t_prev + beta * (alpha * t_range * (p_req / p_range) + t_surr - t_prev)

def alarm_current(status: str) -> float:
    """
    inactive -> 0 A
    active -> 5 A
    """
    return 5.0 if status == "active" else 0.0

def vent_current(a_curr: float, a_max: float, i_max: float) -> float:
    """
    Current is directly proportional to airflow up to maximum rated current.
    """
    if a_max <= 0: return 0.0
    return min(i_max, i_max * (a_curr / a_max))

def antenna_current(active_connections: int, i_max: float) -> float:
    """
    0 active connections -> 0 A
    1–19 active connections -> Imax / 2
    20+ active connections -> Imax
    """
    if active_connections == 0: return 0.0
    if active_connections < 20: return i_max / 2.0
    return i_max

def station_surrounding_temperature(t_external: float) -> float:
    """
    Tsurr = Texternal + 20
    """
    return t_external + 20.0

