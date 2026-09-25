import React, { useEffect, useRef, useState, useMemo } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { Target } from 'lucide-react';
import { useStation } from '../components/StationContext';
import { SelectionProvider, useSelection } from '../components/SelectionContext';
import { HoverContext } from '../components/HoverContext';
import { ConnectionsList } from '../components/ConnectionsList';
import { HoverCard } from '../components/HoverCard';
import { PropertyInspector } from '../components/PropertyInspector';
import { useTheme } from '../components/ThemeContext';
import { TYPE_MATERIALS, GENERIC_MATERIAL } from '../lib/materials';
import type { NodeLayout, NodeInfo, ConnectionLayout } from '../lib/layout';
import { buildSceneLayout } from '../lib/layout';

cytoscape.use(fcose);

function resolveColor(type: string): string {
  const t = (type || '').toLowerCase();
  for (const { match, mat } of TYPE_MATERIALS) {
    if (t.includes(match)) return mat.color;
  }
  return GENERIC_MATERIAL.color;
}

// Traverse hierarchy tree to collect NodeInfo map
function buildNodesMap(root: NodeLayout): Map<string, NodeInfo> {
  const map = new Map<string, NodeInfo>();
  function visit(node: NodeLayout, parentName?: string) {
    map.set(node.name, {
      name: node.name,
      type: node.type,
      parentName,
      // For visual topology, we just need basic info for graph
    } as any);
    for (const child of node.children) {
      visit(child, node.name);
    }
  }
  visit(root);
  return map;
}

const GraphContainer: React.FC<{ root: NodeLayout, connections: ConnectionLayout[] }> = ({ root, connections }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const { setHoveredName, hoveredName } = React.useContext(HoverContext);
  const { setSelectedName, selectedName, hiddenSet } = useSelection();
  const { theme } = useTheme();
  
  const liveStateRef = useRef<Record<string, unknown>>({});

  const allNodes = useMemo(() => {
    if (!root) return new Map<string, NodeInfo>();
    return buildNodesMap(root);
  }, [root]);

  const elements = useMemo(() => {
    const els: cytoscape.ElementDefinition[] = [];
    if (!allNodes || !connections) return els;
    
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
      if (!hiddenSet.has(c.id)) {
        els.push({
          data: {
            id: `conn-${idx}-${c.source}-${c.target}`,
            source: c.source,
            target: c.target,
            originalId: c.id,
          },
        });
      }
    });

    return els;
  }, [allNodes, connections, hiddenSet]);

  // Sync selection/hover
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    
    cy.elements().removeClass('hovered').removeClass('selected');
    
    if (hoveredName) {
      cy.getElementById(hoveredName).addClass('hovered');
      cy.edges().filter((e: any) => e.data('originalId') === hoveredName).addClass('hovered');
    }
    
    if (selectedName) {
      cy.getElementById(selectedName).addClass('selected');
      cy.edges().filter((e: any) => e.data('originalId') === selectedName).addClass('selected');
    }
  }, [hoveredName, selectedName]);

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

    cy.on('layoutstop', () => {
      cy.fit();
      const initialZoom = cy.zoom();
      cy.minZoom(initialZoom / 3.5); 

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
          
          const spacing = 15; 
          group.forEach((e, i) => {
            const offset = (i - (group.length - 1) / 2) * spacing;
            e.style('source-endpoint', `${nx * offset}px ${ny * offset}px`);
            e.style('target-endpoint', `${nx * offset}px ${ny * offset}px`);
          });
        }
      });
    });

    const handleMouseOver = (e: cytoscape.EventObject) => {
      const id = e.target.isEdge() ? e.target.data('originalId') : e.target.id();
      setHoveredName(id);
    };

    const handleMouseOut = () => {
      setHoveredName(null);
    };

    const handleTap = (e: cytoscape.EventObject) => {
      if (e.target === cy) {
        setSelectedName(null);
      } else {
        const id = e.target.isEdge() ? e.target.data('originalId') : e.target.id();
        setSelectedName(id);
      }
    };

    cy.on('mouseover', 'node, edge', handleMouseOver);
    cy.on('mouseout', 'node, edge', handleMouseOut);
    cy.on('tap', handleTap);

    cy.on('zoom', () => {
      const z = cy.zoom();
      const calcFSize = (base: number, sMin: number, sMax: number, zHide: number) => {
        if (z < zHide) return 0.001; 
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

  const selectedNodeObj = selectedName && root ? (function findN(r: NodeLayout, n: string): NodeLayout | null {
    if (r.name === n) return r;
    for (const c of r.children) { const f = findN(c, n); if (f) return f; }
    return null;
  })(root, selectedName) : null;

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-main)' }} data-testid="cytoscape-container" />
      
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

      {hoveredName && root && connections && (
        <div style={{ position: 'absolute', top: 16, left: 16, pointerEvents: 'none', zIndex: 100 }}>
          <HoverCard root={root} connections={connections} liveStateRef={liveStateRef} explicitName={hoveredName} />
        </div>
      )}

      {selectedName && root && connections && (
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 16, zIndex: 100, pointerEvents: 'none', maxHeight: 'calc(100% - 32px)' }}>
          {selectedNodeObj && (
            <div style={{ pointerEvents: 'auto', width: 'max-content', minWidth: 300, maxWidth: '30vw', overflowY: 'auto', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <PropertyInspector node={selectedNodeObj} connections={connections} liveStateRef={liveStateRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export function ConnectionsPage() {
  const { hierarchy: rawHierarchy, connections: rawConnections, isLoadingData, spec } = useStation();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const sceneLayout = useMemo(() => {
    if (!rawHierarchy || !rawConnections) return null;
    try {
      return buildSceneLayout(rawHierarchy, rawConnections, spec || {});
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [rawHierarchy, rawConnections, spec]);

  if (isLoadingData) {
    return <div style={{ padding: 24, color: 'var(--text-primary)' }}>Loading...</div>;
  }

  if (!rawHierarchy || !rawConnections || !sceneLayout) {
    return <div style={{ padding: 24, color: 'var(--text-primary)' }}>No twin data available.</div>;
  }

  return (
    <HoverContext.Provider value={{
      hoveredName,
      hoveredNodes: new Set(),
      hoveredAncestors: new Set(),
      selectedAncestors: new Set(),
      activeLayer: null,
      componentsInteractable: true,
      connectionsInteractable: true,
      setHoveredName
    }}>
      <SelectionProvider>
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          <div style={{ width: 300, borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
            <ConnectionsList connections={sceneLayout.connections} />
          </div>
          <GraphContainer root={sceneLayout.root} connections={sceneLayout.connections} />
        </div>
      </SelectionProvider>
    </HoverContext.Provider>
  );
}
