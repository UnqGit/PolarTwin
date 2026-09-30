# Deployment Guide

PolarTwin is fully Dockerized for robust deployment across standard orchestration platforms (e.g., Docker Swarm, Kubernetes).

## Services Topology

1. **`postgres:15`**: Relational database for persistent Telemetry and run history.
2. **`redis:7`** *(Optional)*: Message broker for multi-node worker coordination and WebSockets caching.
3. **`api`**: Uvicorn / FastAPI Backend application serving REST endpoints and the Simulation Engine.
4. **`web`**: Nginx serving the static React production bundle.

## Execution

### Local Development
Development environments can be spun up seamlessly:
```bash
docker-compose up --build
```
This mounts local volumes to allow live-reloading of Python code and React assets.

### Production
Production deployments must ensure:
- `pgdata` is mounted as a persistent block volume to retain simulation history across container restarts.
- `NODE_ENV=production` is set during the frontend build step to optimize the Three.js bundle size.
- Operational logs (e.g., stderr parsing exceptions) are shipped to a logging aggregator (ELK/Datadog), distinct from user-facing simulation warnings.
