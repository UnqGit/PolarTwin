import React from 'react';
import { Html } from '@react-three/drei';
import { Activity, Zap, Thermometer, Info } from 'lucide-react';

interface EmbeddedOverviewProps {
  embeddedNodes: any[];
  liveState: any;
  visible: boolean;
}

const getIconForType = (type: string) => {
  const t = (type || "").toLowerCase();
  if (t.includes('thermometer') || t.includes('temp')) return <Thermometer size={14} />;
  if (t.includes('sensor')) return <Activity size={14} />;
  if (t.includes('power') || t.includes('energy') || t.includes('generator')) return <Zap size={14} />;
  return <Info size={14} />;
};

export const EmbeddedOverview: React.FC<EmbeddedOverviewProps> = ({ embeddedNodes, liveState, visible }) => {
  if (!visible || embeddedNodes.length === 0) return null;

  return (
    <Html
      position={[0, 1.5, 0]}
      center
      style={{
        transition: 'all 0.2s',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none'
      }}
    >
      <div style={{
        background: 'rgba(20, 20, 25, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px',
        color: '#fff',
        width: '220px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: 'sans-serif'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
          Embedded Subsystems
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {embeddedNodes.map((node) => {
            const state = liveState?.[node.name] || {};
            // Display a few key metrics from state
            const metrics = Object.entries(state)
              .filter(([k]) => k !== 'inputs' && k !== 'running')
              .slice(0, 2);

            return (
              <div key={node.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a0a0ff' }}>
                  {getIconForType(node.type)}
                  <span style={{ fontWeight: 'bold' }}>{node.name}</span>
                </div>
                {metrics.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', paddingLeft: '20px' }}>
                    {metrics.map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#888', fontSize: '10px' }}>{key}</span>
                        <span>{typeof val === 'number' ? val.toFixed(2) : String(val)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ paddingLeft: '20px', color: '#666', fontSize: '10px' }}>No active metrics</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Html>
  );
};
