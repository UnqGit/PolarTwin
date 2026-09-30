# Telemetry and Persistence

PolarTwin generates immense amounts of state data. The telemetry pipeline ensures this data is captured, queued, and persisted without blocking the primary simulation execution loop.

## Telemetry Flow

1. **Snapshot**: As the simulation ticks forward, the complete state payload (Components, Connections, External Weather, and Engine Status) is captured.
2. **Outbox Pattern**: The payload is serialized to a non-blocking in-memory Ring Buffer (or SQLite local queue).
3. **Async Flusher**: A background worker thread consumes the outbox and bulk-inserts records into the Persistence Layer.

## Persistence Layer

- **Production**: PostgreSQL 15+ (Handles heavy time-series read/write loads).
- **Development**: SQLite (Zero-config local fallback).

Data is strictly queryable by `run_id`, filtering across time boundaries (`start_time` to `end_time`). 

> [!NOTE]
> The **History** and **Diagnostics** frontend pages utilize this telemetry layer strictly in a Read-Only capacity to scrub backwards and forwards in time, rendering the exact historical state of the station.
