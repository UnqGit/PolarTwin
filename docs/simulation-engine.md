# Simulation Engine

The simulation engine is a deterministic, time-stepped state machine based strictly on hours (converted from physics seconds).

## Execution Loop
1. Advance simulation time by Delta `t`.
2. Apply active scenario overlays (`EventStack`) based on `t`.
3. Re-evaluate dependent propagation (Power flow, Liquid flow, Heat transfer).
4. Run validation and determine failure status of all components.
5. Push payload to Telemetry.

The engine strictly relies on independent internal state management; it does NOT consult the persistent DB or UI for state interpolation.
