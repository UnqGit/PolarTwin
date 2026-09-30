# PolarTwin Documentation

Welcome to the **PolarTwin** documentation! PolarTwin is an advanced digital twin simulation platform specifically tailored for monitoring, simulating, and analyzing infrastructure in the harshest environments on Earth (e.g., Antarctic research stations).

## Table of Contents

- [Architecture Overview](architecture.md)
- [Frontend Application](frontend.md)
- [Backend API Reference](api.md)
- [Simulation Engine](simulation-engine.md)
- [Telemetry & Persistence](telemetry.md)
- [Twin DSL (Static Modeling)](twin-dsl.md)
- [Scenario DSL (Dynamic Events)](scenario-dsl.md)
- [Simulation Formulas](simulation-formulas.md)
- [Testing Guide](testing.md)
- [Deployment Guide](deployment.md)

---
> [!NOTE]
> PolarTwin consists of a strong separation between the static **Model** of the station and the active **Runtime** state. The frontend acts as a pure visualizer (using React and Three.js), while the backend (FastAPI) handles all heavy simulation mathematics.
