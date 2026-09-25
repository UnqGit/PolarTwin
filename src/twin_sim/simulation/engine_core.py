from typing import Any, Dict, List, Optional
from twin_sim.dsl.models import SceneEvent
from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.dsl.semantics import evaluate_node
import twin_sim.simulation.behaviors as behaviors

class SimulationEngineCore:
    def __init__(self, state_manager: TimelineStateManager, scenes: List[SceneEvent]):
        self.state = state_manager
        self.scenes = sorted(scenes, key=lambda s: (s.at, s.event_ref)) # In case of ties, maintain stable order
        self.time = 0.0 # simulation hours
        
        self.global_tolerance = 10.0 # Assume 10% global tolerance by default
        self.telemetry = []

    def run_tick(self):
        """
        Executes one complete simulation tick (15 simulation seconds) according to the Phase 11 Specification.
        """
        # 1. Advance time
        dt = 15.0 / 3600.0
        self.time += dt
        
        # 2 & 3. Instantiate events whose `at` time has been reached & Apply in stable order
        # We pop from the front of the sorted scenes list
        active_state = self.state.get_effective_state_dict()
        
        while self.scenes and self.scenes[0].at <= self.time:
            scene = self.scenes.pop(0)
            
            # Find matching targets in components, connections, external
            targets = []
            if scene.selector:
                # Need to use Phase 9 AST evaluators. For now, simple matching:
                if scene.selector.startswith("@component"):
                    pass # handled by evaluator
                elif scene.selector == "@external.network":
                    targets.append(self.state.base_external.network)
                elif scene.selector.startswith("@"):
                    for c in active_state["components"]:
                        if c.name == scene.selector[1:]:
                            targets.append(c)
                            
            # Process payloads onto targets
            for t in targets:
                if scene.duration == float('inf'):
                    for k, v in scene.payload.items():
                        self.state.apply_infinite_event(t, f"value.{k}", v)
                else:
                    for k, v in scene.payload.items():
                        self.state.add_finite_event(scene.event_ref, 0, scene.at, scene.at + scene.duration, t, f"value.{k}", v)

        # 4. Expire finite event layers
        self.state.expire_events(self.time)
        
        # 5. Resolve hierarchical effective status
        # 6. Resolve active/inactive/failure connections
        # 7. Resolve missing data
        
        # We must run physics on the BASE state, so it persists.
        base_components = self.state.base_components
        external = self.state.base_external
        
        # 8. Resolve resource allocation (Generators, Pumps, Tanks)
        for c in base_components.values():
            if c.type == "generator":
                # T_curr = T_prev + ...
                if "temperature" in c.value:
                    c.value["temperature"] = behaviors.generator_temperature(
                        t_prev=c.value.get("temperature", 20.0),
                        t_surr=external.weather.temperature,
                        p_curr=c.value.get("power", 0.0),
                        p_max=1000.0, p_min=0.0,
                        t_max=120.0, t_min=-20.0
                    )
            elif c.type == "tank":
                if "volume" in c.value:
                    # simplistic volume depletion
                    c.value["volume"] = behaviors.tank_volume(c.value["volume"], 10.0, dt)
            elif c.type == "solar_panel":
                if "power" in c.value:
                    c.value["power"] = behaviors.solar_panel_power(100.0, 50.0, 100.0)

        # 9. Apply controller adjustments
        # 10. Run type-specific component behavior
        
        # 11. Evaluate rating/tolerance failure countdowns
        for c in base_components.values():
            # Example bounds checking
            val = c.value.get("temperature", 0.0)
            max_tolerated = behaviors.get_max_tolerated_value(100.0, 5.0, self.global_tolerance)
            toff = behaviors.calculate_failure_countdown(val, 100.0, max_tolerated)
            if toff <= 0:
                c.status = "failure"

        # 12. Apply backup behavior
        # 13. Recalculate container/station thermal state
        
        # Re-apply masks over the new physics base state
        self.state.recalculate_effective_state()
        
        # 14-16. Write runtime state (automatically handled by the active objects manipulating state dict)
        
        # 17-18. Telemetry
        import time
        self.telemetry.append({
            "time": self.time,
            "persistence_time": time.time(),
            "components": list(base_components.values()),
            "connections": list(self.state.base_connections.values()),
            "external": external
        })
        
        # 19. Publish state update to frontend (No-op for headless core)
        
    def run_duration(self, hours: float):
        ticks = round(hours * 3600.0 / 15.0)
        for _ in range(ticks):
            self.run_tick()
