import { NavLink } from 'react-router-dom';
import { 
  Box, 
  Activity, 
  Network, 
  Settings2, 
  History, 
  Snowflake,
  MonitorPlay
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Activity, label: 'Overview' },
  { path: '/twin', icon: MonitorPlay, label: 'Digital Twin' },
  { path: '/components', icon: Box, label: 'Components' },
  { path: '/connections', icon: Network, label: 'Connections' },
  { path: '/scenarios', icon: Settings2, label: 'Scenario' },
  { path: '/diagnostics', icon: History, label: 'History' },
];

export function Navbar() {
  return (
    <div className="glass-panel" style={{
      width: '100%',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
      borderRadius: '0 0 8px 8px',
      zIndex: 100,
      padding: '0 24px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-primary)',
        marginRight: '48px'
      }}>
        <div style={{ 
          color: 'var(--accent-blue)', 
          display: 'flex', 
          alignItems: 'center',
          background: 'rgba(59, 130, 246, 0.1)',
          padding: '6px',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <Snowflake size={20} />
        </div>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em' }}>
          PolarTwin
        </h1>
      </div>

      <nav style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '13px',
              transition: 'all 0.2s ease',
              color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              boxShadow: isActive ? 'inset 0 -2px 0 var(--accent-blue)' : 'none',
            })}
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
        v1.0.0
      </div>
    </div>
  );
}
