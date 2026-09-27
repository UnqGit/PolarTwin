# Telemetry and Persistence

## Telemetry Flow
As the simulation ticks forward, the complete state payload (Components, Connections, and External Weather variables) is captured into a telemetry slice. This slice is sent asynchronously to the persistence layer. 

## Persistence Layer
The default persistence layer is relational (PostgreSQL recommended in Production, SQLite fallback for local development). 
Data is queryable by `run_id`, filtering across time boundaries `start_time` to `end_time`.

The History and Diagnostics pages utilize this telemetry layer strictly in a Read-Only capacity to scrub backwards and forwards in time.
