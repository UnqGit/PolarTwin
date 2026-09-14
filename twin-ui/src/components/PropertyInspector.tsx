import React, { useState } from 'react';
import { TypeIcon } from './TypeIcon';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';

interface InspectorProps {
  node: NodeLayout;
  connections: ConnectionLayout[];
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
}

export const PropertyInspector: React.FC<InspectorProps> = ({ node, connections, liveStateRef }) => {
  const nodeConnections = connections.filter(
    c => c.source === node.name || c.target === node.name
  );

  const [liveState, setLiveState] = useState<Record<string, unknown>>({});

  React.useEffect(() => {
    if (!liveStateRef) return;
    const interval = setInterval(() => {
      const currentState = (liveStateRef.current?.[node.name] ?? {}) as Record<string, unknown>;
      // Only trigger re-render if state actually changed structurally
      setLiveState(prev => JSON.stringify(prev) !== JSON.stringify(currentState) ? currentState : prev);
    }, 500);
    return () => clearInterval(interval);
  }, [node.name, liveStateRef]);

  // Merge static spec properties with live telemetry
  // Telemetry overrides static spec
  const combinedProps = { ...node.spec, ...liveState };

  const specEntries = Object.entries(combinedProps).filter(
    ([k, _]) => !['dummy', 'length', 'width', 'breadth', 'height', 'unit', 'inputs'].includes(k.toLowerCase())
  );

  const renderValueWithUnit = (value: unknown) => {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      // Handle { value: 72, unit: "C" } schema if it exists
      const obj = value as { value: any; unit?: string };
      const valStr = typeof obj.value === 'number' ? obj.value.toFixed(2) : String(obj.value);
      return obj.unit ? `${valStr} ${obj.unit}` : valStr;
    }

    let valStr = typeof value === 'number' ? value.toFixed(2) : String(value);

    // Don't append a unit if the value already seems to have one (e.g. contains letters/symbols after numbers)
    if (typeof value === 'string' && /[0-9]\s*[a-zA-Z%°]+$/.test(value)) {
      return valStr;
    }

    // Determine unit
    let unit: string | undefined;
    // 1. Telemetry explicit "unit" sibling field? (e.g. { fuel_level: 60, unit: '%' })
    if (liveState.unit && typeof liveState.unit === 'string') {
      unit = liveState.unit;
    } 
    // 2. Spec explicit "unit" sibling field?
    else if (node.spec.unit && typeof node.spec.unit === 'string') {
      unit = node.spec.unit;
    }

    if (unit) {
      return `${valStr} ${unit}`;
    }
    return valStr;
  };

  return (
    <div style={{
      width: 320,
      background: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #334155',
      borderRadius: 8,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
      overflowY: 'auto',
      maxHeight: 'calc(100vh - 40px)',
      pointerEvents: 'auto',
    }}>
      {/* Inspector header */}
      <div style={{
        padding: '8px 14px',
        fontSize: 11,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>Inspector</span>
      </div>

      <div style={{
        padding: '12px 14px',
        fontSize: 12,
        color: '#94a3b8',
        fontFamily: 'monospace',
      }}>
        {/* Header */}
        <div style={{
          fontWeight: 700,
          fontSize: 13,
          color: '#e2e8f0',
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <TypeIcon type={node.type} />
          {node.name}
        </div>

        <Row label="Type" value={node.type} />

        {/* Position */}
        <SectionHeader>Position</SectionHeader>
        <Row label="X" value={`${node.position[0].toFixed(2)} m`} />
        <Row label="Y" value={`${node.position[1].toFixed(2)} m`} />
        <Row label="Z" value={`${node.position[2].toFixed(2)} m`} />

        {/* Dimensions */}
        <SectionHeader>Dimensions</SectionHeader>
        <Row label="Width"  value={`${node.dims.width.toFixed(2)} m`} />
        <Row label="Height" value={`${node.dims.height.toFixed(2)} m`} />
        <Row label="Depth"  value={`${node.dims.depth.toFixed(2)} m`} />

        {/* Spec properties */}
        {specEntries.length > 0 && (
          <>
            <SectionHeader>Properties</SectionHeader>
            {specEntries.map(([k, v]) => (
              <Row key={k} label={k} value={renderValueWithUnit(v)} />
            ))}
          </>
        )}

        {/* Connections */}
        {nodeConnections.length > 0 && (
          <>
            <SectionHeader>Connections</SectionHeader>
            {nodeConnections.map(c => (
              <div key={c.id} style={{ paddingLeft: 8, marginBottom: 3, color: '#64748b', fontSize: 11 }}>
                <span style={{ color: '#b87333' }}>
                  {c.profile.width < 1.0 ? '━' : '▭'}
                </span>{' '}
                {c.source === node.name ? `→ ${c.target}` : `← ${c.source}`}
                <span style={{ color: '#475569' }}> ({c.connectionType})</span>
              </div>
            ))}
          </>
        )}

        {/* Tags */}
        {node.tags.length > 0 && (
          <>
            <SectionHeader>Tags</SectionHeader>
            <div style={{ paddingLeft: 8, color: '#64748b', fontSize: 11 }}>
              {node.tags.join(', ')}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    marginTop: 12,
    marginBottom: 6,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#475569',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: 4,
  }}>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
    <span style={{ color: '#64748b' }}>{label}</span>
    <span style={{ color: '#cbd5e1', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
  </div>
);
