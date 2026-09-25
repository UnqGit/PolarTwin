from typing import Any, Dict, List, Optional
from twin_sim.dsl.models import SceneEvent
from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.dsl.semantics import evaluate_node
import twin_sim.simulation.behaviors as behaviors
import time

def extract_val(data: Any, key: str, default: float) -> float:
    if isinstance(data, dict):
        return float(data.get(key, default))
    return float(data)

class SimulationEngineCore:
    def __init__(self, state_manager: TimelineStateManager, scenes: List[SceneEvent]):
        self.state = state_manager
        self.scenes = sorted(scenes, key=lambda s: (s.at, s.event_ref)) # In case of ties, maintain stable order
        self.time = 0.0 # simulation hours
        
        self.global_tolerance = 10.0 # Assume 10% global tolerance by default
        self.telemetry = []

    def run_tick(self):
        """Executes one complete simulation tick (15 simulation seconds)"""
        # 1. Advance time
        dt = 15.0 / 3600.0
        self.time += dt
        
        # 2 & 3. Instantiate events
        active_state = self.state.get_effective_state_dict()
        
        while self.scenes and self.scenes[0].at <= self.time:
            scene = self.scenes.pop(0)
            targets = []
            if scene.selector:
                if scene.selector.startswith("@component"):
                    pass 
                elif scene.selector == "@external.network":
                    targets.append(self.state.base_external.network)
                elif scene.selector.startswith("@"):
                    for c in active_state["components"]:
                        if c.name == scene.selector[1:]:
                            targets.append(c)
                            
            for t in targets:
                if scene.duration == float('inf'):
                    for k, v in scene.payload.items():
                        field_path = k if k == "status" else f"value.{k}"
                        self.state.apply_infinite_event(t, field_path, v)
                else:
                    for k, v in scene.payload.items():
                        field_path = k if k == "status" else f"value.{k}"
                        self.state.add_finite_event(scene.event_ref, 0, scene.at, scene.at + scene.duration, t, field_path, v)

        # 4. Expire finite event layers
        self.state.expire_events(self.time)
        
        # Physics operates on BASE state
        base_components = self.state.base_components
        external = self.state.base_external
        base_conns = self.state.base_connections.values()
        
        # 12. Backup Auto-Activation
        # Group by type
        eff_state = self.state.get_effective_state_dict()
        by_type = {}
        for c in eff_state["components"]:
            by_type.setdefault(c.type, []).append(c)
            
        for c_type, comps in by_type.items():
            primaries = [c for c in comps if not c.is_backup]
            backups = [c for c in comps if c.is_backup]
            
            if backups and primaries:
                # If all primaries are inactive/failure in effective reality, activate backups
                all_down = all(c.status in ("inactive", "failure") for c in primaries)
                if all_down:
                    for b in backups:
                        base_components[b.name].status = "active"
                else:
                    for b in backups:
                        base_components[b.name].status = "inactive"
                        
        # 8. Resolve Resource Allocation
        # (Very simplified aggregation for Phase 15 implementation)
        # In reality, this requires topological graph sorting. We will emulate the math here:
        
        for c in base_components.values():
            # Ensure failure tracking exists
            if "failure_time" not in c.value:
                c.value["failure_time"] = 0.0
                
            if c.type == "generator":
                t_obj = c.value.get("temperature", {})
                p_obj = c.value.get("power", {})
                
                t_prev = extract_val(t_obj, "value", 20.0)
                t_surr = external.weather.temperature
                
                # Assume full demand for simplicity in tests if not connected
                p_curr = extract_val(p_obj, "value", 0.0)
                p_max = extract_val(p_obj, "max", 1000.0)
                p_min = extract_val(p_obj, "min", 0.0)
                t_max = extract_val(t_obj, "max", 120.0)
                t_min = extract_val(t_obj, "min", -20.0)
                
                new_t = behaviors.generator_temperature(t_prev, t_surr, p_curr, p_max, p_min, t_max, t_min)
                if isinstance(t_obj, dict): t_obj["value"] = new_t
                else: c.value["temperature"] = new_t
                
            elif c.type == "tank":
                v_obj = c.value.get("volume", {})
                v_prev = extract_val(v_obj, "value", 100.0)
                
                new_v = behaviors.tank_volume(v_prev, 10.0, dt)
                if isinstance(v_obj, dict): v_obj["value"] = new_v
                else: c.value["volume"] = new_v
                
            elif c.type == "solar_panel":
                p_obj = c.value.get("power", {})
                p_max = extract_val(p_obj, "max", 100.0)
                new_p = behaviors.solar_panel_power(p_max, 50.0, 100.0)
                if isinstance(p_obj, dict): p_obj["value"] = new_p
                else: c.value["power"] = new_p
                
            elif c.type == "server":
                t_obj = c.value.get("temperature", {})
                p_obj = c.value.get("power", {})
                
                t_prev = extract_val(t_obj, "value", 20.0)
                t_surr = external.weather.temperature
                p_req = extract_val(p_obj, "value", 0.0)
                p_max = extract_val(p_obj, "max", 100.0)
                p_min = extract_val(p_obj, "min", 0.0)
                t_max = extract_val(t_obj, "max", 80.0)
                t_min = extract_val(t_obj, "min", 0.0)
                
                new_t = behaviors.server_temperature(t_prev, t_surr, p_req, p_max, p_min, t_max, t_min)
                if isinstance(t_obj, dict): t_obj["value"] = new_t
                else: c.value["temperature"] = new_t

            elif c.type == "alarm":
                p_obj = c.value.get("power", {})
                new_p = behaviors.alarm_current(c.status) * 220.0 # Assuming 220V for power (P = VI)
                if isinstance(p_obj, dict): p_obj["value"] = new_p
                else: c.value["power"] = new_p
                
            elif c.type == "antenna":
                p_obj = c.value.get("power", {})
                # For simplified phase 15 logic, assume 5 active connections dynamically
                new_i = behaviors.antenna_current(5, extract_val(p_obj, "max", 10.0))
                new_p = new_i * 220.0 # P = VI
                if isinstance(p_obj, dict): p_obj["value"] = new_p
                else: c.value["power"] = new_p
                
            elif c.type == "vent":
                a_obj = c.value.get("airflow", {})
                p_obj = c.value.get("power", {})
                
                a_curr = extract_val(a_obj, "value", 10.0)
                a_max = extract_val(a_obj, "max", 100.0)
                i_max = extract_val(p_obj, "max", 10.0) / 220.0 # Approximate I_max from P_max
                
                new_i = behaviors.vent_current(a_curr, a_max, i_max)
                new_p = new_i * 220.0
                if isinstance(p_obj, dict): p_obj["value"] = new_p
                else: c.value["power"] = new_p
                
            elif c.type == "air_conditioner":
                t_obj = c.value.get("temperature", {}) # Output temp
                p_obj = c.value.get("power", {})
                
                t_out_prev = extract_val(t_obj, "value", 20.0)
                t_target = extract_val(c.value.get("target_temperature", {}), "value", 20.0)
                t_surr = external.weather.temperature
                
                # Update output temp
                new_t_out = behaviors.ac_output_temperature(t_out_prev, t_target)
                if isinstance(t_obj, dict): t_obj["value"] = new_t_out
                else: c.value["temperature"] = new_t_out
                
                # Update power usage
                fr_curr = 50.0 # mock airflow sum
                fr_max = 100.0
                t_max = extract_val(t_obj, "max", 40.0)
                t_min = extract_val(t_obj, "min", 0.0)
                i_max = extract_val(p_obj, "max", 5000.0) / 220.0
                new_i = behaviors.ac_current_requirement(i_max, fr_curr, fr_max, new_t_out, t_surr, t_max, t_min)
                new_p = new_i * 220.0
                if isinstance(p_obj, dict): p_obj["value"] = new_p
                else: c.value["power"] = new_p
                
            elif c.type in ("container", "station"):
                t_obj = c.value.get("temperature", {})
                t_prev = extract_val(t_obj, "value", 20.0)
                
                if c.type == "station":
                    t_surr = behaviors.station_surrounding_temperature(external.weather.temperature)
                else:
                    t_surr = external.weather.temperature
                    
                new_t = behaviors.container_temperature(t_prev, t_surr, inner_temps=[], ac_vents=[])
                if isinstance(t_obj, dict): t_obj["value"] = new_t
                else: c.value["temperature"] = new_t

        # 11. Evaluate rating/tolerance failure countdowns
        for c in base_components.values():
            if c.status == "failure":
                continue # Already failed
                
            t_obj = c.value.get("temperature", {})
            val = extract_val(t_obj, "value", 0.0)
            max_rating = extract_val(t_obj, "max", 100.0)
            
            if val > max_rating:
                max_tolerated = behaviors.get_max_tolerated_value(max_rating, 5.0, self.global_tolerance)
                toff = behaviors.calculate_failure_countdown(val, max_rating, max_tolerated)
                if toff <= 0.0 or c.value["failure_time"] >= toff:
                    c.status = "failure"
                else:
                    c.value["failure_time"] += dt
            else:
                c.value["failure_time"] = 0.0 # reset if back in bounds

        # Re-apply masks over the new physics base state
        self.state.recalculate_effective_state()
        
        # 17-18. Telemetry
        self.telemetry.append({
            "time": self.time,
            "persistence_time": time.time(),
            "components": list(base_components.values()),
            "connections": list(self.state.base_connections.values()),
            "external": external
        })
        
    def run_duration(self, hours: float):
        ticks = round(hours * 3600.0 / 15.0)
        for _ in range(ticks):
            self.run_tick()
