import React, { useState } from 'react';
import { TypeIcon } from './TypeIcon';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';
import { fromCanonical } from './HierarchyPanel';

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
      const currentState = { ...((liveStateRef.current?.[node.name] ?? {}) as Record<string, unknown>) };
      
      // If it's a sensor array, we also need to include grouped sensors in the tracked state
      // so we trigger re-renders when their state changes.
      if (node.type === 'sensor array' && node.groupedSensors) {
        node.groupedSensors.forEach((s: any) => {
           currentState[s.name] = liveStateRef.current?.[s.name];
        });
      }
      
      // Only trigger re-render if state actually changed structurally
      setLiveState(prev => JSON.stringify(prev) !== JSON.stringify(currentState) ? currentState : prev);
    }, 500);
    return () => clearInterval(interval);
  }, [node.name, liveStateRef, node.type, node.groupedSensors]);

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

  const ignoreKeys = ['dummy', 'length', 'width', 'breadth', 'height', 'unit', 'inputs', 'status', 'rating', 'id', 'name', 'type', 'position', 'rotation', 'scale', 'measures', 'tolerance'];
  const propKeys = allKeys.filter(k => !ignoreKeys.includes(k.toLowerCase()) && !k.toLowerCase().startsWith('failure_time'));

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
  if (node.type === 'sensor array' && node.groupedSensors) {
     const activeCount = node.groupedSensors.filter((s: any) => {
       const st = liveStateRef?.current?.[s.name] as any;
       return st && st.running;
     }).length;
     statusStr = `${activeCount}/${node.groupedSensors.length} ACTIVE`;
     statusColor = activeCount > 0 ? "#4ade80" : "#94a3b8";
  } else if (liveState.status) {
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
    let displayVal: any = undefined;
    let isDisplayCanonical = false;
    let isLimitCanonical = false;
    const unit = getUnit(k);

    // 1. Get value and bounds from live state
    if (typeof liveVal === 'object' && liveVal !== null && !Array.isArray(liveVal)) {
      const liveObj = liveVal as Record<string, any>;
      const numericVal = liveObj.value ?? liveObj.current;
      const min = liveObj.min;
      const max = liveObj.max;
      
      if (min !== undefined && max !== undefined) {
        limitStr = `${min} : ${max}`;
        isLimitCanonical = true;
        if (typeof numericVal === 'number' && (numericVal < min || numericVal > max)) isOob = true;
      } else if (max !== undefined) {
        limitStr = `≤ ${max}`;
        isLimitCanonical = true;
        if (typeof numericVal === 'number' && numericVal > max) isOob = true;
      }
      displayVal = numericVal;
      isDisplayCanonical = true;
    } else if (liveVal !== undefined) {
      displayVal = liveVal;
      isDisplayCanonical = true;
    }
    
    // 2. Fill missing bounds and values from spec
    let specMin: number | undefined;
    let specMax: number | undefined;
    if (typeof specVal === 'object' && specVal !== null) {
      specMin = (specVal as any).min;
      specMax = (specVal as any).max;
      if (!limitStr && specMin !== undefined && specMax !== undefined) {
        limitStr = `${specMin} : ${specMax}`;
        isLimitCanonical = false;
      } else if (!limitStr && specMax !== undefined) {
        limitStr = `≤ ${specMax}`;
        isLimitCanonical = false;
      }
      if (displayVal === undefined) {
        displayVal = (specVal as any).value ?? (specVal as any).current;
        isDisplayCanonical = false;
      }
    } else if (specVal !== undefined) {
      if (!limitStr && typeof specVal === 'number') {
        limitStr = `≤ ${specVal}`;
        isLimitCanonical = false;
      }
      if (displayVal === undefined) {
        displayVal = specVal;
        isDisplayCanonical = false;
      }
    }

    // 3. Convert displayVal from canonical if needed
    if (isDisplayCanonical && unit && typeof displayVal === 'number') {
      displayVal = fromCanonical(displayVal, unit);
    }
    
    // 4. OOB check if we have a numeric live value but bounds came from spec
    if (isDisplayCanonical && !isLimitCanonical && typeof displayVal === 'number') {
      if (specMin !== undefined && specMax !== undefined) {
        if (displayVal < specMin || displayVal > specMax) isOob = true;
      } else if (specMax !== undefined) {
        if (displayVal > specMax) isOob = true;
      }
    }

    // 5. Convert limitStr from canonical if needed
    if (isLimitCanonical && limitStr && unit) {
       const parts = limitStr.split(':').map(s => s.trim());
       if (parts.length === 2) {
          const min = parseFloat(parts[0]);
          const max = parseFloat(parts[1]);
          if (!isNaN(min) && !isNaN(max)) {
             limitStr = `${Number(fromCanonical(min, unit).toFixed(4))} : ${Number(fromCanonical(max, unit).toFixed(4))}`;
          }
       } else if (limitStr.startsWith('≤')) {
          const max = parseFloat(limitStr.replace('≤', '').trim());
          if (!isNaN(max)) {
             limitStr = `≤ ${Number(fromCanonical(max, unit).toFixed(4))}`;
          }
       }
    }
    let valStr = '';
    if (displayVal !== undefined && displayVal !== null) {
      if (typeof displayVal === 'object') {
         if ('value' in displayVal) displayVal = displayVal.value;
         else if ('current' in displayVal) displayVal = displayVal.current;
      }
      
      if (typeof displayVal === 'number') {
         valStr = `${displayVal.toFixed(2)}`;
      } else if (typeof displayVal === 'boolean') {
         valStr = displayVal ? 'Yes' : 'No';
      } else if (typeof displayVal === 'object') {
         valStr = JSON.stringify(displayVal);
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
          }}>{valStr || '—'}</div>
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
        {(() => {
          const w = (liveStateRef?.current?.[node.name] as any)?.width?.value ?? (node.spec?.dimensions as any)?.width?.value ?? node.dims?.width ?? 0;
          const h = (liveStateRef?.current?.[node.name] as any)?.height?.value ?? (node.spec?.dimensions as any)?.height?.value ?? node.dims?.height ?? 0;
          const d = (liveStateRef?.current?.[node.name] as any)?.length?.value ?? (node.spec?.dimensions as any)?.length?.value ?? node.dims?.depth ?? 0;
          if (!w && !h && !d) return null;
          return (
            <>
              <SectionHeader>Dimensions</SectionHeader>
              {w > 0 && <Row label="Width"  value={`${w.toFixed(2)} m`} />}
              {h > 0 && <Row label="Height" value={`${h.toFixed(2)} m`} />}
              {d > 0 && <Row label="Length/Depth"  value={`${d.toFixed(2)} m`} />}
            </>
          );
        })()}

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

        {/* Grouped Sensors */}
        {node.type === 'sensor array' && node.groupedSensors && node.groupedSensors.length > 0 && (
          <>
            <SectionHeader>Grouped Sensors ({node.groupedSensors.length})</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8, marginBottom: 8 }}>
              {node.groupedSensors.map((s: any) => {
                const sLive = liveStateRef?.current?.[s.name] as any || {};
                const active = sLive.running;
                return (
                  <div key={s.name} style={{
                    padding: '8px', 
                    borderRadius: 4, 
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--hover-overlay)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                      <span style={{ color: active ? '#4ade80' : '#94a3b8', fontSize: 11, fontWeight: 600 }}>{active ? 'ACTIVE' : 'INACTIVE'}</span>
                    </div>
                    {/* Render individual sensor data - basic values from live state */}
                    {Object.keys(sLive).filter(k => !['running', 'status', 'id'].includes(k)).map(k => (
                       <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                         <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                         <span style={{ color: 'var(--text-secondary)' }}>{typeof sLive[k] === 'number' ? sLive[k].toFixed(2) : String(sLive[k])}</span>
                       </div>
                    ))}
                    {s.tags && s.tags.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {s.tags.map((t: string) => (
                          <span key={t} style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 8, fontSize: 9, color: 'var(--text-secondary)' }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
    marginTop: 14,
    marginBottom: 6,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 5,
  }}>
    {children}
  </div>
);

export const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 8, alignItems: 'flex-start' }}>
    <span style={{ color: 'var(--text-tertiary)', fontSize: 12, flexShrink: 0 }}>{label}</span>
    <span style={{ color: 'var(--text-secondary)', textAlign: 'right', wordBreak: 'break-all', fontSize: 12, fontWeight: 500 }}>{value}</span>
  </div>
);
