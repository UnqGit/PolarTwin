import { NavLink, Link } from 'react-router-dom';
import { 
  Box, 
  Activity, 
  Network, 
  Settings2, 
  History, 
  Snowflake,
  MonitorPlay,
  Sun,
  Moon
} from 'lucide-react';
import { useStation } from './StationContext';
import { useTheme } from './ThemeContext';
import { SimulationManager } from './SimulationManager';


export function Navbar() {
  const { selectedStation } = useStation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: `/${selectedStation}/overview`, icon: Activity, label: 'Overview' },
    { path: `/${selectedStation}/twin`, icon: MonitorPlay, label: 'Digital Twin' },
    { path: `/${selectedStation}/components`, icon: Box, label: 'Components' },
    { path: `/${selectedStation}/connections`, icon: Network, label: 'Connections' },
    { path: `/${selectedStation}/scenarios`, icon: Settings2, label: 'Scenario/Simulation' },
    { path: `/${selectedStation}/diagnostics`, icon: History, label: 'History' },
  ];

  return (
    <div className="glass-panel" style={{
      width: '100%',
      height: '64px',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none',
      borderRadius: '0 0 8px 8px',
      zIndex: 100,
      padding: '0 24px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-primary)'
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            color: 'var(--accent-blue)', 
            display: 'flex', 
            alignItems: 'center',
            background: 'var(--bg-input)',
            padding: '6px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Snowflake size={20} />
          </div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em' }}>
            PolarTwin
          </h1>
        </Link>
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 8px' }} />
        
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {selectedStation || 'Loading...'}
        </div>
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
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
              background: isActive ? 'var(--bg-input)' : 'transparent',
              boxShadow: isActive ? 'inset 0 -2px 0 var(--accent-blue)' : 'none',
            })}
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
        <SimulationManager />
        <button 
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--icon-color)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-overlay)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
}
