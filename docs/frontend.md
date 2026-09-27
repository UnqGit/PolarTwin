# Frontend

The PolarTwin UI is a React/TypeScript application utilizing `@react-three/fiber` for 3D digital twin rendering.

## Architectural Boundaries
The Frontend holds no authoritative state logic. All runtime calculations occur on the Backend `SimulationEngine`. The frontend operates as a pure view-layer, polling or streaming data into the global context hooks (`StationContext.tsx`).

## Key Components
* `TwinViewer.tsx` / `TwinNodeRenderer.tsx`: Recursive traversal of the physical graph, heavily memoized to avoid GPU overhead.
* `ScenariosPage.tsx`: Integrated DSL editor utilizing an ACE-style line editor and regex-based syntax verification. 
* `SimulationMonitor.tsx`: Read-only views of telemetry streams.
