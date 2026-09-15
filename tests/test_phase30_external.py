import pytest
import datetime
from twin_sim.ingestion.validator import validate_external, ValidationError
from twin_sim.simulation.external import ExternalDataEvolver
from twin_sim.simulation.engine import SimulationEngine, ComponentGraph
from twin_sim.model.component import Component
from twin_sim.behaviors.physical import TankPhysicalBehavior

def test_validate_external_valid():
    doc = {
        "weather": {
            "outdoor_temperature": [
                {"time": 0, "value": 10},
                {"time": 3600, "value": 15}
            ],
            "humidity": 50
        },
        "network": {
            "connectivity": [
                {"time": 0, "value": 1.0},
                {"time": 7200, "value": 0.0}
            ]
        },
        "supplies": [
            {
                "eta": "2026-09-20T10:00:00Z",
                "description": "Fuel",
                "transportation_mode": "ship",
                "quantity": 500
            }
        ]
    }
    valid = validate_external(doc)
    assert "weather" in valid
    assert "supplies" in valid

def test_validate_external_invalid():
    with pytest.raises(ValidationError):
        validate_external({
            "weather": {
                "outdoor_temperature": "hot"
            }
        })
        
    with pytest.raises(ValidationError):
        validate_external({
            "supplies": [
                {"eta": "invalid-time", "description": "a", "transportation_mode": "b"}
            ]
        })

def test_external_data_evolver_determinism():
    config = {
        "weather": {
            "temp": [
                {"time": 0, "value": 10},
                {"time": 10, "value": 20}
            ]
        },
        "network": {
            "conn": [
                {"time": 0, "value": 1.0},
                {"time": 5, "value": 0.0}
            ]
        }
    }
    
    evolver1 = ExternalDataEvolver(config)
    evolver2 = ExternalDataEvolver(config)
    
    state1, _ = evolver1.evolve(5)
    state2, _ = evolver2.evolve(5)
    
    assert state1 == state2
    assert state1["weather"]["temp"] == 15.0 # Interpolated
    assert state1["network"]["conn"] == 0.0 # Step function

def test_supply_arrived_event():
    config = {
        "supplies": [
            {
                "eta": "1970-01-01T00:00:10Z", # Timestamp 10.0
                "description": "Fuel",
                "transportation_mode": "truck",
                "quantity": 100
            }
        ]
    }
    evolver = ExternalDataEvolver(config)
    
    state, events = evolver.evolve(5.0)
    assert not events
    assert state["supplies"][0]["quantity"] == 100
    assert state["next_supply"]["quantity"] == 100
    
    state, events = evolver.evolve(10.0)
    assert len(events) == 1
    assert events[0]["type"] == "SupplyArrived"
    assert events[0]["supply"]["quantity"] == 100
    assert not state["supplies"] # Emptied
    assert "next_supply" not in state

def test_tank_receives_supply_event():
    tank = Component(name="tank", type="storage", specification={"capacity": 500}, tags=[])
    tank.behavior = TankPhysicalBehavior()
    
    graph = ComponentGraph(tank, {"tank": tank}, [])
    graph.external_data_config = {
        "supplies": [
            {
                "eta": "1970-01-01T00:00:02Z", # Timestamp 2.0
                "description": "Fuel",
                "transportation_mode": "truck",
                "quantity": 100
            }
        ]
    }
    
    engine = SimulationEngine(graph, tick_interval=1.0)
    
    # Tick 0
    engine.step()
    assert tank.runtime_state.values["level"] == 500 # Default is full
    
    # Make room
    tank.runtime_state.values["level"] = 100
    
    # Tick 1 (Timestamp 1.0) - Supply arrives
    engine.step()
    assert tank.runtime_state.values["level"] == 200 # Received 100
