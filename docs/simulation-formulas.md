# Simulation Formulas

This document records the core mathematical formulas utilized within the Simulation Engine.

## Interpretation
- `component.json` = current runtime state (local physics calculations)
- `simulation connection.json` = current runtime connection state (graph capacities)
- `external.json` = current runtime external conditions (weather)
- `telemetry database` = persisted history of all the above.

## Power Allocation
`AvailablePower = sum(Output(Generators))`
`Demand = sum(InputRequirements(Consumers))`
If `AvailablePower < Demand`: Proportional power allocation occurs if `AvailablePower >= 35% Demand`. If it falls below 35%, cascading total failure initiates based on hierarchy priorities.

## Thermal Regulation (Container AC)
`HeatGen = sum(Heat(Equipment))`
`DeltaT = (HeatGen - CoolingCapacity(AC) - VentLoss) * K`
If interior temp > 40C, AC target offsets by 2C increments if Vents are maximized.
