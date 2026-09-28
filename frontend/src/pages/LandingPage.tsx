import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type StationManifest } from '../lib/api';
import { Snowflake, Activity, Box, MapPin, Radio, MonitorPlay, Zap, Sun, Moon } from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [stations, setStations] = useState<StationManifest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStations()
      .then(data => {
        setStations(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch stations:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Hero Section */}
      <section style={{
        position: 'relative',
        height: '60vh',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {/* Background Image */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'url(/hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.6) saturate(1.2)',
          zIndex: 0
        }} />
        
        {/* Overlay Gradient */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, rgba(10,13,20,0.3) 0%, var(--bg-main) 100%)',
          zIndex: 1
        }} />

        {/* Theme Toggle Button */}
        <div style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 3
        }}>
          <button 
            onClick={toggleTheme}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '10px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              backdropFilter: 'blur(4px)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        
        {/* Hero Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ 
            color: 'var(--accent-blue)', 
            display: 'flex', 
            alignItems: 'center',
            background: 'rgba(10, 13, 20, 0.6)',
            padding: '16px',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            marginBottom: '16px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Snowflake size={48} />
          </div>
          <h1 style={{ 
            fontSize: '64px', 
            fontWeight: 800, 
            letterSpacing: '-0.03em',
            margin: 0,
            textShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            PolarTwin
          </h1>
          <p style={{ 
            fontSize: '20px', 
            color: 'rgba(255,255,255,0.8)',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Advanced digital twin simulation platform for Antarctic research stations. Monitor, simulate, and analyze infrastructure in the harshest environments on Earth.
          </p>
        </div>
      </section>

      {/* Stations Grid Section */}
      <section style={{
        flex: 1,
        padding: '64px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Select a Station</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0 }}>
            Choose an active deployment to access its digital twin, component hierarchy, and scenario simulations.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
            <Activity size={32} className="spinning" style={{ color: 'var(--accent-blue)' }} />
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'stretch',
            gap: '24px'
          }}>
            {stations.map((station) => (
              <Link 
                key={station.station_id}
                to={`/${station.station_id}/overview`}
                style={{ textDecoration: 'none', display: 'flex', width: '320px' }}
              >
                <div style={{
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '24px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  width: '100%',
                  height: '100%',
                  boxSizing: 'border-box'
                }}
                className="station-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--accent-blue)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '48px', height: '48px', 
                      borderRadius: '12px', 
                      backgroundColor: 'var(--bg-input)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent-blue)'
                    }}>
                      <MapPin size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>{station.station_id}</h3>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Active Deployment</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <Box size={16} />
                      {station.component_count} Components
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <Activity size={16} />
                      {station.connection_count} Connections
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Features Overview Section */}
      <section style={{
        padding: '64px 24px',
        backgroundColor: 'var(--bg-panel-secondary)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Platform Capabilities</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
              Everything you need to monitor, simulate, and optimize remote research infrastructure.
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '32px'
          }}>
            <div style={{ flex: '1 1 300px', maxWidth: '350px', padding: '32px', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ color: 'var(--accent-blue)', padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: '50%' }}>
                <Radio size={32} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>Real-time Telemetry</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Stream live sensor data from physical components directly into the digital twin for instant health monitoring and diagnostics.
              </p>
            </div>
            
            <div style={{ flex: '1 1 300px', maxWidth: '350px', padding: '32px', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ color: 'var(--accent-purple)', padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: '50%' }}>
                <MonitorPlay size={32} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>Scenario Simulation</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Design custom timeline events—like extreme weather or power failures—and watch the station components react dynamically.
              </p>
            </div>
            
            <div style={{ flex: '1 1 300px', maxWidth: '350px', padding: '32px', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ color: 'var(--accent-cyan)', padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: '50%' }}>
                <Zap size={32} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>Interactive 3D Visualizations</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Explore an immersive representation of the station hierarchy, enabling rapid spatial awareness and component localization.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '32px 24px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-panel)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'var(--text-secondary)',
        fontSize: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Snowflake size={16} style={{ color: 'var(--accent-blue)' }}/>
          <span>&copy; 2026 PolarTwin. All rights reserved.</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>About</a>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
