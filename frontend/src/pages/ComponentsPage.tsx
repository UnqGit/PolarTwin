import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStation } from '../components/StationContext';
import { ChevronRight, Zap, Info, Box, Layers, Activity } from 'lucide-react';
import { PropertyInspector } from '../components/PropertyInspector';
import { buildSceneLayout } from '../lib/layout';
import { IMAGE_MAP } from '../lib/constants';
import { Footer } from '../components/Footer';

const STYLE_INJECTION = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .card-hover {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card-hover:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 230, 118, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .image-zoom {
    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card-hover:hover .image-zoom {
    transform: scale(1.08);
  }
  .glass-btn {
    transition: all 0.2s ease;
  }
  .glass-btn:hover {
    background: var(--accent-blue);
    color: #000;
    border-color: var(--accent-blue);
    box-shadow: 0 0 15px rgba(0, 230, 118, 0.3);
  }
  .breadcrumb-item {
    transition: all 0.2s;
  }
  .breadcrumb-item:hover {
    color: var(--accent-blue);
    text-shadow: 0 0 8px rgba(0,230,118,0.4);
  }
  .page-container::-webkit-scrollbar {
    display: none;
  }
  .page-container {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

export function ComponentsPage() {
  const { selectedStation, hierarchy: hierarchyData, spec, connections, liveStateRef } = useStation();
  const location = useLocation();
  const [drillStack, setDrillStack] = useState<string[]>(location.state?.drillStack || []);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const [inspectNodeName, setInspectNodeName] = useState<string | null>(location.state?.inspectNodeName || null);

  // When location.state changes (e.g. user clicks a card in Overview again)
  useEffect(() => {
    if (location.state?.drillStack) {
      setDrillStack(location.state.drillStack);
    }
    if (location.state?.inspectNodeName) {
      setInspectNodeName(location.state.inspectNodeName);
    }
  }, [location.state]);

  const currentParentName = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  const displayedNodes = useMemo(() => {
    if (!hierarchyData || hierarchyData.length === 0) return [];

    if (currentParentName === null) {
      const allNames = new Set(hierarchyData.map((n: any) => n.name));
      return hierarchyData.filter((n: any) => !n.parent || !allNames.has(n.parent));
    } else {
      const parentNode = hierarchyData.find((n: any) => n.name === currentParentName);
      if (!parentNode || !parentNode.children) return [];
      return hierarchyData.filter((n: any) => parentNode.children.includes(n.name));
    }
  }, [hierarchyData, currentParentName]);

  const handleDrillDown = (nodeName: string) => {
    const node = hierarchyData.find((n: any) => n.name === nodeName);
    if (!node || !node.children || node.children.length === 0) return;

    setFadeState('out');
    setTimeout(() => {
      setInspectNodeName(null);
      setDrillStack(prev => [...prev, nodeName]);
      setFadeState('in');
    }, 250);
  };

  const handleCrumbClick = (index: number) => {
    setFadeState('out');
    setTimeout(() => {
      setInspectNodeName(null);
      setDrillStack(prev => prev.slice(0, index + 1));
      setFadeState('in');
    }, 250);
  };

  const handleRootClick = () => {
    setFadeState('out');
    setTimeout(() => {
      setInspectNodeName(null);
      setDrillStack([]);
      setFadeState('in');
    }, 250);
  };

  if (!selectedStation) {
    return <div style={{ color: 'white', padding: 24 }}>No station selected.</div>;
  }

  return (
    <div className="page-container" style={{ display: 'flex', height: '100%', overflow: 'hidden', color: 'var(--text-primary)' }}>
      <style>{STYLE_INJECTION}</style>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '32px 48px', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Component Library</h1>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>Explore and inspect subsystem components</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--accent-cyan)', padding: '8px 16px', background: 'rgba(181, 102, 255, 0.1)', borderRadius: '20px', border: '1px solid rgba(181, 102, 255, 0.2)' }}>
              <Layers size={16} />
              {displayedNodes.length} Items
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="glass-panel" style={{ padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, fontSize: 14, color: 'var(--text-secondary)', width: 'max-content' }}>
            <div
              onClick={handleRootClick}
              style={{ cursor: 'pointer', fontWeight: drillStack.length === 0 ? 600 : 400, color: drillStack.length === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              className="breadcrumb-item"
            >
              {selectedStation}
            </div>

            {drillStack.map((crumb, idx) => {
              const isLast = idx === drillStack.length - 1;
              return (
                <div key={crumb} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChevronRight size={14} color="var(--text-tertiary)" />
                  <div
                    onClick={() => !isLast && handleCrumbClick(idx)}
                    style={{ cursor: isLast ? 'default' : 'pointer', fontWeight: isLast ? 600 : 400, color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    className={!isLast ? "breadcrumb-item" : ""}
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
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24,
              opacity: fadeState === 'in' ? 1 : 0, transition: 'opacity 0.25s ease-in-out',
              paddingBottom: '40px'
            }}
          >
            {displayedNodes.map((node: any, i: number) => {
              const isContainer = node.children && node.children.length > 0;
              const img = IMAGE_MAP[node.type] || IMAGE_MAP.default;
              return (
                <div
                  key={node.name}
                  className="glass-panel card-hover"
                  onClick={() => isContainer && handleDrillDown(node.name)}
                  style={{
                    borderRadius: 16, overflow: 'hidden', cursor: isContainer ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column',
                    animation: fadeState === 'in' ? `fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards ${i * 0.05}s` : 'none',
                    opacity: fadeState === 'in' ? 0 : 1,
                    boxShadow: node.name === inspectNodeName ? '0 0 0 2px var(--accent-blue)' : 'none'
                  }}
                >
                  <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
                    <div className="image-zoom" style={{ width: '100%', height: '100%', backgroundImage: `url(${img[Math.abs(node.name.split('').reduce((a: number, b: string) => { a = ((a << 5) - a) + b.charCodeAt(0); return a }, 0)) % img.length]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />
                    <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', backdropFilter: 'blur(8px)', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 8px currentColor' }} />
                      ACTIVE
                    </div>
                  </div>
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, background: 'var(--bg-panel-solid)' }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{node.name}</h3>
                      <div style={{ fontSize: 12, color: 'var(--accent-amber)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginTop: 6 }}>
                        {node.type} {isContainer ? `· ${node.children.length} items` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <Activity size={14} color="var(--accent-blue)" />
                        Operational
                      </div>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectNodeName(node.name);
                        }}
                        className="glass-btn"
                        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
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
            <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 48px', color: 'var(--text-tertiary)', borderRadius: 16 }}>
              <Box size={48} style={{ margin: '0 auto', opacity: 0.2, marginBottom: 16 }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)' }}>No components found</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: 14 }}>This directory is empty or could not be loaded.</p>
            </div>
          )}
        </div>
        <Footer />
      </div>

      {inspectNodeName && hierarchyData && (
        <div style={{
          width: 420, flexShrink: 0,
          background: 'var(--bg-panel-solid)', borderLeft: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 10
        }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--bg-panel)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Inspector</h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{inspectNodeName}</div>
            </div>
            <button onClick={() => setInspectNodeName(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 24, padding: '4px 8px', borderRadius: '4px' }} className="hover:bg-[var(--hover-overlay)] transition-colors">&times;</button>
          </div>
          {(() => {
            try {
              const layout = buildSceneLayout(hierarchyData, connections || [], spec || { components: {}, globals: {} });
              const node = layout.allNodes.get(inspectNodeName);
              if (node) {
                return (
                  <div className="page-container" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    <PropertyInspector node={node} connections={layout.connections} liveStateRef={liveStateRef || { current: {} }} flat={true} />
                  </div>
                );
              }
            } catch (e) {
              console.error(e);
            }
            return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Failed to load inspector for {inspectNodeName}.</div>;
          })()}
        </div>
      )}
    </div>
  );
}
