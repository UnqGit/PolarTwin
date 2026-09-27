# Testing Guide

PolarTwin implements a strict testing philosophy ensuring domain isolation.

## Backend Tests (Pytest)
Execute with `pytest tests/` (Ensure `PYTHONPATH=src`).
- `test_compiler.py`: Verifies DSL topological checks.
- `test_engine_core.py`: Checks cascading physics formulas and power logic.
- `test_event_stack.py`: Enforces LIFO rollback invariants for scenarios.

## Frontend Tests (Jest / RTL)
Execute with `npm test`.
Heavily utilizes Mock Provider injections (`StationContext`) rather than deeply integrated E2E selenium bindings. Ensure component interactions strictly call `api.*` layer boundaries.
