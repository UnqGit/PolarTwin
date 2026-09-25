import { useState, useMemo } from 'react';
import { useStation } from '../components/StationContext';
import { ChevronRight, Zap, Info, Box } from 'lucide-react';

const FALLBACK_IMGS = [
  'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1483664852095-d6cc68707022?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
];

export function ComponentsPage() {
  const { selectedStation, hierarchy: hierarchyData } = useStation();

  // The drill-down stack contains the names of the nodes we've navigated into.
  // Initially empty, meaning we are at the outermost level.
  const [drillStack, setDrillStack] = useState<string[]>([]);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

  const currentParentName = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  // Compute the items to display based on the current parent
  const displayedNodes = useMemo(() => {
    if (!hierarchyData || hierarchyData.length === 0) return [];
    
    if (currentParentName === null) {
      // Find outermost nodes (nodes that have no parent, or their parent is not in the list)
      const allNames = new Set(hierarchyData.map(n => n.name));
      return hierarchyData.filter(n => !n.parent || !allNames.has(n.parent));
    } else {
      // Find children of the current parent
      const parentNode = hierarchyData.find(n => n.name === currentParentName);
      if (!parentNode || !parentNode.children) return [];
      return hierarchyData.filter(n => parentNode.children.includes(n.name));
    }
  }, [hierarchyData, currentParentName]);

  const handleDrillDown = (nodeName: string) => {
    const node = hierarchyData.find(n => n.name === nodeName);
    if (!node || !node.children || node.children.length === 0) return; // Cannot drill into leaf nodes
    
    setFadeState('out');
    setTimeout(() => {
      setDrillStack(prev => [...prev, nodeName]);
      setFadeState('in');
    }, 200);
  };

  const handleCrumbClick = (index: number) => {
    setFadeState('out');
    setTimeout(() => {
      setDrillStack(prev => prev.slice(0, index + 1));
      setFadeState('in');
    }, 200);
  };

  const handleRootClick = () => {
    setFadeState('out');
    setTimeout(() => {
      setDrillStack([]);
      setFadeState('in');
    }, 200);
  };

  if (!selectedStation) {
    return <div style={{ color: 'white', padding: 24 }}>No station selected.</div>;
  }

  return (
    <div style={{ padding: '32px 48px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Components</h1>
      
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
        <div 
          onClick={handleRootClick} 
          style={{ cursor: 'pointer', color: drillStack.length === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          className="hover:text-[var(--accent-blue)] transition-colors"
        >
          {selectedStation}
        </div>
        
        {drillStack.map((crumb, idx) => {
          const isLast = idx === drillStack.length - 1;
          return (
            <div key={crumb} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChevronRight size={14} />
              <div 
                onClick={() => !isLast && handleCrumbClick(idx)}
                style={{ cursor: isLast ? 'default' : 'pointer', color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                className={!isLast ? "hover:text-[var(--accent-blue)] transition-colors" : ""}
              >
                {crumb}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div 
        style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24,
          opacity: fadeState === 'in' ? 1 : 0, transition: 'opacity 0.2s ease-in-out' 
        }}
      >
        {displayedNodes.map((node, i) => {
          const isContainer = node.children && node.children.length > 0;
          const img = FALLBACK_IMGS[i % FALLBACK_IMGS.length];
          return (
            <div 
              key={node.name}
              className="glass-panel"
              onClick={() => isContainer && handleDrillDown(node.name)}
              style={{
                borderRadius: 12, overflow: 'hidden', cursor: isContainer ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex', flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                if (isContainer) {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (isContainer) {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <div style={{ height: 140, backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                  ACTIVE
                </div>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{node.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                    {node.type} {isContainer ? `· ${node.children.length} items` : ''}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Zap size={14} className="text-[var(--accent-yellow)]" />
                    N/A W
                  </div>
                  <div style={{ flex: 1 }} />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(`Inspector for ${node.name} (Coming soon when integrated with RightUIStack)`);
                    }}
                    style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    className="hover:bg-[var(--accent-blue)] hover:border-[var(--accent-blue)] transition-colors"
                  >
                    <Info size={14} />
                    Inspect
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {displayedNodes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
          <Box size={48} style={{ margin: '0 auto', opacity: 0.2, marginBottom: 16 }} />
          No components found in this view.
        </div>
      )}
    </div>
  );
}
