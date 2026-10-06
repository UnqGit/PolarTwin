import { NavLink, Link } from 'react-router-dom';
import {
  Activity,
  Network,
  Settings2,
  History,
  Snowflake,
  MonitorPlay,
  Sun,
  Moon,
  Box
} from 'lucide-react';
import { useStation } from './StationContext';
import { useTheme } from './ThemeContext';
import { SimulationManager } from './SimulationManager';

export function Navbar() {
  const { selectedStation } = useStation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: `/${selectedStation}/overview`,     icon: Activity,    label: 'Overview' },
    { path: `/${selectedStation}/twin`,         icon: MonitorPlay, label: 'Twin' },
    { path: `/${selectedStation}/components`,   icon: Box,         label: 'Components' },
    { path: `/${selectedStation}/connections`,  icon: Network,     label: 'Connections' },
    { path: `/${selectedStation}/scenarios`,    icon: Settings2,   label: 'Scenarios' },
    { path: `/${selectedStation}/diagnostics`,  icon: History,     label: 'History' },
  ];

  return (
    <header className="navbar">
      {/* Left — Logo + Station */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <Link to="/" className="nav-logo">
          <div className="nav-logo-icon">
            <Snowflake size={17} />
          </div>
          <span className="nav-logo-text">PolarTwin</span>
        </Link>

        {selectedStation && (
          <>
            <div className="divider-v" style={{ height: 20, margin: '0 12px' }} />
            <div className="nav-station-badge">
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--status-active)',
                boxShadow: '0 0 6px var(--status-active)',
                animation: 'pulseDot 2.5s infinite'
              }} />
              {selectedStation}
            </div>
          </>
        )}
      </div>

      {/* Center — Nav items */}
      <nav className="nav-items">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={15} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Right — Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <SimulationManager />
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          style={{ borderRadius: 'var(--radius-full)' }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
