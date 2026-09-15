import pytest
from twin_sim.behaviors import BehaviorContext
from twin_sim.model import Component, ComponentGraph, Connection
from twin_sim.simulation.engine import SimulationEngine
from twin_sim.simulation.environment import EnvironmentState
from twin_sim.behaviors.physical import BuildingPhysicalBehavior, ThermostatPhysicalBehavior, HeaterPhysicalBehavior, GeneratorPhysicalBehavior


def build_weather_graph():
    b_build = BuildingPhysicalBehavior()
    c_build = Component(name="Building", type="building", specification={}, behavior=b_build)
    
    b_therm = ThermostatPhysicalBehavior()
    c_therm = Component(name="Thermostat", type="thermostat", specification={"target_temperature": 21.0, "gain": 0.5}, behavior=b_therm)
    
    b_heat = HeaterPhysicalBehavior()
    c_heat = Component(name="Heater", type="heater", specification={"thermal_output": {"max": 5000.0}}, behavior=b_heat)
    
    b_gen = GeneratorPhysicalBehavior()
    c_gen = Component(name="Generator", type="generator", specification={"fuel_capacity": 100.0, "rating": 10.0, "fuel_rate": 0.25}, behavior=b_gen)
    
    connections = [
        Connection("Building", "Thermostat", "indoor_temperature", "-->"),
        Connection("Thermostat", "Generator", "heating_demand_multiplier", "-->"),
        Connection("Thermostat", "Heater", "command", "-->"),
        Connection("Heater", "Building", "thermal_output", "-->")
    ]
    components = {c.name: c for c in [c_build, c_therm, c_heat, c_gen]}
    graph = ComponentGraph(root=c_build, components=components, connections=connections)
    
    return graph, c_build, c_therm, c_heat, c_gen


def test_weather_end_to_end_cold():
    graph, c_build, c_therm, c_heat, c_gen = build_weather_graph()
    env = EnvironmentState({"outdoor_temperature": -10.0})
    engine = SimulationEngine(graph, environment=env, tick_interval=1.0)
    
    # Run for 1 hour
    engine.run(duration=3600.0)
    
    indoor = c_build.runtime_state.values.get("indoor_temperature", 20.0)
    demand = c_therm.runtime_state.values.get("heating_demand_multiplier", 1.0)
    fuel_cold = c_gen.runtime_state.values.get("fuel_level", 100.0)
    
    assert indoor < 21.0  # Fell below target due to cold
    assert demand > 1.0   # Heating demand increased
    assert fuel_cold < 100.0


def test_weather_end_to_end_warm():
    graph, c_build, c_therm, c_heat, c_gen = build_weather_graph()
    env = EnvironmentState({"outdoor_temperature": 20.0})
    engine = SimulationEngine(graph, environment=env, tick_interval=1.0)
    
    engine.run(duration=3600.0)
    
    indoor = c_build.runtime_state.values.get("indoor_temperature", 20.0)
    demand = c_therm.runtime_state.values.get("heating_demand_multiplier", 1.0)
    fuel_warm = c_gen.runtime_state.values.get("fuel_level", 100.0)
    
    assert indoor >= 20.0
    assert demand == pytest.approx(1.0, abs=0.01)  # Almost no extra heating demand
    
def test_weather_comparison():
    graph_cold, _, _, _, gen_c = build_weather_graph()
    engine_c = SimulationEngine(graph_cold, environment=EnvironmentState({"outdoor_temperature": -10.0}), tick_interval=1.0)
    engine_c.run(duration=3600.0)
    
    graph_warm, _, _, _, gen_w = build_weather_graph()
    engine_w = SimulationEngine(graph_warm, environment=EnvironmentState({"outdoor_temperature": 20.0}), tick_interval=1.0)
    engine_w.run(duration=3600.0)
    
    fuel_cold = gen_c.runtime_state.values["fuel_level"]
    fuel_warm = gen_w.runtime_state.values["fuel_level"]
    
    # Cold weather should consume MORE fuel (lower fuel level)
    assert fuel_cold < fuel_warm
