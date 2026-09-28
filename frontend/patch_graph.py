import re

with open('src/pages/ConnectionsPage.tsx', 'r') as f:
    content = f.read()

start_marker = "function buildNodesMap(root: NodeLayout): Map<string, NodeInfo> {"
end_marker = "export function ConnectionsPage() {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

new_content = """function buildNodesMap(root: NodeLayout): Map<string, NodeInfo> {
  const map = new Map<string, NodeInfo>();
  function visit(node: NodeLayout, parentName?: string) {
    map.set(node.name, {
      name: node.name,
      type: node.type,
      parentName,
    } as any);
    for (const child of node.children) {
      visit(child, node.name);
    }
  }
  visit(root);
  return map;
}

const GraphContainer: React.FC<{ root: NodeLayout, connections: ConnectionLayout[], leftOffset: number }> = ({ root, connections, leftOffset }) => {
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

    const getTopLevelBlock = (nodeName: string) => {
      let curr = allNodes.get(nodeName);
      while (curr && curr.parentName && curr.parentName !== root.name) {
        curr = allNodes.get(curr.parentName);
      }
      return curr ? curr.name : nodeName;
    };

    const internalCounts = new Map<string, number>();
    const internalGroups = new Map<string, number>();
    connections.forEach((c) => {
      if (!allNodes.has(c.source) || !allNodes.has(c.target)) return;
      const pA = getTopLevelBlock(c.source);
      const pB = getTopLevelBlock(c.target);
      if (pA === pB) {
        const key = [c.source, c.target].sort().join('::');
        internalCounts.set(key, (internalCounts.get(key) || 0) + 1);
      }
    });

    const bundleGroups = new Map<string, { A: string, B: string, count: number }>();

    connections.forEach((c) => {
      if (!allNodes.has(c.source) || !allNodes.has(c.target)) return;

      const pA = getTopLevelBlock(c.source);
      const pB = getTopLevelBlock(c.target);

      if (pA === pB) {
        const key = [c.source, c.target].sort().join('::');
        const gIdx = internalGroups.get(key) || 0;
        internalGroups.set(key, gIdx + 1);
        const gTotal = internalCounts.get(key) || 1;

        els.push({
          data: {
            id: c.id,
            source: c.source,
            target: c.target,
            originalId: c.id,
            connType: c.connectionType,
            parallelIndex: gIdx,
            parallelTotal: gTotal
          },
          classes: 'internal-edge'
        });
      } else {
        const [A, B] = [pA, pB].sort();
        const bKey = `${A}::${B}`;
        
        if (!bundleGroups.has(bKey)) {
          bundleGroups.set(bKey, { A, B, count: 0 });
          els.push({ data: { id: `hub-${A}-${B}`, parent: A, label: '' }, classes: 'hub-node' });
          els.push({ data: { id: `hub-${B}-${A}`, parent: B, label: '' }, classes: 'hub-node' });
          els.push({
            data: { id: `bundle-${A}-${B}`, source: `hub-${A}-${B}`, target: `hub-${B}-${A}`, bKey, label: '' },
            classes: 'bundle-edge'
          });
        }
        
        bundleGroups.get(bKey)!.count++;
        
        const hubSrc = pA === A ? `hub-${A}-${B}` : `hub-${B}-${A}`;
        const hubTgt = pB === B ? `hub-${B}-${A}` : `hub-${A}-${B}`;
        
        els.push({
          data: { id: `v-src-${c.id}`, source: c.source, target: hubSrc, represents: c.id, connType: c.connectionType, bKey },
          classes: 'visual-edge'
        });
        els.push({
          data: { id: `v-tgt-${c.id}`, source: hubTgt, target: c.target, represents: c.id, connType: c.connectionType, bKey },
          classes: 'visual-edge'
        });
        els.push({
          data: { id: c.id, source: c.source, target: c.target, originalId: c.id, connType: c.connectionType },
          classes: 'real-edge hidden'
        });
      }
    });

    els.forEach(el => {
      if (el.classes === 'bundle-edge') {
        el.data!.label = `${bundleGroups.get(el.data!.bKey!)?.count} conns`;
      }
    });

    return els;
  }, [allNodes, connections, root.name]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.elements().removeClass('hovered selected highlighted neighbor dimmed hidden');

    if (hiddenSet.size > 0) {
      cy.elements().filter((e: any) => hiddenSet.has(e.data('originalId'))).addClass('hidden');
    }

    if (hoveredName) {
      const hovNode = cy.getElementById(hoveredName);
      if (hovNode.nonempty()) hovNode.addClass('hovered');
      
      const realEdges = cy.edges().filter((e: any) => e.data('originalId') === hoveredName || (e.isEdge() && !e.hasClass('visual-edge') && !e.hasClass('bundle-edge') && (e.source().id() === hoveredName || e.target().id() === hoveredName)));
      realEdges.addClass('hovered');
      realEdges.forEach((re: any) => {
        cy.edges(`.visual-edge[represents = "${re.id()}"]`).addClass('hovered');
      });
    }

    if (selectedName) {
      const selNode = cy.getElementById(selectedName);

      if (selNode.nonempty() && selNode.isNode()) {
        selNode.addClass('selected');

        const internalEdges = selNode.connectedEdges('.internal-edge');
        internalEdges.addClass('highlighted');
        
        const visualEdges = selNode.connectedEdges('.visual-edge');
        visualEdges.addClass('highlighted');
        
        const repIds = new Set();
        visualEdges.forEach((e: any) => repIds.add(e.data('represents')));
        
        const allVisual = cy.edges('.visual-edge').filter((e: any) => repIds.has(e.data('represents')));
        allVisual.addClass('highlighted');
        
        const bKeys = new Set();
        allVisual.forEach((e: any) => bKeys.add(e.data('bKey')));
        const bundles = cy.edges('.bundle-edge').filter((e: any) => bKeys.has(e.data('bKey')));
        bundles.addClass('highlighted');

        const neighbors = internalEdges.connectedNodes().union(allVisual.connectedNodes().not('.hub-node')).not(selNode);
        neighbors.addClass('neighbor');

        let relevant = selNode.union(internalEdges).union(allVisual).union(bundles).union(neighbors).union(selNode.ancestors()).union(neighbors.ancestors());
        if (selNode.isParent()) relevant = relevant.union(selNode.descendants());

        cy.elements().not(relevant).not('.real-edge').addClass('dimmed');

      } else {
        const realEdge = cy.getElementById(selectedName);
        if (realEdge.nonempty()) {
          if (realEdge.hasClass('internal-edge')) {
             realEdge.addClass('selected highlighted');
             const src = realEdge.source();
             const tgt = realEdge.target();
             src.addClass('neighbor');
             tgt.addClass('neighbor');
             const relevant = realEdge.union(src).union(tgt).union(src.ancestors()).union(tgt.ancestors());
             cy.elements().not(relevant).not('.real-edge').addClass('dimmed');
          } else if (realEdge.hasClass('real-edge')) {
             const visualEdges = cy.edges(`.visual-edge[represents = "${selectedName}"]`);
             visualEdges.addClass('selected highlighted');
             
             const bKeys = new Set();
             visualEdges.forEach((e: any) => bKeys.add(e.data('bKey')));
             const bundles = cy.edges('.bundle-edge').filter((e: any) => bKeys.has(e.data('bKey')));
             bundles.addClass('highlighted');
             
             const src = realEdge.source();
             const tgt = realEdge.target();
             src.addClass('neighbor');
             tgt.addClass('neighbor');
             
             const relevant = visualEdges.union(bundles).union(src).union(tgt).union(src.ancestors()).union(tgt.ancestors());
             cy.elements().not(relevant).not('.real-edge').addClass('dimmed');
          }
        }
      }
    }
  }, [hoveredName, selectedName, hiddenSet]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const depth0Color = theme === 'light' ? '#020617' : '#ffffff';
    const depth1Color = theme === 'light' ? '#1e293b' : '#f1f5f9';
    const depth2Color = theme === 'light' ? '#475569' : '#94a3b8';
    const depth3Color = theme === 'light' ? '#334155' : '#64748b';
    const outlineColor = theme === 'light' ? '#f0f4f8' : '#06060c';
    const outlineWidth = theme === 'light' ? 0 : 2;
    const ss = cy.style()
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
      .style({ 'color': depth3Color });

    for (const [type, colors] of Object.entries(CONN_TYPE_COLORS)) {
      const c = theme === 'light' ? colors.light : colors.dark;
      (ss as any).selector(`edge.internal-edge[connType = "${type}"]`).style({ 'line-color': c, 'target-arrow-color': c });
      (ss as any).selector(`edge.visual-edge[connType = "${type}"]`).style({ 'line-color': c, 'target-arrow-color': c });
    }
    ss.update();
  }, [theme]);

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
            'text-outline-color': theme === 'light' ? '#f0f4f8' : '#06060c',
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
            'background-opacity': 0.06,
            'border-width': 2,
            'border-color': 'data(typeColor)',
            'border-style': 'solid',
            'padding': '40px',
            'text-valign': 'top',
            'text-halign': 'center',
            'font-weight': 'bold',
            'text-outline-width': 0,
            'text-margin-y': -5
          }
        },
        {
          selector: 'edge.internal-edge',
          style: {
            'width': 2,
            'curve-style': 'taxi',
            'taxi-direction': 'auto',
            'opacity': 0.7,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8,
          } as any
        },
        {
          selector: 'edge.visual-edge',
          style: {
            'width': 2,
            'curve-style': 'taxi',
            'taxi-direction': 'auto',
            'opacity': 0.3,
            'target-arrow-shape': 'none',
          } as any
        },
        {
          selector: '.bundle-edge',
          style: {
            'width': 6,
            'line-style': 'dashed',
            'curve-style': 'taxi',
            'taxi-direction': 'auto',
            'label': 'data(label)',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-background-color': theme === 'light' ? '#f1f5f9' : '#1e293b',
            'text-background-opacity': 1,
            'text-background-padding': '4px' as any,
            'text-background-shape': 'roundrectangle',
            'color': theme === 'light' ? '#475569' : '#94a3b8',
            'line-color': theme === 'light' ? '#cbd5e1' : '#334155',
            'target-arrow-shape': 'none',
            'z-index': 1,
          } as any
        },
        {
          selector: '.hub-node',
          style: {
            'width': 10,
            'height': 10,
            'background-color': theme === 'light' ? '#94a3b8' : '#475569',
            'shape': 'ellipse',
            'label': '',
            'border-width': 2,
            'border-color': theme === 'light' ? '#ffffff' : '#0f172a'
          }
        },
        {
          selector: '.real-edge',
          style: { 'display': 'none' }
        },
        {
          selector: '.hidden',
          style: { 'display': 'none' }
        },
        {
          selector: '.dimmed',
          style: { 'opacity': 0.12 }
        },
        {
          selector: '.highlighted',
          style: {
            'opacity': 1,
            'width': 3,
            'z-index': 15,
          }
        },
        {
          selector: '.visual-edge.highlighted',
          style: { 'width': 4, 'z-index': 20 }
        },
        {
          selector: '.visual-edge.selected',
          style: { 'width': 5, 'z-index': 25, 'line-color': theme === 'light' ? '#0ea5e9' : '#00e676' }
        },
        {
          selector: '.internal-edge.selected',
          style: { 'width': 4, 'z-index': 25, 'line-color': theme === 'light' ? '#0ea5e9' : '#00e676', 'target-arrow-color': theme === 'light' ? '#0ea5e9' : '#00e676' }
        },
        {
          selector: 'node.neighbor',
          style: {
            'border-width': 3,
            'border-color': theme === 'light' ? '#60a5fa' : '#38bdf8',
            'opacity': 1,
            'z-index': 10,
          }
        }
      ]
    });

    cyRef.current = cy;

    cy.elements().not('.real-edge').layout({
      name: 'elk',
      nodeDimensionsIncludeLabels: true,
      fit: true,
      padding: 60,
      animate: false,
      elk: {
        algorithm: 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
        'elk.layered.thoroughness': '100',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        'elk.spacing.nodeNode': '60',
        'elk.spacing.edgeNode': '40',
        'elk.spacing.edgeEdge': '20',
        'elk.layered.spacing.edgeNodeBetweenLayers': '50',
        'elk.layered.spacing.edgeEdgeBetweenLayers': '25',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.padding': '[top=50,left=30,bottom=30,right=30]',
        'elk.randomSeed': '1',
      },
    } as any).run();

    cy.on('layoutstop', () => {
      cy.fit(undefined, 60);
      const initialZoom = cy.zoom();
      cy.minZoom(initialZoom / 3.5);

      cy.edges('.internal-edge').forEach((e: any) => {
        const pIdx = e.data('parallelIndex') || 0;
        const pTotal = e.data('parallelTotal') || 1;
        if (pTotal > 1) {
          const offset = 40 + (pIdx - (pTotal - 1) / 2) * 20;
          e.style('taxi-turn', `${offset}px`);
        }
      });
    });

    const handleMouseOver = (e: cytoscape.EventObject) => {
      if (e.target.isEdge()) {
        if (e.target.hasClass('bundle-edge')) return;
        const id = e.target.hasClass('visual-edge') ? e.target.data('represents') : e.target.id();
        setHoveredName(id);
      } else {
        if (e.target.hasClass('hub-node')) return;
        setHoveredName(e.target.id());
      }
    };

    const handleMouseOut = () => {
      setHoveredName(null);
    };

    const handleTap = (e: cytoscape.EventObject) => {
      if (e.target === cy) {
        setSelectedName(null);
      } else if (e.target.isEdge()) {
        if (e.target.hasClass('bundle-edge')) return;
        const id = e.target.hasClass('visual-edge') ? e.target.data('represents') : e.target.id();
        setSelectedName(id);
      } else {
        if (e.target.hasClass('hub-node')) return;
        setSelectedName(e.target.id());
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
        return (Math.min(Math.max(screen, sMin), sMax)) / z;
      };

      cy.style()
        .selector('node[depth = 0]')
        .style({ 'font-size': `${calcFSize(120, 14, 24, 0.05)}px` })
        .selector('node[depth = 1]')
        .style({ 'font-size': `${calcFSize(80, 12, 18, 0.15)}px` })
        .selector('node[depth >= 2]')
        .style({ 'font-size': `${calcFSize(40, 10, 14, 0.25)}px` })
        .update();

      const edgeOpacity = z < 0.25 ? 0 : (z < 0.6 ? (z - 0.25)/0.35 * 0.3 : 0.3);
      cy.style().selector('.visual-edge:not(.highlighted):not(.selected)').style({ 'opacity': edgeOpacity }).update();
    });

    const observer = new ResizeObserver(() => {
      if (cy) {
        cy.resize();
        cy.fit();
        cy.minZoom(cy.zoom() / 3.5);
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
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
        <div style={{ position: 'absolute', top: 16, left: leftOffset + 16, pointerEvents: 'none', zIndex: 100 }}>
          <HoverCard root={root} connections={connections} liveStateRef={liveStateRef} explicitName={hoveredName} />
        </div>
      )}

      </div>
      
      {selectedName && root && connections && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 400, zIndex: 100,
          background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-color)',
          boxShadow: '-4px 0 15px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Inspector</h3>
            <button onClick={() => setSelectedName(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20 }}>&times;</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedNodeObj ? (
              <PropertyInspector node={selectedNodeObj} connections={connections} liveStateRef={liveStateRef} flat={true} />
            ) : (
              (() => {
                const c = connections.find(x => x.id === selectedName);
                if (c) return <ConnectionInspector connection={c} liveStateRef={liveStateRef} flat={true} />;
                return null;
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
};
"""

with open('src/pages/ConnectionsPage.tsx', 'w') as f:
    f.write(content[:start_idx] + new_content + content[end_idx:])
