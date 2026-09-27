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

function SubGrid({ allBlocks, title }: { allBlocks: BlockData[], title: string }) {
  const [active, setActive] = useState<number[]>([]);
  const [fading, setFading] = useState<number | null>(null);

  useEffect(() => {
    if (allBlocks.length === 0) return;
    const count = Math.min(4, allBlocks.length);
    const initial: number[] = [];
    const available = Array.from({length: allBlocks.length}, (_, i) => i);
    for (let i = 0; i < count; i++) {
      if (available.length === 0) break;
      const rnd = Math.floor(Math.random() * available.length);
      initial.push(available.splice(rnd, 1)[0]);
    }
    setActive(initial);
  }, [allBlocks]);

  useEffect(() => {
    if (allBlocks.length <= active.length || active.length === 0) return;
    
    const intervalTime = 3000 + Math.random() * 3000;
    
    const interval = setInterval(() => {
      const replacePos = Math.floor(Math.random() * active.length);
      setFading(replacePos);

      setTimeout(() => {
        setActive(prev => {
          const next = [...prev];
          const available = Array.from({length: allBlocks.length}, (_, i) => i).filter(i => !next.includes(i));
          if (available.length > 0) {
            const rnd = Math.floor(Math.random() * available.length);
            next[replacePos] = available[rnd];
          }
          return next;
        });
        setFading(null);
      }, 500);
    }, intervalTime);
    
    return () => clearInterval(interval);
  }, [allBlocks, active.length]);

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: 'var(--text-secondary)' }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
        {active.map((idx, i) => {
          const block = allBlocks[idx];
          return (
            <div key={i} style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              position: 'relative',
              aspectRatio: '1',
              opacity: fading === i ? 0 : 1,
              transition: 'opacity 0.5s ease-in-out',
            }}>
              <div style={{ width: '100%', height: '100%', backgroundImage: `url(${block.img})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.8 }} />
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                background: 'rgba(0,0,0,0.7)', 
                backdropFilter: 'blur(4px)',
                padding: '8px 10px', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{block.name}</span>
                {block.status === 'active' && <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />}
                {block.status === 'inactive' && <Box size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />}
                {block.status === 'failure' && <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

  const numGrids = useMemo(() => {
    return Math.max(1, Math.floor(Math.log2(blocks.length || 1)));
  }, [blocks.length]);

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0' }}>{selectedStation || 'Loading...'} Overview</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>System status and high-level telemetry</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '20px' }}>Featured Components</h2>
        {blocks.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numGrids}, 1fr)`, gap: '24px' }}>
            {Array.from({ length: numGrids }).map((_, i) => (
              <SubGrid key={i} allBlocks={blocks} title={`Sub-section ${i + 1}`} />
            ))}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '24px', color: 'var(--text-secondary)' }}>
            No components available.
          </div>
        )}
      </div>
    </div>
  );
}
