import { useEffect, useState, useMemo } from 'react';
import { useStation } from '../components/StationContext';
import { Activity, Thermometer, Zap, Box, AlertTriangle, CheckCircle, Package } from 'lucide-react';

export interface BlockData {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'failure';
  img: string;
  innerTotal: number;
  innerActive: number;
}

export function Overview() {
  const { selectedStation, hierarchy } = useStation();
  
  // Real implementation would fetch telemetry from /simulations/{runId}/state
  // Since telemetry integration (Phase 12-15) is incomplete, we show fallback values for telemetry.
  const [telemetry] = useState({
    powerOutput: 'N/A',
    temperature: 'N/A',
    nextSupply: 'N/A'
  });

  const hierarchyData = hierarchy || [];

  const stats = useMemo(() => {
    const totalComponents = hierarchyData.length;
    // Mock active components until telemetry is wired up
    const activeComponents = totalComponents; 
    return {
      activeComponents,
      totalComponents,
      ...telemetry
    };
  }, [hierarchyData, telemetry]);

  const blocks = useMemo(() => {
    const blockNodes = hierarchyData.filter(n => n.type === 'block');
    return blockNodes.map((b, i) => {
      // Calculate inner components using the children hierarchy
      const allDescendants = new Set<string>();
      const queue = [...(b.children || [])];
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr && !allDescendants.has(curr)) {
          allDescendants.add(curr);
          const node = hierarchyData.find(n => n.name === curr);
          if (node && node.children) queue.push(...node.children);
        }
      }
      
      const imgs = [
        'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1544256718-3b6102796440?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'
      ];

      return {
        id: b.name,
        name: b.name,
        status: 'active' as BlockData['status'], // Mock until telemetry
        img: imgs[i % imgs.length],
        innerTotal: allDescendants.size,
        innerActive: allDescendants.size // Mock until telemetry
      };
    });
  }, [hierarchyData]);

  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (blocks.length <= 1) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * blocks.length);
        } while (nextIdx === activeBlockIdx);
        setActiveBlockIdx(nextIdx);
        setFade(true);
      }, 500); // Wait for fade out
    }, 4000); // Rotate every 4 seconds
    return () => clearInterval(interval);
  }, [blocks, activeBlockIdx]);

  const currentBlock = blocks[activeBlockIdx];

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0' }}>{selectedStation || 'Loading...'} Overview</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>System status and high-level telemetry</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '20px' }}>Featured Block</h2>
          {currentBlock ? (
            <div style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              position: 'relative',
              background: 'var(--bg-panel-secondary)',
              opacity: fade ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out',
            }}>
              <div style={{ height: '180px', backgroundImage: `url(${currentBlock.img})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.8 }} />
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '18px' }}>{currentBlock.name}</span>
                  {currentBlock.status === 'active' && <CheckCircle size={20} color="#10b981" />}
                  {currentBlock.status === 'inactive' && <Box size={20} color="var(--text-tertiary)" />}
                  {currentBlock.status === 'failure' && <AlertTriangle size={20} color="#ef4444" />}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Inner Components: {currentBlock.innerActive} / {currentBlock.innerTotal}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>No blocks available.</div>
          )}
        </div>

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
