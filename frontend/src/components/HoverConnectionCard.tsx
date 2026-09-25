import React from 'react';

interface HoverConnectionCardProps {
  connection: any;
  accentColor?: string;
}

export const HoverConnectionCard: React.FC<HoverConnectionCardProps> = ({ connection, accentColor = '#93c5fd' }) => {
  return (
    <div style={{
      background: 'rgba(10,12,20,0.94)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${accentColor}55`,
      borderRadius: 7,
      padding: '7px 12px',
      color: '#f1f5f9',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 11,
      whiteSpace: 'nowrap',
      boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
      marginTop: 12,
    }}>
      <div style={{ fontWeight: 700, color: accentColor, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        {connection.connectionType} connection
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        {connection.source}{' '}
        <span style={{ color: 'var(--text-tertiary)' }}>{connection.direction}</span>{' '}
        {connection.target}
      </div>
    </div>
  );
};
