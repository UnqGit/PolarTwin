import React, { useContext } from 'react';
import { TypeIcon } from './TypeIcon';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';
import { HoverContext } from './HoverContext';
import { Link2 } from 'lucide-react';

interface HoverCardProps {
  root: NodeLayout;
  connections: ConnectionLayout[];
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
  explicitName?: string | null;
}

function findNode(root: NodeLayout, name: string): NodeLayout | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

export const HoverCard: React.FC<HoverCardProps> = ({ root, connections, liveStateRef, explicitName }) => {
  const { hoveredName } = useContext(HoverContext);
  const activeName = explicitName !== undefined ? explicitName : hoveredName;

  if (!activeName) return null;

  // Check if connection
  const conn = connections.find(c => c.id === activeName);
  if (conn) {
    return (
      <div className="glass-panel" style={cardStyle}>
        <div style={headerStyle}>
          <Link2 size={14} color='var(--accent-amber)' style={{ marginRight: 6 }} />
          CONNECTION
        </div>
        <div style={titleStyle}>
          {conn.source} → {conn.target}
        </div>
        <div style={bodyStyle}>
          <Row label="Source" value={conn.source} />
          <Row label="Target" value={conn.target} />
          <Row label="Type" value={conn.connectionType} />
        </div>
      </div>
    );
  }

  // Check if component
  const node = findNode(root, activeName);
  if (node) {
    // Get live status if available
    let status = 'Unknown';
    if (liveStateRef && liveStateRef.current && liveStateRef.current[node.name]) {
      const state = liveStateRef.current[node.name] as any;
      if (state.running !== undefined) {
        status = state.running ? 'Active' : 'Inactive';
      }
    }

    return (
      <div className="glass-panel" style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ color: 'var(--accent-blue)', marginRight: 6, display: 'flex', alignItems: 'center' }}><TypeIcon type={node.type} /></span>
          COMPONENT
        </div>
        <div style={titleStyle}>
          {node.name}
        </div>
        <div style={bodyStyle}>
          <Row label="Type" value={node.type || 'Generic'} />
          <Row label="ID" value={node.name} />
          <Row label="Status" value={status} />
        </div>
      </div>
    );
  }

  return null;
};

const cardStyle: React.CSSProperties = {
  width: 280,
  padding: '12px 14px',
  pointerEvents: 'none', // Hover card should not interfere with clicks
};

const headerStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
  display: 'flex',
  alignItems: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 10,
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: 8,
};

const bodyStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'monospace',
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
      {value === 'Active' ? <span style={{ color: '#4ade80' }}>Active</span> : value}
    </span>
  </div>
);
