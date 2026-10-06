import { Snowflake } from 'lucide-react';

export function Footer() {
  return (
    <footer style={{
      padding: '20px 32px',
      borderTop: '1px solid var(--border-color)',
      background: 'var(--bg-panel)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
        <Snowflake size={13} style={{ color: 'var(--accent-primary)' }} />
        <span>© 2026 PolarTwin</span>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        {['About', 'Privacy', 'Terms'].map(label => (
          <a
            key={label}
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 12, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            {label}
          </a>
        ))}
      </div>
    </footer>
  );
}
