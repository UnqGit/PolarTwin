import datetime
from twin_sim.ingestion.validator import validate_external, ValidationError
from twin_sim.simulation.external import ExternalDataEvolver
from twin_sim.simulation.engine import SimulationEngine, ComponentGraph
from twin_sim.model.component import Component
from twin_sim.behaviors.physical import TankPhysicalBehavior

tank = Component(name="tank", type="storage", specification={"capacity": 500}, tags=[])
tank.behavior = TankPhysicalBehavior()

graph = ComponentGraph(tank, {"tank": tank}, [])
graph.external_data_config = {
    "supplies": [
        {
            "eta": "1970-01-01T00:00:01Z", # Timestamp 1.0
            "description": "Fuel",
            "transportation_mode": "truck",
            "quantity": 100
        }
    ]
}

engine = SimulationEngine(graph, tick_interval=1.0)

# Tick 0
engine.step()
print("Tick 0 level:", tank.runtime_state.values["level"])

tank.runtime_state.values["level"] = 100

engine.step()
print("Tick 1 level:", tank.runtime_state.values["level"])
print("Events triggered:", engine.last_phase_order)
