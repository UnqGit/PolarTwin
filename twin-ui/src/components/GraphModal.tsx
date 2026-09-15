import React, { useEffect, useRef, useState, useMemo, useContext } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { Maximize2, Minimize2, X, Target } from 'lucide-react';
import type { NodeLayout, ConnectionLayout, NodeInfo } from '../lib/layout';
import { TYPE_MATERIALS, GENERIC_MATERIAL } from '../lib/materials';
import { HoverContext } from './HoverContext';
import { useSelection } from './SelectionContext';
import { HoverCard } from './HoverCard';
import { PropertyInspector } from './PropertyInspector';
import { useTheme } from './ThemeContext';

cytoscape.use(fcose);

interface GraphModalProps {
  onClose: () => void;
  connections: ConnectionLayout[];
  allNodes: Map<string, NodeInfo>;
  root: NodeLayout;
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
}

function resolveColor(type: string): string {
  const t = (type || '').toLowerCase();
  for (const { match, mat } of TYPE_MATERIALS) {
    if (t.includes(match)) return mat.color;
  }
  return GENERIC_MATERIAL.color;
}

export const GraphModal: React.FC<GraphModalProps> = ({ onClose, connections, allNodes, root, liveStateRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [affectsRender, setAffectsRender] = useState(false);
  
  // Local hover/selection for cards inside the modal
  const [localHovered, setLocalHovered] = useState<string | null>(null);
  const [localSelected, setLocalSelected] = useState<string | null>(null);

  const { setHoveredName, hoveredName } = useContext(HoverContext);
  const { setSelectedName, selectedName } = useSelection();
  const { theme } = useTheme();

  // Elements memoization
  const elements = useMemo(() => {
    const els: cytoscape.ElementDefinition[] = [];
    
    // Add nodes
    allNodes.forEach((info, name) => {
      let depth = 0;
      let p: string | null | undefined = info.parentName;
      while (p && p !== name) {
        depth++;
        p = allNodes.get(p)?.parentName;
      }
      els.push({
        data: {
          id: name,
          parent: (info.parentName && info.parentName !== name) ? info.parentName : undefined,
          label: name,
          typeColor: resolveColor(info.type),
          depth
        } as cytoscape.NodeDataDefinition,
      });
    });

    // Add edges
    connections.forEach((c, idx) => {
      els.push({
        data: {
          id: `conn-${idx}-${c.source}-${c.target}`, // Ensuring uniqueness
          source: c.source,
          target: c.target,
          originalId: c.id,
        },
      });
    });

    return els;
  }, [allNodes, connections]);

  // Sync from main UI to graph (if changed outside)
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    
    cy.elements().removeClass('hovered').removeClass('selected');
    
    const effHovered = localHovered || hoveredName;
    if (effHovered) {
      cy.getElementById(effHovered).addClass('hovered');
      cy.edges().filter((e: any) => e.data('originalId') === effHovered).addClass('hovered');
    }
    
    const effSelected = localSelected || selectedName;
    if (effSelected) {
      cy.getElementById(effSelected).addClass('selected');
      cy.edges().filter((e: any) => e.data('originalId') === effSelected).addClass('selected');
    }
  }, [hoveredName, selectedName, localHovered, localSelected]);

  // Sync theme
  useEffect(() => {
    if (!cyRef.current) return;
    const depth0Color = theme === 'light' ? '#020617' : '#ffffff';
    const depth1Color = theme === 'light' ? '#1e293b' : '#f1f5f9';
    const depth2Color = theme === 'light' ? '#475569' : '#94a3b8';
    const depth3Color = theme === 'light' ? '#334155' : '#64748b';
    const outlineColor = theme === 'light' ? '#f8fafc' : '#0f172a';
    const edgeColor = theme === 'light' ? '#475569' : '#94a3b8';
    const outlineWidth = theme === 'light' ? 0 : 2;
    cyRef.current.style()
      .selector('node')
      .style({
        'text-outline-color': outlineColor,
        'text-outline-width': outlineWidth
      })
      .selector('node[depth = 0]')
      .style({ 'color': depth0Color })
      .selector('node[depth = 1]')
      .style({ 'color': depth1Color })
      .selector('node[depth = 2]')
      .style({ 'color': depth2Color })
      .selector('node[depth >= 3]')
      .style({ 'color': depth3Color })
      .selector('edge')
      .style({
        'line-color': edgeColor,
        'target-arrow-color': edgeColor
      })
      .update();
  }, [theme]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'background-color': 'data(typeColor)',
            'font-weight': 'normal',
            'font-family': 'Inter, sans-serif',
            'text-outline-color': theme === 'light' ? '#f8fafc' : '#0f172a',
            'text-outline-width': theme === 'light' ? 0 : 2,
            'text-margin-y': -5,
            'shape': 'round-rectangle',
            'padding': '15px'
          }
        },
        {
          selector: 'node[depth = 0]',
          style: { 'color': theme === 'light' ? '#020617' : '#ffffff' }
        },
        {
          selector: 'node[depth = 1]',
          style: { 'color': theme === 'light' ? '#1e293b' : '#f1f5f9' }
        },
        {
          selector: 'node[depth = 2]',
          style: { 'color': theme === 'light' ? '#475569' : '#94a3b8' }
        },
        {
          selector: 'node[depth >= 3]',
          style: { 'color': theme === 'light' ? '#334155' : '#64748b' }
        },
        {
          selector: ':parent',
          style: {
            'background-opacity': 0.1,
            'border-width': 2,
            'border-color': 'data(typeColor)',
            'padding': '20px', 
            'text-valign': 'top',
            'text-halign': 'center',
            'font-weight': 'bold',
            'text-outline-width': 0,
            'text-margin-y': -5
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': theme === 'light' ? '#475569' : '#94a3b8',
            'curve-style': 'straight',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': theme === 'light' ? '#475569' : '#94a3b8',
            'arrow-scale': 0.8,
            'opacity': 0.8
          }
        },
        // State classes
        {
          selector: '.hovered',
          style: {
            'border-width': 4,
            'border-color': '#fde047',
            'line-color': '#fde047',
            'target-arrow-color': '#fde047',
            'z-index': 10
          }
        },
        {
          selector: '.selected',
          style: {
            'border-width': 4,
            'border-color': '#f59e0b',
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'z-index': 20
          }
        }
      ],
      layout: {
        name: 'fcose',
        randomize: false,
        animate: false,
        nodeDimensionsIncludeLabels: true,
        quality: 'proof',
        packComponents: true,
      } as any,
    });

    cyRef.current = cy;

    // Parallel edge offset logic (post-layout)
    cy.on('layoutstop', () => {
      cy.fit();
      const initialZoom = cy.zoom();
      cy.minZoom(initialZoom / 3.5); // Cap zoom out to 3.5x the fitted graph size

      const edgeGroups: Record<string, cytoscape.EdgeSingular[]> = {};
      cy.edges().forEach((e: any) => {
        const s = e.source().id();
        const t = e.target().id();
        const key = [s, t].sort().join('::');
        if (!edgeGroups[key]) edgeGroups[key] = [];
        edgeGroups[key].push(e);
      });
      
      Object.values(edgeGroups).forEach(group => {
        if (group.length > 1) {
          const sNode = group[0].source();
          const tNode = group[0].target();
          const p1 = sNode.position();
          const p2 = tNode.position();
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx*dx + dy*dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          
          const spacing = 15; // px between parallel edges
          group.forEach((e, i) => {
            const offset = (i - (group.length - 1) / 2) * spacing;
            // set endpoint style for this edge
            e.style('source-endpoint', `${nx * offset}px ${ny * offset}px`);
            e.style('target-endpoint', `${nx * offset}px ${ny * offset}px`);
          });
        }
      });
    });

    // Interaction handling
    const handleMouseOver = (e: cytoscape.EventObject) => {
      const id = e.target.isEdge() ? e.target.data('originalId') : e.target.id();
      setLocalHovered(id);
      if (affectsRenderRef.current) setHoveredName(id);
    };

    const handleMouseOut = () => {
      setLocalHovered(null);
      if (affectsRenderRef.current) setHoveredName(null);
    };

    const handleTap = (e: cytoscape.EventObject) => {
      if (e.target === cy) {
        setLocalSelected(null);
        if (affectsRenderRef.current) setSelectedName(null);
      } else {
        const id = e.target.isEdge() ? e.target.data('originalId') : e.target.id();
        setLocalSelected(id);
        if (affectsRenderRef.current) setSelectedName(id);
      }
    };

    cy.on('mouseover', 'node, edge', handleMouseOver);
    cy.on('mouseout', 'node, edge', handleMouseOut);
    cy.on('tap', handleTap);

    // Inverse scaling for outer labels to maintain screen size when zooming out
    cy.on('zoom', () => {
      const z = cy.zoom();
      
      const calcFSize = (base: number, sMin: number, sMax: number, zHide: number) => {
        if (z < zHide) return 0.001; // Tiny font essentially hides it, avoids font-size: 0 issues
        const screen = base * z;
        const clamped = Math.min(Math.max(screen, sMin), sMax);
        return clamped / z;
      };

      cy.style()
        .selector('node[depth = 0]')
        .style({ 'font-size': `${calcFSize(120, 14, 24, 0.05)}px` })
        .selector('node[depth = 1]')
        .style({ 'font-size': `${calcFSize(80, 12, 18, 0.15)}px` })
        .selector('node[depth >= 2]')
        .style({ 'font-size': `${calcFSize(40, 10, 14, 0.25)}px` })
        .update();
    });

    const observer = new ResizeObserver(() => {
      if (cy) {
        cy.resize();
        cy.fit();
        const z = cy.zoom();
        cy.minZoom(z / 3.5);
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, setHoveredName, setSelectedName]);

  // Use a ref for affectsRender so it doesn't trigger effect re-run (avoid layout rebuilds)
  const affectsRenderRef = useRef(affectsRender);
  useEffect(() => { affectsRenderRef.current = affectsRender; }, [affectsRender]);

  // Dragging state
  const [position, setPosition] = useState({ x: window.innerWidth * 0.1, y: window.innerHeight * 0.1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isFullscreen) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (cyRef.current) cyRef.current.resize();
  };

  // Window styling
  const windowStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'var(--bg-main)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        position: 'fixed',
        top: position.y, left: position.x,
        width: '80vw', height: '80vh',
        minWidth: 400, minHeight: 300,
        backgroundColor: 'var(--bg-main)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-lg)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        resize: 'both',
        overflow: 'hidden',
      };

  const selectedNodeObj = localSelected ? (function findN(r: NodeLayout, n: string): NodeLayout | null {
    if (r.name === n) return r;
    for (const c of r.children) { const f = findN(c, n); if (f) return f; }
    return null;
  })(root, localSelected) : null;

  return (
    <div style={windowStyle}>
      {/* Header */}
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-panel-secondary)',
          cursor: isFullscreen ? 'default' : (isDragging ? 'grabbing' : 'grab'),
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>Topology</span>
          <label 
            onPointerDown={e => e.stopPropagation()} 
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          >
            <input 
              type="checkbox" 
              checked={affectsRender} 
              onChange={e => setAffectsRender(e.target.checked)} 
              style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
            />
            Affects Render
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button 
            onPointerDown={e => e.stopPropagation()}
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Graph Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        
        {/* Reset View Button */}
        <button
          onClick={() => {
            if (cyRef.current) {
              cyRef.current.fit();
              cyRef.current.minZoom(cyRef.current.zoom() / 3.5);
            }
          }}
          title="Reset View"
          style={{
            position: 'absolute', bottom: 16, right: 16,
            background: 'var(--bg-panel-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-color)', borderRadius: '50%',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: 'var(--shadow-md)',
            zIndex: 100
          }}
        >
          <Target size={18} />
        </button>
      </div>

      {/* Local Overlays (Hover / Selection Cards) */}
      {localHovered && (
        <div style={{ position: 'absolute', top: 60, right: 16, pointerEvents: 'none', zIndex: 100 }}>
          <HoverCard root={root} connections={connections} liveStateRef={liveStateRef} explicitName={localHovered} />
        </div>
      )}

      {localSelected && (
        <div style={{ position: 'absolute', top: 60, left: 16, display: 'flex', flexDirection: 'column', gap: 16, zIndex: 100, pointerEvents: 'none', maxHeight: 'calc(100% - 76px)' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <HoverCard root={root} connections={connections} liveStateRef={liveStateRef} explicitName={localSelected} />
          </div>
          {selectedNodeObj && (
            <div style={{ pointerEvents: 'auto', width: 'max-content', minWidth: 300, maxWidth: '40vw', overflowY: 'auto', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <PropertyInspector node={selectedNodeObj} connections={connections} liveStateRef={liveStateRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
