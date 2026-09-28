import { Snowflake } from 'lucide-react';

export function Footer() {
  return (
    <footer style={{
      padding: '32px 24px',
      borderTop: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-panel)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: 'var(--text-secondary)',
      fontSize: '14px',
      marginTop: 'auto',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Snowflake size={16} style={{ color: 'var(--accent-blue)' }} />
        <span>&copy; 2026 PolarTwin. All rights reserved.</span>
      </div>
      <div style={{ display: 'flex', gap: '24px' }}>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>About</a>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</a>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</a>
      </div>
    </footer>
  );
}
