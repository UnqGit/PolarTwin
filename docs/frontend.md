# Frontend Application

The PolarTwin UI is a robust React/TypeScript application utilizing `@react-three/fiber` for 3D digital twin rendering and `cytoscape.js` for complex 2D graph visualizations.

## Architectural Boundaries

> [!IMPORTANT]
> The Frontend holds **no authoritative state logic**. All runtime calculations occur on the Backend `SimulationEngine`. The frontend operates as a pure view-layer, polling or streaming data into global context hooks.

## Key Technologies
- **React & TypeScript**: Core UI and logic framework.
- **React Router (Splat Routes)**: Manages state persistence across pages. Navigating between `/:stationId/twin` and `/:stationId/connections` preserves component state via `display: none` toggling rather than unmounting heavy WebGL contexts.
- **Three.js / React-Three-Fiber**: Powers the immersive 3D digital twin visualization.
- **Cytoscape.js**: Drives the high-performance 2D node connection and logical topology graphs.
- **Vitest & React Testing Library**: Ensures reliable unit and component testing.

## Application Structure

The application is split into 6 primary views, all seamlessly cached in the DOM for rapid switching:

1. **Overview Page**: High-level station statistics and status summary.
2. **Digital Twin**: Live 3D spatial rendering of the station utilizing `TwinViewer.tsx`.
3. **Components Page**: Tabular and hierarchical list of all station assets.
4. **Connections Page**: 2D directed graph of logical and physical routing (Power, Data, Water, Heat) using Cytoscape.
5. **Scenario / Simulation Page**: Integrated DSL editor with an ACE-style line editor, visual timeline (`TimelineEditor.tsx`), and a dedicated 3D viewer for running hypothetical "what-if" situations.
6. **Diagnostics (History)**: Time-series scrubbing and event log analysis.

## Performance Considerations
- **Memoization**: Recursive traversal of the physical graph in `TwinNodeRenderer.tsx` is heavily memoized (`React.memo`) to avoid GPU overhead and unnecessary re-renders.
- **Resize Observers**: Component layouts (like Cytoscape graphs and Timeline canvases) dynamically respond to container resizing via `ResizeObserver` to maintain flawless layouts when un-hidden.
