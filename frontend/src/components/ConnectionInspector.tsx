import React, { useState, useEffect } from 'react';
import type { ConnectionLayout } from '../lib/layout';
import { SectionHeader, Row } from './PropertyInspector';

interface ConnectionInspectorProps {
  connection: ConnectionLayout;
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
  flat?: boolean;
}

export const ConnectionInspector: React.FC<ConnectionInspectorProps> = ({ connection, liveStateRef, flat }) => {
  const [liveState, setLiveState] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!liveStateRef) return;
    const interval = setInterval(() => {
      const currentState = { ...((liveStateRef.current?.[connection.id] ?? {}) as Record<string, unknown>) };
      
      if ((connection as any).isBus && (connection as any).groupedConnections) {
        (connection as any).groupedConnections.forEach((c: any) => {
           if (c.id) currentState[c.id] = liveStateRef.current?.[c.id];
        });
      }
      
      setLiveState(prev => JSON.stringify(prev) !== JSON.stringify(currentState) ? currentState : prev);
    }, 500);
    return () => clearInterval(interval);
  }, [connection.id, liveStateRef, (connection as any).isBus, (connection as any).groupedConnections]);

  let statusStr = "ACTIVE";
  let statusColor = "var(--status-active)";
  if ((connection as any).isBus && (connection as any).groupedConnections) {
     const activeCount = (connection as any).groupedConnections.filter((c: any) => {
       const st = liveStateRef?.current?.[c.id] as any;
       return st && (String(st.status).toLowerCase() === 'active' || String(st.status).toLowerCase() === 'ok');
     }).length;
     statusStr = `${activeCount}/${(connection as any).groupedConnections.length} ACTIVE`;
     statusColor = activeCount > 0 ? "var(--status-active)" : "var(--status-inactive)";
  } else if (liveState.status) {
    const s = String(liveState.status).toLowerCase();
    if (s === 'active' || s === 'ok') { statusStr = 'ACTIVE'; statusColor = 'var(--status-active)'; }
    else if (s === 'inactive' || s === 'off') { statusStr = 'INACTIVE'; statusColor = 'var(--status-inactive)'; }
    else { statusStr = 'FAILURE'; statusColor = 'var(--status-critical)'; }
  }

  return (
    <div className={flat ? "" : "glass-panel"} style={flat ? { width: '100%' } : {
      minWidth: 320,
      maxWidth: '40vw',
      width: 'max-content',
      overflowY: 'auto',
      maxHeight: '100%',
      pointerEvents: 'auto',
    }}>
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
          <span>Connection Inspector</span>
        </div>
      )}

      <div style={{
        padding: '12px 14px',
        fontSize: 12,
        color: 'var(--text-secondary)',
        fontFamily: 'monospace',
      }}>
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
          {`${connection.source} → ${connection.target}`}
        </div>

        <SectionHeader>Details</SectionHeader>
        <Row label="Type" value={connection.connectionType} />
        <Row label="Source" value={connection.source} />
        <Row label="Target" value={connection.target} />
        <Row label="Relation" value={connection.relation} />

        <SectionHeader>Status</SectionHeader>
        <Row 
          label="Current Status" 
          value={
            <span style={{ color: statusColor, fontWeight: 600 }}>
              {statusStr}
            </span>
          } 
        />
        
        {/* Bus Connections */}
        {(connection as any).isBus && (connection as any).groupedConnections && (
          <>
            <SectionHeader>Bus Connections ({(connection as any).groupedConnections.length})</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8 }}>
              {(connection as any).groupedConnections.map((c: any, i: number) => {
                const cLive = liveState[c.id] as any || {};
                let cStatus = 'UNKNOWN';
                let cColor = 'var(--status-inactive)';
                if (cLive.status) {
                   const cs = String(cLive.status).toLowerCase();
                   if (cs === 'active' || cs === 'ok') { cStatus = 'ACTIVE'; cColor = 'var(--status-active)'; }
                   else if (cs === 'inactive' || cs === 'off') { cStatus = 'INACTIVE'; cColor = 'var(--status-inactive)'; }
                   else { cStatus = 'FAILURE'; cColor = 'var(--status-critical)'; }
                }
                
                return (
                <div key={i} style={{ padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.source} → {c.target}</span>
                    <span style={{ color: cColor, fontWeight: 600 }}>{cStatus}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{c.id || c.relation || 'No relation'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.type}</span>
                  </div>
                  
                  {Object.keys(cLive).filter(k => !['status', 'id', 'name', 'time'].includes(k)).map(k => (
                     <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 2, marginTop: 2 }}>
                       <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                       <span style={{ color: 'var(--text-secondary)' }}>{typeof cLive[k] === 'number' ? cLive[k].toFixed(2) : String(cLive[k])}</span>
                     </div>
                  ))}
                </div>
              )})}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
