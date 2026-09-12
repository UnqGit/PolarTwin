import React, { useState, useEffect } from 'react';
import { TwinViewer } from './components/TwinViewer';
import relation from './data/relation.json';
import spec from './data/spec.json';

function App() {
  const [liveState, setLiveState] = useState<Record<string, unknown>>({});

  // Simulate live state updates from the API.
  // In production this would poll /runs/{id}/state from the Phase 29 API.
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveState({
        MiniStation: { running: true },
        EnergySystem: { running: true },
        Generator: { running: true, power_kw: (Math.random() * 2 + 8).toFixed(2), fuel_pct: (Math.random() * 30 + 60).toFixed(1) },
        FuelSensor: { fuel_level: (Math.random() * 30 + 60).toFixed(1), unit: '%' },
        Controller: { running: true, mode: 'auto' },
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        color: '#f1f5f9', fontFamily: 'system-ui, sans-serif',
        background: 'rgba(15,23,42,0.75)',
        backdropFilter: 'blur(8px)',
        borderRadius: 10,
        padding: '14px 18px',
        border: '1px solid rgba(148,163,184,0.15)',
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#93c5fd' }}>PolarTwin 3D Viewer</h2>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
          Hover over any component to inspect live telemetry.
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
          Drag to rotate · Scroll to zoom · Right-drag to pan
        </p>
      </div>

      <TwinViewer topology={relation} specification={spec} liveState={liveState} />
    </div>
  );
}

export default App;
