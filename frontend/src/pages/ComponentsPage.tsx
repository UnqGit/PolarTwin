import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStation } from '../components/StationContext';
import {
  ChevronRight, Info, Box, Layers, Activity, Search, X
} from 'lucide-react';
import { PropertyInspector } from '../components/PropertyInspector';
import { buildSceneLayout } from '../lib/layout';
import { IMAGE_MAP } from '../lib/constants';
import { Footer } from '../components/Footer';

const ANIM_STYLE = `
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .comp-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .comp-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg), var(--shadow-glow); border-color: rgba(99,219,188,0.25); }
  .comp-img { transition: transform 0.5s ease; }
  .comp-card:hover .comp-img { transform: scale(1.05); }
`;

export function ComponentsPage() {
  const { selectedStation, hierarchy: hierarchyData, spec, connections, liveStateRef } = useStation();
  const location = useLocation();
  const [drillStack, setDrillStack] = useState<string[]>(location.state?.drillStack || []);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const [inspectNodeName, setInspectNodeName] = useState<string | null>(location.state?.inspectNodeName || null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (location.state?.drillStack) setDrillStack(location.state.drillStack);
    if (location.state?.inspectNodeName) setInspectNodeName(location.state.inspectNodeName);
  }, [location.state]);

  const currentParentName = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  const displayedNodes = useMemo(() => {
    if (!hierarchyData || hierarchyData.length === 0) return [];
    let nodes;
    if (currentParentName === null) {
      const allNames = new Set(hierarchyData.map((n: any) => n.name));
      nodes = hierarchyData.filter((n: any) => !n.parent || !allNames.has(n.parent));
    } else {
      const parentNode = hierarchyData.find((n: any) => n.name === currentParentName);
      if (!parentNode?.children) return [];
      nodes = hierarchyData.filter((n: any) => parentNode.children.includes(n.name));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter((n: any) =>
        n.name.toLowerCase().includes(q) || (n.type || '').toLowerCase().includes(q)
      );
    }
    return nodes;
  }, [hierarchyData, currentParentName, searchQuery]);

  const transition = (fn: () => void) => {
    setFadeState('out');
    setTimeout(() => { fn(); setFadeState('in'); }, 200);
  };

  const handleDrillDown = (nodeName: string) => {
    const node = hierarchyData.find((n: any) => n.name === nodeName);
    if (!node?.children?.length) return;
    transition(() => { setInspectNodeName(null); setDrillStack(prev => [...prev, nodeName]); });
  };

  const handleCrumbClick = (index: number) =>
    transition(() => { setInspectNodeName(null); setDrillStack(prev => prev.slice(0, index + 1)); });

  const handleRootClick = () =>
    transition(() => { setInspectNodeName(null); setDrillStack([]); });

  if (!selectedStation) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <p style={{ color: 'var(--text-secondary)' }}>No station selected.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', color: 'var(--text-primary)' }}>
      <style>{ANIM_STYLE}</style>

      {/* Main scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '28px 36px', flex: 1 }}>

          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 5px 0', letterSpacing: '-0.03em' }}>
                Component Library
              </h1>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>
                Explore and inspect subsystem components
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)', pointerEvents: 'none'
                }} />
                <input
                  type="text"
                  placeholder="Search components..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 32, paddingRight: searchQuery ? 28 : 12, width: 200 }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-tertiary)', padding: 2,
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {/* Count badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                background: 'rgba(99,219,188,0.08)',
                border: '1px solid rgba(99,219,188,0.2)',
                borderRadius: 'var(--radius-full)',
                fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)'
              }}>
                <Layers size={13} />
                {displayedNodes.length} Items
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="glass-panel breadcrumb" style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 24,
            width: 'max-content',
            maxWidth: '100%',
            flexWrap: 'wrap',
          }}>
            <span
              className={`breadcrumb-item${drillStack.length === 0 ? ' active' : ''}`}
              onClick={handleRootClick}
            >
              {selectedStation}
            </span>
            {drillStack.map((crumb, idx) => {
              const isLast = idx === drillStack.length - 1;
              return (
                <span key={crumb} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChevronRight size={13} className="breadcrumb-sep" />
                  <span
                    className={`breadcrumb-item${isLast ? ' active' : ''}`}
                    onClick={() => !isLast && handleCrumbClick(idx)}
                  >
                    {crumb}
                  </span>
                </span>
              );
            })}
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 20,
            opacity: fadeState === 'in' ? 1 : 0,
            transition: 'opacity 0.2s ease',
            paddingBottom: 40,
          }}>
            {displayedNodes.map((node: any, i: number) => {
              const isContainer = node.children?.length > 0;
              const imgArr = IMAGE_MAP[node.type] || IMAGE_MAP.default;
              const imgSrc = imgArr[Math.abs(node.name.split('').reduce((a: number, b: string) => {
                a = ((a << 5) - a) + b.charCodeAt(0); return a;
              }, 0)) % imgArr.length];

              return (
                <div
                  key={node.name}
                  className="glass-panel comp-card"
                  onClick={() => isContainer && handleDrillDown(node.name)}
                  style={{
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    cursor: isContainer ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: node.name === inspectNodeName
                      ? '0 0 0 2px var(--accent-primary), var(--shadow-glow)'
                      : 'var(--shadow-sm)',
                    animation: `cardIn 0.45s cubic-bezier(0.4,0,0.2,1) ${i * 0.04}s both`,
                    border: node.name === inspectNodeName
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-color)',
                  }}
                >
                  {/* Image */}
                  <div style={{ height: 150, position: 'relative', overflow: 'hidden', background: 'var(--bg-panel-secondary)' }}>
                    <div
                      className="comp-img"
                      style={{
                        width: '100%', height: '100%',
                        backgroundImage: `url(${imgSrc})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                      }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(6,8,18,0.88) 0%, rgba(6,8,18,0.1) 60%, transparent 100%)',
                    }} />
                    {/* Status badge */}
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '3px 9px', borderRadius: 'var(--radius-full)',
                      background: 'rgba(74,222,128,0.15)',
                      border: '1px solid rgba(74,222,128,0.3)',
                      backdropFilter: 'blur(8px)',
                      fontSize: 10, fontWeight: 700,
                      color: 'var(--status-active)',
                      letterSpacing: '0.06em',
                    }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'currentColor', animation: 'pulseDot 2.5s infinite'
                      }} />
                      ACTIVE
                    </div>
                    {isContainer && (
                      <div style={{
                        position: 'absolute', bottom: 10, right: 10,
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 9px', borderRadius: 'var(--radius-full)',
                        background: 'rgba(99,219,188,0.12)',
                        border: '1px solid rgba(99,219,188,0.2)',
                        backdropFilter: 'blur(8px)',
                        fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)',
                      }}>
                        {node.children.length} items inside
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={{
                    padding: '16px 18px',
                    display: 'flex', flexDirection: 'column', gap: 10, flex: 1,
                    background: 'var(--bg-panel-solid)',
                  }}>
                    <div>
                      <h3 style={{
                        fontSize: 15, fontWeight: 700, margin: '0 0 4px 0',
                        color: 'var(--text-primary)', letterSpacing: '-0.02em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {node.name}
                      </h3>
                      <div style={{
                        fontSize: 11, color: 'var(--accent-amber)',
                        textTransform: 'uppercase', fontWeight: 700,
                        letterSpacing: '0.06em',
                      }}>
                        {node.type || 'Component'}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      paddingTop: 10, borderTop: '1px solid var(--border-color)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 12, color: 'var(--text-secondary)',
                      }}>
                        <Activity size={12} style={{ color: 'var(--status-active)' }} />
                        Operational
                      </div>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={(e) => { e.stopPropagation(); setInspectNodeName(node.name); }}
                        className="btn btn-sm btn-secondary"
                        style={{ gap: 5, fontSize: 11 }}
                      >
                        <Info size={12} /> Inspect
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {displayedNodes.length === 0 && (
            <div className="glass-panel empty-state">
              <Box size={40} className="empty-state-icon" />
              <span className="empty-state-title">No components found</span>
              <span className="empty-state-desc">
                {searchQuery ? `No results for "${searchQuery}"` : 'This directory is empty or could not be loaded.'}
              </span>
            </div>
          )}
        </div>
        <Footer />
      </div>

      {/* Inspector panel */}
      {inspectNodeName && hierarchyData && (
        <div
          className="slide-in-right"
          style={{
            width: 380, flexShrink: 0,
            background: 'var(--bg-panel-solid)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
            zIndex: 10,
          }}
        >
          {/* Inspector header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
            background: 'rgba(99,219,188,0.03)',
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Inspector</h3>
              <div style={{
                fontSize: 11, color: 'var(--accent-primary)',
                marginTop: 3, fontWeight: 600, letterSpacing: '0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 260,
              }}>
                {inspectNodeName}
              </div>
            </div>
            <button
              onClick={() => setInspectNodeName(null)}
              className="btn-icon"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {(() => {
              try {
                const layout = buildSceneLayout(hierarchyData, connections || [], spec || { components: {}, globals: {} });
                const node = layout.allNodes.get(inspectNodeName);
                if (node) {
                  return <PropertyInspector node={node as any} connections={layout.connections} liveStateRef={liveStateRef || { current: {} }} flat={true} />;
                }
              } catch (e) {
                console.error(e);
              }
              return <div style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>Failed to load inspector for {inspectNodeName}.</div>;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
