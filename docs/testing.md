# Testing Guide

PolarTwin implements a strict testing philosophy ensuring domain isolation. 

## Frontend Testing (Vitest & React Testing Library)

The frontend uses Vitest for blazing-fast execution and React Testing Library for behavioral DOM assertions.

**Execution:**
```bash
cd frontend
npm run test
```

**Philosophy:**
- Heavily utilizes Mock Provider injections (`StationContext`) to simulate application state.
- Avoids deeply integrated E2E Selenium/Playwright tests for core logic, preferring isolated component integration tests.
- Uses `setupTests.ts` to mock missing JSDOM APIs (like `ResizeObserver` and `Three.js` WebGL contexts).

## Backend Testing (Pytest)

The Python backend enforces strict unit boundaries.

**Execution:**
```bash
export PYTHONPATH=src
pytest tests/
```

**Key Test Suites:**
- `test_compiler.py`: Verifies DSL topological checks and AST generation.
- `test_engine_core.py`: Validates cascading physics formulas, math boundaries, and power logic.
- `test_event_stack.py`: Enforces LIFO rollback invariants for scenario application.
