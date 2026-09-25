import { useState, useEffect, useRef } from 'react';
import { Snowflake } from 'lucide-react';
import { TwinViewer, type LightingMode } from '../components/TwinViewer';
import { useStation } from '../components/StationContext';

const hierarchyFiles = import.meta.glob('../../../data/compiled/*/hierarchy.json', { eager: true, import: 'default' });
const connectionFiles = import.meta.glob('../../../data/compiled/*/connection.json', { eager: true, import: 'default' });
const specFiles = import.meta.glob('../../../data/compiled/*/spec.json', { eager: true, import: 'default' });

// The StationContext handles available twins now.

export function DigitalTwin() {
  const { selectedStation: selectedTwin } = useStation();
  const [lightingMode, setLightingMode] = useState<LightingMode>('off');
  const [containerOcclusion, setContainerOcclusion] = useState<'off' | 'off_on_hover'>('off');
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);

  useEffect(() => {
    setSelectedComponentName(null);
  }, [selectedTwin]);

  // liveStateRef will hold the latest telemetry without triggering React re-renders
  const liveStateRef = useRef<Record<string, unknown>>({});

  const hierarchy = selectedTwin ? hierarchyFiles[`../../../data/compiled/${selectedTwin}/hierarchy.json`] : null;
  const connections = selectedTwin ? connectionFiles[`../../../data/compiled/${selectedTwin}/connection.json`] : null;
  const spec = selectedTwin ? specFiles[`../../../data/compiled/${selectedTwin}/spec.json`] : null;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {hierarchy && connections && spec ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <TwinViewer
            topology={hierarchy}
            connections={connections}
            specification={spec}
            liveStateRef={liveStateRef}
            lightingMode={lightingMode}
            containerOcclusion={containerOcclusion}
            selectedName={selectedComponentName}
            onSelectName={setSelectedComponentName}
          >
            {/* Top-left title card */}
            <div className="glass-panel" style={{
              position: 'absolute',
              top: 20, left: 20, zIndex: 10,
              padding: '16px 20px',
              color: 'var(--text-primary)',
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

            {/* HUD overlay - Focus */}
            <div className="glass-panel" style={{
              position: 'absolute',
              bottom: 20, left: 20, zIndex: 10,
              color: 'var(--text-primary)',
              padding: '14px 18px',
              display: 'flex', flexDirection: 'column', gap: '8px',
              width: 280,
            }}>
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


