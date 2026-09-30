# Backend API Reference

The PolarTwin API is a standard REST JSON server running on Python `FastAPI`, utilizing `Uvicorn` for ASGI serving.

## Core Endpoints

### Station Metadata
- `GET /stations`  
  Returns a list of all available stations and deployment metadata.
- `GET /stations/{station_id}`  
  Returns the static topological graph, connections, and component specifications.

### Simulation Lifecycle
- `POST /simulations`  
  Instantiates a new simulation run, returning a unique `run_id`.
  **Payload**: `{ "station_id": "Maitri", "scenario_id": "scen-1" }`
- `POST /simulations/{run_id}/play`  
  Starts or unpauses a running simulation.
- `POST /simulations/{run_id}/pause`  
  Pauses the simulation execution loop.
- `POST /simulations/{run_id}/step`  
  Advances the simulation precisely by one time-step (tick).
- `POST /simulations/{run_id}/reset`  
  Rolls the simulation back to time $t=0$ and purges temporary telemetry.

### State & Telemetry
- `GET /simulations/{run_id}/state`  
  Fetches the instantaneous current state of the simulation (live view).
- `GET /simulations/{run_id}/history`  
  Queries paginated history ranges for diagnostic scrubbing.

### Scenario DSL Management
- `GET /scenarios/{station_id}`  
  Lists all available scenario files for a station.
- `GET /scenarios/{scenario_id}/source`  
  Fetches raw `.scene` / `.event` DSL string content.
- `PUT /scenarios/{scenario_id}/source`  
  Overwrites the scenario DSL file and hot-reloads it.
- `POST /scenarios/{scenario_id}/validate`  
  Performs static backend AST validation on submitted DSL. Returns regex/parse errors if invalid.

> [!TIP]
> Use the automatically generated `/docs` endpoint on the running FastAPI server to interactively explore and test these endpoints using OpenAPI/Swagger UI.
