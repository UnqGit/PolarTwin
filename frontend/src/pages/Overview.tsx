import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStation } from '../components/StationContext';
import { Activity, Thermometer, Zap, Box, AlertTriangle, CheckCircle, Package, Radar } from 'lucide-react';

export interface BlockData {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'failure';
  img: string;
  innerTotal: number;
  innerActive: number;
  path: string[];
}

const STYLE_INJECTION = `
  @keyframes scanline {
    0% { transform: translateY(-100%); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 20px currentColor; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .metric-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .metric-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 230, 118, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
  }
  .grid-card-inner {
    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), filter 0.8s ease;
  }
  .grid-card:hover .grid-card-inner {
    transform: scale(1.08);
  }
  .fade-enter {
    animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .overview-container::-webkit-scrollbar {
    display: none;
  }
  .overview-container {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

function GridCard({ block, fading, onClick }: { block: BlockData; fading: boolean; onClick: () => void }) {
  if (!block) return null;

  return (
    <div className="grid-card glass-panel" onClick={onClick} style={{
      borderRadius: '16px',
      overflow: 'hidden',
      position: 'relative',
      aspectRatio: '1',
      cursor: 'pointer',
      boxShadow: 'var(--shadow-md)',
      padding: 0,
      border: '1px solid var(--border-color)',
      transition: 'opacity 0.6s ease',
      opacity: fading ? 0 : 1
    }}>
      <div 
        className="grid-card-inner"
        style={{ 
          width: '100%', 
          height: '100%', 
          backgroundImage: `url(${block.img})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          opacity: 0.85,
        }} 
      />
      <div style={{ 
        padding: '24px', 
        position: 'absolute', 
        bottom: 0, left: 0, right: 0, 
        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '18px', color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.8)', lineHeight: 1.2, flex: 1, paddingRight: '8px' }}>
            {block.name}
          </span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '13px', fontWeight: 600 }}>
            {block.status === 'active' && (
              <><CheckCircle size={14} color="var(--accent-blue)" style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,118,0.4))' }} /> <span style={{ color: 'var(--accent-blue)' }}>ACTIVE</span></>
            )}
            {block.status === 'inactive' && (
              <><Box size={14} color="var(--text-tertiary)" /> <span style={{ color: 'var(--text-secondary)' }}>INACTIVE</span></>
            )}
            {block.status === 'failure' && (
              <><AlertTriangle size={14} color="#ef4444" style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.4))' }} /> <span style={{ color: '#ef4444' }}>FAILURE</span></>
            )}
          </div>
          
          {block.innerTotal > 0 && (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-tertiary)' }} />
              <span>{block.innerActive} / {block.innerTotal} Active nested nodes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Overview() {
  const { selectedStation, hierarchy, liveStateRef } = useStation();
  const navigate = useNavigate();
  
  const [telemetry] = useState({
    powerOutput: 'N/A',
    temperature: 'N/A',
    nextSupply: 'N/A'
  });

  const hierarchyData = hierarchy || [];

  const stats = useMemo(() => {
    const totalComponents = hierarchyData.length;
    const activeComponents = totalComponents; 
    return {
      activeComponents,
      totalComponents,
      ...telemetry
    };
  }, [hierarchyData, telemetry]);

  const blocks = useMemo(() => {
    // Build parent map to quickly get paths
    const parentMap = new Map<string, string>();
    hierarchyData.forEach((n: any) => {
      if (n.children) {
        n.children.forEach((c: string) => parentMap.set(c, n.name));
      }
    });
    
    const getPath = (name: string) => {
      const path = [];
      let curr: string | undefined = parentMap.get(name);
      while (curr) {
        path.unshift(curr);
        curr = parentMap.get(curr);
      }
      return path;
    };

    const blockNodes = hierarchyData.filter((n: any) => n.type !== 'station');
    return blockNodes.map((b: any, i: number) => {
      const allDescendants = new Set<string>();
      const queue = [...(b.children || [])];
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr && !allDescendants.has(curr)) {
          allDescendants.add(curr);
          const node = hierarchyData.find((n: any) => n.name === curr);
          if (node && node.children) queue.push(...node.children);
        }
      }
      
      const imgs = [
        'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1544256718-3b6102796440?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
      ];

      // Extract real status if available
      let status: 'active' | 'inactive' | 'failure' = 'active';
      if (liveStateRef?.current?.[b.name]) {
        const compState: any = liveStateRef.current[b.name];
        if (compState.status === 'failure') status = 'failure';
        else if (compState.status === 'inactive') status = 'inactive';
      }

      return {
        id: b.name,
        name: b.name,
        status, 
        img: imgs[i % imgs.length],
        innerTotal: allDescendants.size,
        innerActive: allDescendants.size,
        path: getPath(b.name)
      };
    });
  }, [hierarchyData, liveStateRef]);

  const numGrids = useMemo(() => {
    return Math.max(1, Math.floor(Math.log2(blocks.length || 1)));
  }, [blocks.length]);

  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const [isFading, setIsFading] = useState(false);

  // Initialize random indices
  useEffect(() => {
    if (blocks.length === 0) return;
    const initial: number[] = [];
    for (let i = 0; i < numGrids; i++) {
      initial.push(Math.floor(Math.random() * blocks.length));
    }
    setActiveIndices(initial);
  }, [blocks.length, numGrids]);

  // Synchronized rotation
  useEffect(() => {
    if (blocks.length <= numGrids) return; // Not enough blocks to rotate
    
    const intervalTime = 6000; // Rotate every 6s
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        // Pick new random indices
        setActiveIndices(prev => {
          return prev.map(() => Math.floor(Math.random() * blocks.length));
        });
        setIsFading(false);
      }, 600); // 600ms fade out before swapping
    }, intervalTime);

    return () => clearInterval(timer);
  }, [blocks.length, numGrids]);

  const handleCardClick = (block: BlockData) => {
    if (!selectedStation) return;
    navigate(`/${selectedStation}/components`, {
      state: {
        drillStack: block.path,
        inspectNodeName: block.name
      }
    });
  };

  return (
    <div className="overview-container fade-enter" style={{ padding: '32px 40px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <style>{STYLE_INJECTION}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>{selectedStation || 'Loading...'} Overview</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>System status and high-level telemetry</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '28px', marginBottom: '40px' }}>
        {/* Satellite View */}
        <div className="glass-panel" style={{ 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          position: 'relative', 
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
          minHeight: '340px'
        }}>
          <div style={{ padding: '24px 32px', position: 'absolute', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Radar size={22} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '0.5px' }}>Satellite View</h2>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Live spatial telemetry feed</p>
          </div>
          
          <div style={{ 
            flex: 1, 
            backgroundImage: 'url(https://images.unsplash.com/photo-1548266652-996b7dc444be?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative'
          }}>
             <div style={{
               position: 'absolute',
               top: 0, left: 0, right: 0, height: '100%',
               background: 'linear-gradient(to bottom, transparent 0%, rgba(181, 102, 255, 0.1) 50%, rgba(0, 230, 118, 0.2) 100%)',
               animation: 'scanline 5s linear infinite'
             }} />
             
             <div style={{ position: 'absolute', top: '35%', left: '28%', color: 'var(--accent-cyan)' }}>
               <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 2.5s infinite' }} />
             </div>
             <div style={{ position: 'absolute', top: '65%', left: '72%', color: 'var(--accent-blue)' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 3s infinite 1s' }} />
             </div>
             <div style={{ position: 'absolute', top: '45%', left: '60%', color: 'var(--accent-amber)' }}>
               <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 4s infinite 0.5s' }} />
             </div>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
              <Activity size={24} color="var(--accent-blue)" />
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Components</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, marginTop: '16px', letterSpacing: '-1px' }}>
              <span style={{ color: '#fff' }}>{stats.activeComponents}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '20px', fontWeight: 600 }}> / {stats.totalComponents}</span>
            </div>
          </div>

          <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
              <Zap size={24} color="var(--accent-amber)" />
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Power</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '16px', color: '#fff' }}>
              {stats.powerOutput}
            </div>
          </div>

          <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
              <Thermometer size={24} color="var(--accent-cyan)" />
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Temp</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '16px', color: '#fff' }}>
              {stats.temperature}
            </div>
          </div>
          
          <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
              <Package size={24} color="var(--text-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Supply</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '16px', color: '#fff' }}>
              {stats.nextSupply}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Component Matrix</h2>
        </div>
        
        {blocks.length > 0 && activeIndices.length === numGrids ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', paddingBottom: '32px' }}>
            {activeIndices.map((blockIdx, i) => (
              <div className="fade-enter" style={{ animationDelay: `${i * 0.08}s` }} key={i}>
                <GridCard 
                  block={blocks[blockIdx]} 
                  fading={isFading} 
                  onClick={() => handleCardClick(blocks[blockIdx])}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '16px' }}>
            No components available in the matrix.
          </div>
        )}
      </div>
    </div>
  );
}
