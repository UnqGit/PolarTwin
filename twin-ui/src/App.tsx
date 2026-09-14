import { useState, useEffect, useRef } from 'react';
import { Snowflake } from 'lucide-react';
import { TwinViewer, type LightingMode } from './components/TwinViewer';

const relationFiles = import.meta.glob('./data/twins/*/relation.json', { eager: true, import: 'default' });
const specFiles = import.meta.glob('./data/twins/*/spec.json', { eager: true, import: 'default' });

// Extract twin names from paths
const availableTwins = Object.keys(relationFiles).map((path) => {
  const match = path.match(/\.\/data\/twins\/(.+)\/relation\.json/);
  return match ? match[1] : '';
}).filter(Boolean);

function App() {
  const [selectedTwin, setSelectedTwin] = useState<string>('new_station');
  const [lightingMode, setLightingMode] = useState<LightingMode>('off');
  const [containerOcclusion, setContainerOcclusion] = useState<'off' | 'off_on_hover'>('off');
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);

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
      {relation && spec ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <TwinViewer 
            topology={relation} 
            specification={spec} 
            liveStateRef={liveStateRef} 
            lightingMode={lightingMode}
            containerOcclusion={containerOcclusion}
            selectedName={selectedComponentName}
            onSelectName={setSelectedComponentName}
          >
          {/* Top-left title card */}
          <div style={{
            background: 'var(--bg-panel)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            backdropFilter: 'blur(10px)',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
          }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center' }}><Snowflake size={20} /></span> PolarTwin
              </h1>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>
              3D Digital Twin Viewer
            </div>
          </div>

          {/* HUD overlay */}
          <div style={{
            color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif',
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(8px)',
            borderRadius: 10,
            padding: '14px 18px',
            border: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', gap: '8px',
            width: 280,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
          }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <label htmlFor="twin-select" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Select Twin:</label>
              <select 
                id="twin-select"
                value={selectedTwin} 
                onChange={(e) => setSelectedTwin(e.target.value)}
                style={{ 
                  background: 'var(--bg-panel-secondary)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-solid)', 
                  borderRadius: '4px',
                  padding: '4px 8px',
                  outline: 'none',
                  flex: 1
                }}
              >
                {availableTwins.map(twin => (
                  <option key={twin} value={twin}>{twin}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="lighting-mode" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Lighting:</label>
              <select 
                id="lighting-mode"
                value={lightingMode} 
                onChange={(e) => setLightingMode(e.target.value as LightingMode)}
                style={{ 
                  background: 'var(--bg-panel-secondary)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-solid)', 
                  borderRadius: '4px',
                  padding: '4px 8px',
                  outline: 'none',
                  flex: 1
                }}
              >
                <option value="dynamic">Dynamic</option>
                <option value="static">Static (Baked)</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="occlusion-mode" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Occlusion:</label>
              <select 
                id="occlusion-mode"
                value={containerOcclusion} 
                onChange={(e) => setContainerOcclusion(e.target.value as 'off' | 'off_on_hover')}
                style={{ 
                  background: 'var(--bg-panel-secondary)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-solid)', 
                  borderRadius: '4px',
                  padding: '4px 8px',
                  outline: 'none',
                  flex: 1
                }}
              >
                <option value="off">Off (Translucent)</option>
                <option value="off_on_hover">Off on Hover (Opaque)</option>
              </select>
            </div>

            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Hover over any component to inspect live telemetry.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Drag to rotate · Scroll to zoom · Right-drag to pan
            </p>
          </div>
        </TwinViewer>
        </div>
      ) : (
        <div style={{ color: 'white', padding: 24 }}>Loading or no twin selected...</div>
      )}
    </div>
  );
}

export default App;
