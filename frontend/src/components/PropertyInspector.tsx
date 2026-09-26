import React, { useState } from 'react';
import { TypeIcon } from './TypeIcon';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';

interface InspectorProps {
  node: NodeLayout;
  connections: ConnectionLayout[];
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
  flat?: boolean;
}

export const PropertyInspector: React.FC<InspectorProps> = ({ node, connections, liveStateRef, flat = false }) => {
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

  // Combine keys from spec and liveState
  const specObj = node.spec || {};
  const ratingKeys: string[] = [];
  if (specObj.rating) {
    for (const cat of ['input', 'state', 'output']) {
      if ((specObj.rating as any)[cat]) {
        ratingKeys.push(...Object.keys((specObj.rating as any)[cat]));
      }
    }
  }
  const allKeys = Array.from(new Set([...Object.keys(specObj), ...Object.keys(liveState), ...ratingKeys]));

  const ignoreKeys = ['dummy', 'length', 'width', 'breadth', 'height', 'unit', 'inputs', 'status', 'rating', 'id', 'name', 'type', 'position', 'rotation', 'scale', 'measures'];
  const propKeys = allKeys.filter(k => !ignoreKeys.includes(k.toLowerCase()));

  // Categorize properties
  const inputs: string[] = [];
  const states: string[] = [];
  const outputs: string[] = [];
  const others: string[] = [];

  for (const k of propKeys) {
    let categorized = false;
    if (specObj.rating) {
      if ((specObj.rating as any).input && (specObj.rating as any).input[k]) { inputs.push(k); categorized = true; }
      else if ((specObj.rating as any).state && (specObj.rating as any).state[k]) { states.push(k); categorized = true; }
      else if ((specObj.rating as any).output && (specObj.rating as any).output[k]) { outputs.push(k); categorized = true; }
    }
    if (!categorized) {
      others.push(k);
    }
  }

  // Determine active/inactive/failure status
  let statusStr = "ACTIVE";
  let statusColor = "#4ade80"; // green
  if (liveState.status) {
    const s = String(liveState.status).toLowerCase();
    if (s === 'active' || s === 'ok') { statusStr = 'ACTIVE'; statusColor = '#4ade80'; }
    else if (s === 'inactive' || s === 'off') { statusStr = 'INACTIVE'; statusColor = '#94a3b8'; }
    else { statusStr = 'FAILURE'; statusColor = '#ef4444'; } // red for failure, error, fault
  }

  const getSpecDetail = (key: string): any => {
    if (!specObj.rating) return null;
    for (const category of ['input', 'state', 'output']) {
      const catObj = (specObj.rating as any)[category];
      if (catObj && catObj[key]) return catObj[key];
    }
    return null;
  };

  const getUnit = (key: string): string => {
    const detail = getSpecDetail(key);
    if (detail && detail.unit) return detail.unit;
    if (specObj[key] && (specObj[key] as any).unit) return (specObj[key] as any).unit;
    if (liveState.unit) return String(liveState.unit);
    return '';
  };

  const renderPropRow = (k: string) => {
    let liveVal = liveState[k];
    let specVal = specObj[k] ?? getSpecDetail(k);
    
    let isOob = false;
    let limitStr = '';
    
    if (specVal !== undefined) {
       if (typeof specVal === 'object' && specVal !== null) {
          const min = (specVal as any).min;
          const max = (specVal as any).max;
          if (min !== undefined && max !== undefined) {
             limitStr = `${min} : ${max}`;
             if (typeof liveVal === 'number' && (liveVal < min || liveVal > max)) isOob = true;
          }
       } else if (typeof specVal === 'number') {
          limitStr = `≤ ${specVal}`;
          if (typeof liveVal === 'number' && liveVal > specVal) isOob = true;
       }
    }

    const unit = getUnit(k);
    let valStr = '';
    
    const displayVal = liveVal !== undefined ? liveVal : (specVal !== undefined && typeof specVal !== 'object' ? specVal : undefined);
    
    if (displayVal !== undefined) {
      if (typeof displayVal === 'number') {
         valStr = `${displayVal.toFixed(2)}`;
      } else {
         valStr = String(displayVal);
      }
      
      if (unit && !valStr.endsWith(unit)) {
         valStr += ` ${unit}`;
      }
    }

    return (
      <div key={k} style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13,
        padding: '2px 4px', borderRadius: 4,
        background: isOob ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
      }}>
        <div style={{ color: 'var(--text-secondary)' }}>{k}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {limitStr && <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{limitStr}{unit ? ` ${unit}` : ''}</div>}
          <div style={{ 
            color: isOob ? '#ef4444' : 'var(--text-primary)', 
            fontWeight: isOob ? 600 : 400 
          }}>{valStr}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={flat ? "" : "glass-panel"} style={flat ? { width: '100%' } : {
      minWidth: 320,
      maxWidth: '40vw',
      width: 'max-content',
      overflowY: 'auto',
      maxHeight: '100%',
      pointerEvents: 'auto',
    }}>
      {/* Inspector header */}
      {!flat && (
        <div style={{
          padding: '8px 14px',
          fontSize: 11,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderBottom: '1px solid var(--hover-overlay)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>Inspector</span>
        </div>
      )}

      <div style={{
        padding: '12px 14px',
        fontSize: 12,
        color: 'var(--text-secondary)',
        fontFamily: 'monospace',
      }}>
        {/* Header */}
        <div style={{
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--text-primary)',
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-color)',
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
        <Row label="X" value={`${node.position?.[0]?.toFixed(2) ?? '0.00'} m`} />
        <Row label="Y" value={`${node.position?.[1]?.toFixed(2) ?? '0.00'} m`} />
        <Row label="Z" value={`${node.position?.[2]?.toFixed(2) ?? '0.00'} m`} />

        {/* Dimensions */}
        <SectionHeader>Dimensions</SectionHeader>
        <Row label="Width"  value={`${node.dims?.width?.toFixed(2) ?? '0.00'} m`} />
        <Row label="Height" value={`${node.dims?.height?.toFixed(2) ?? '0.00'} m`} />
        <Row label="Depth"  value={`${node.dims?.depth?.toFixed(2) ?? '0.00'} m`} />

        {/* Status */}
        <SectionHeader>Status</SectionHeader>
        <Row 
          label="Current Status" 
          value={
            <span style={{ color: statusColor, fontWeight: 600 }}>
              {statusStr}
            </span>
          } 
        />

        {/* Spec properties Ratings */}
        {(inputs.length > 0 || states.length > 0 || outputs.length > 0) && (
          <SectionHeader>Ratings</SectionHeader>
        )}
        
        {inputs.length > 0 && (
          <div style={{ paddingLeft: 8, marginBottom: 8 }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic', marginBottom: 4 }}>input:</div>
            {inputs.map(renderPropRow)}
          </div>
        )}
        
        {states.length > 0 && (
          <div style={{ paddingLeft: 8, marginBottom: 8 }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic', marginBottom: 4 }}>state:</div>
            {states.map(renderPropRow)}
          </div>
        )}
        
        {outputs.length > 0 && (
          <div style={{ paddingLeft: 8, marginBottom: 8 }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic', marginBottom: 4 }}>output:</div>
            {outputs.map(renderPropRow)}
          </div>
        )}

        {others.length > 0 && (
          <div style={{ paddingLeft: 8, marginBottom: 8 }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic', marginBottom: 4 }}>other parameters:</div>
            {others.map(renderPropRow)}
          </div>
        )}

        {/* Connections */}
        {nodeConnections.length > 0 && (
          <>
            <SectionHeader>{node.type.toLowerCase().includes('bus') ? 'Bus Connections' : 'Connections'}</SectionHeader>
            {node.type.toLowerCase().includes('bus') && (
              <div style={{ paddingLeft: 8, marginBottom: 8, color: 'var(--text-secondary)', fontSize: 11, fontStyle: 'italic' }}>
                Groups wires of type: {nodeConnections[0]?.connectionType || 'Unknown'}
              </div>
            )}
            {nodeConnections.map(c => (
              <div key={c.id} style={{ paddingLeft: 8, marginBottom: 3, color: 'var(--text-tertiary)', fontSize: 11 }}>
                <span style={{ color: '#b87333' }}>
                  {c.profile.width < 1.0 ? '━' : '▭'}
                </span>{' '}
                {`${c.source} → ${c.target}`}
                <span style={{ color: 'var(--text-tertiary)' }}> ({c.connectionType})</span>
              </div>
            ))}
          </>
        )}

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <>
            <SectionHeader>Tags</SectionHeader>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {node.tags.map((t: string) => (
                <div key={t} style={{
                  background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 12,
                  fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border-solid)'
                }}>
                  {t}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    marginTop: 12,
    marginBottom: 6,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--hover-overlay)',
    paddingBottom: 4,
  }}>
    {children}
  </div>
);

export const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    <span style={{ color: 'var(--text-secondary)', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
  </div>
);
