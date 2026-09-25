import React, { useEffect, useState } from 'react';
import { useStation } from '../components/StationContext';
import { Activity, Thermometer, Zap, Box, AlertTriangle, CheckCircle, Package } from 'lucide-react';

// Mock data generator for block cards
const MOCK_BLOCKS = [
  { id: 'EnergyBlock', name: 'Energy Block', status: 'active', img: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' },
  { id: 'LivingQuarters', name: 'Living Quarters', status: 'active', img: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' },
  { id: 'ResearchLab', name: 'Research Lab', status: 'inactive', img: 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' },
  { id: 'CommsTower', name: 'Comms Tower', status: 'failure', img: 'https://images.unsplash.com/photo-1544256718-3b6102796440?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' },
];

export function Overview() {
  const { selectedStation } = useStation();
  
  // Real implementation would fetch this from /simulations/{runId}/state
  const [stats, setStats] = useState({
    activeComponents: 42,
    totalComponents: 45,
    powerOutput: '120.5 kW',
    temperature: '-12.4 °C',
    nextSupply: '14 days'
  });

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0' }}>{selectedStation} Overview</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>System status and high-level telemetry</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {/* Metric Cards */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            <Activity size={20} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Components</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>
            <span style={{ color: 'var(--accent-blue)' }}>{stats.activeComponents}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '16px' }}> / {stats.totalComponents}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            <Zap size={20} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Power Output</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-amber)' }}>
            {stats.powerOutput}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            <Thermometer size={20} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Station Temp</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            {stats.temperature}
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            <Package size={20} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Next Supply</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {stats.nextSupply}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Block Cards Section */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '20px' }}>Block Status</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {MOCK_BLOCKS.map(block => (
              <div key={block.id} style={{
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                position: 'relative',
                background: 'var(--bg-panel-secondary)',
              }}>
                <div style={{ height: '120px', backgroundImage: `url(${block.img})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.8 }} />
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{block.name}</span>
                  {block.status === 'active' && <CheckCircle size={18} color="#10b981" />}
                  {block.status === 'inactive' && <Box size={18} color="var(--text-tertiary)" />}
                  {block.status === 'failure' && <AlertTriangle size={18} color="#ef4444" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Satellite Map Section */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '20px' }}>Satellite View</h2>
          <div style={{ 
            flex: 1, 
            borderRadius: '8px', 
            overflow: 'hidden',
            backgroundImage: 'url(https://images.unsplash.com/photo-1548266652-996b7dc444be?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '200px'
          }} />
        </div>
      </div>
    </div>
  );
}
