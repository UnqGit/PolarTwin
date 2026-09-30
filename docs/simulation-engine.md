# Simulation Engine

The simulation engine is the heart of PolarTwin. It is a deterministic, time-stepped physics and state machine based strictly on hours (converted internally from real-world seconds).

## Execution Loop

Every simulation tick (Delta $t$) processes the following pipeline in exact sequence:

1. **Time Advancement**: Increment internal simulation clock.
2. **Event Injection**: Poll the `EventStack`. Any scenario events scheduled for this exact time bounds are applied to component base states (e.g., failing a generator).
3. **Capacity Allocation**:
   - Evaluate network graphs (Power lines, Water pipes, Data links).
   - Trace from source generators to sink consumers.
4. **Physics Propagation**:
   - Re-evaluate dependent propagation (Power flow, Liquid flow, Heat transfer).
   - Example: Calculate `DeltaT` inside containers based on HVAC power allocation.
5. **Constraint Validation**:
   - Check if any component exceeds its defined specifications (e.g., thermal thresholds, voltage drops).
   - If limits are exceeded, mark the component's internal state as `failure` or `degraded`.
6. **Telemetry Egress**:
   - Serialize the entire state dictionary.
   - Push payload to the Telemetry pipeline (Outbox / Database).

## Determinism
The engine strictly relies on independent internal state management; it does **NOT** consult the persistent DB or UI for state interpolation. Given the same initial conditions and the same random seed, the output graph for any $t$ will be identical.
