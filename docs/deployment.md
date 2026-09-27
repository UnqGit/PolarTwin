# Deployment Guide

PolarTwin is fully Dockerized for standard orchestration platforms (Docker Swarm, Kubernetes).

## Services Required
1. `postgres:15` (Telemetry database)
2. `redis:7` (Optional: Worker messaging coordination)
3. `api` (Uvicorn / FastAPI Backend)
4. `web` (Nginx + static React bundle)

## Execution
Development environments can be spun up using:
`docker-compose up --build`

Production deployments must mount a persistent volume (`pgdata`) to retain simulation history. Operational logs (e.g. stderr parsing exceptions) are streamed to stdout/stderr distinct from user-facing simulation warnings.
