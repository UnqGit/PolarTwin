# Architecture

The PolarTwin architecture consists of a strong separation between the static **Model** of the station and the active **Runtime** state.

## Core Pillars
1. **Model**: Defined by `.twin` files (`hierarchy.twin`, `connection.twin`, `spec.twin`). This parses into a `SceneLayout` containing static engineering properties.
2. **Runtime**: The actual state of the simulation as it runs tick-by-tick.
3. **Scenario**: The user's input (`.scene` and `.event` files) to override and simulate specific fault states.
4. **Telemetry**: A time-series recording of Runtime state for history queries and analytics.
5. **Frontend**: A React application visualizing 3D and 2D state overlays without holding state natively.

## Data Flow
The station's physical design is loaded via the Twin Parser on startup. A user initiates a Simulation which instantiates a `SimulationEngine`. The engine processes events via an `EventStack` (LIFO override semantics). Finally, every telemetry tick is dumped to a database (or in-memory cache) while being piped via WebSockets/polling to the 3D visualizer.
