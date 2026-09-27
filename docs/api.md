# API Reference

The PolarTwin API is a standard REST JSON server running on FastAPI.

## Key Endpoints
* `GET /station` - Loads station graph metadata.
* `POST /simulations` - Instantiates a new simulation.
* `POST /simulations/{run_id}/play` - Advances simulation ticks either indefinitely or by steps.
* `GET /simulations/{run_id}/state` - Fetches instantaneous telemetry view.
* `GET /simulations/{run_id}/history` - Queries paginated history ranges.
* `POST /scenarios/{id}/validate` - Performs static backend validation on submitted DSL.
