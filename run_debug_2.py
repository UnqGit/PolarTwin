import datetime
from twin_sim.simulation.external import ExternalDataEvolver

config = {
    "supplies": [
        {
            "eta": "1970-01-01T00:00:01Z", # Timestamp 1.0
            "description": "Fuel",
            "transportation_mode": "truck",
            "quantity": 100
        }
    ]
}
evolver = ExternalDataEvolver(config)

state, events = evolver.evolve(0.0)
print("Tick 0 events:", events)

state, events = evolver.evolve(1.0)
print("Tick 1 events:", events)
