import { useState, useEffect, useRef } from 'react';
import { TwinViewer, type LightingMode } from './components/TwinViewer';

const relationFiles = import.meta.glob('./data/twins/*/relation.json', { eager: true, import: 'default' });
const specFiles = import.meta.glob('./data/twins/*/spec.json', { eager: true, import: 'default' });

// Extract twin names from paths
const availableTwins = Object.keys(relationFiles).map((path) => {
  const match = path.match(/\.\/data\/twins\/(.+)\/relation\.json/);
  return match ? match[1] : '';
}).filter(Boolean);

function App() {
  const [selectedTwin, setSelectedTwin] = useState<string>(availableTwins[0] || '');
  const [lightingMode, setLightingMode] = useState<LightingMode>('dynamic');
  // liveStateRef will hold the latest telemetry without triggering React re-renders
  const liveStateRef = useRef<Record<string, unknown>>({});

  // Simulate live state updates from the API.
  useEffect(() => {
    const interval = setInterval(() => {
      // We mutate the ref instead of calling setState to avoid re-rendering the 3D scene
      liveStateRef.current = {
        MiniStation: { running: true },
        EnergySystem: { running: true },
        Generator: { running: true, power_kw: (Math.random() * 2 + 8).toFixed(2), fuel_pct: (Math.random() * 30 + 60).toFixed(1) },
        FuelSensor: { fuel_level: (Math.random() * 30 + 60).toFixed(1), unit: '%' },
        Controller: { running: true, mode: 'auto' },
        // new_station stuff
        MainGenerator: { running: true, power: (Math.random() * 50 + 450).toFixed(1) },
        PowerSensor: { running: true, accuracy: 0.99 },
        BackupBattery: { capacity: 1000 },
      };
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const relation = selectedTwin ? relationFiles[`./data/twins/${selectedTwin}/relation.json`] : null;
  const spec = selectedTwin ? specFiles[`./data/twins/${selectedTwin}/spec.json`] : null;

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
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#93c5fd' }}>PolarTwin 3D Viewer</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <label htmlFor="twin-select" style={{ fontSize: 13, color: '#cbd5e1' }}>Select Twin:</label>
          <select 
            id="twin-select"
            value={selectedTwin} 
            onChange={(e) => setSelectedTwin(e.target.value)}
            style={{ 
              background: 'rgba(30,41,59,0.8)', 
              color: 'white', 
              border: '1px solid #475569', 
              borderRadius: '4px',
              padding: '4px 8px',
              outline: 'none'
            }}
          >
            {availableTwins.map(twin => (
              <option key={twin} value={twin}>{twin}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="lighting-mode" style={{ fontSize: 13, color: '#cbd5e1' }}>Lighting:</label>
          <select 
            id="lighting-mode"
            value={lightingMode} 
            onChange={(e) => setLightingMode(e.target.value as LightingMode)}
            style={{ 
              background: 'rgba(30,41,59,0.8)', 
              color: 'white', 
              border: '1px solid #475569', 
              borderRadius: '4px',
              padding: '4px 8px',
              outline: 'none'
            }}
          >
            <option value="dynamic">Dynamic</option>
            <option value="static">Static (Baked)</option>
            <option value="off">Off</option>
          </select>
        </div>

        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
          Hover over any component to inspect live telemetry.
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
          Drag to rotate · Scroll to zoom · Right-drag to pan
        </p>
      </div>

      {relation && spec ? (
        <TwinViewer topology={relation} specification={spec} liveStateRef={liveStateRef} lightingMode={lightingMode} />
      ) : (
        <div style={{ color: 'white', padding: 24 }}>Loading or no twin selected...</div>
      )}
    </div>
  );
}

export default App;
