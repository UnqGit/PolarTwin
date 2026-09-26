import React from 'react';
import type { ConnectionLayout } from '../lib/layout';
import { SectionHeader, Row } from './PropertyInspector';

interface ConnectionInspectorProps {
  connection: ConnectionLayout;
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
  flat?: boolean;
}

export const ConnectionInspector: React.FC<ConnectionInspectorProps> = ({ connection, liveStateRef, flat }) => {
  const liveState = (liveStateRef?.current?.[connection.id] ?? {}) as Record<string, unknown>;

  let statusStr = "ACTIVE";
  let statusColor = "#4ade80"; // green
  if (liveState.status) {
    const s = String(liveState.status).toLowerCase();
    if (s === 'active' || s === 'ok') { statusStr = 'ACTIVE'; statusColor = '#4ade80'; }
    else if (s === 'inactive' || s === 'off') { statusStr = 'INACTIVE'; statusColor = '#94a3b8'; }
    else { statusStr = 'FAILURE'; statusColor = '#ef4444'; }
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
      </div>
    </div>
  );
};
