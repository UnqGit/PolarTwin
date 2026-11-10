import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useInRouterContext } from 'react-router-dom';
import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';
import {
  Target, ZoomIn, ZoomOut, Maximize2, GitFork, Compass,
  Layers, Filter, Eye, EyeOff, Radio, Zap, Droplets, Activity,
  ExternalLink, ChevronRight, X, Sparkles, ShieldAlert, Cpu
} from 'lucide-react';
import { useStation } from '../components/StationContext';
import { SelectionProvider, useSelection } from '../components/SelectionContext';
import { HoverContext } from '../components/HoverContext';
import { ConnectionsList } from '../components/ConnectionsList';
import { HoverCard } from '../components/HoverCard';
import { PropertyInspector } from '../components/PropertyInspector';
import { ConnectionInspector } from '../components/ConnectionInspector';
import { useTheme } from '../components/ThemeContext';
import { TYPE_MATERIALS, GENERIC_MATERIAL } from '../lib/materials';
import type { NodeLayout, NodeInfo, ConnectionLayout } from '../lib/layout';
import { buildSceneLayout } from '../lib/layout';

import {
  SUBSYSTEM_CONFIGS, DEFAULT_SUBSYSTEM,
  MEDIUM_CONFIGS, normalizeMedium
} from './ConnectionsPage/types';
import type { SubsystemTheme, ViewMode, TraceMode, TraceResult } from './ConnectionsPage/types';
import { ConnectionsStatsRibbon } from './ConnectionsPage/ConnectionsStatsRibbon';
import { TraceAnalysisHUD } from './ConnectionsPage/TraceAnalysisHUD';
import { SubsystemBusView } from './ConnectionsPage/SubsystemBusView';
import { DependencyMatrixView } from './ConnectionsPage/DependencyMatrixView';

cytoscape.use(elk);

function resolveColor(type: string): string {
  const t = (type || '').toLowerCase();
  for (const { match, mat } of TYPE_MATERIALS) {
    if (t.includes(match)) return mat.color;
  }
  return GENERIC_MATERIAL.color;
}

// Connection-type → edge colors
const CONN_TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  power:      { light: '#d97706', dark: '#f59e0b' },
  data:       { light: '#0891b2', dark: '#22d3ee' },
  signal:     { light: '#7c3aed', dark: '#a78bfa' },
  resource:   { light: '#059669', dark: '#34d399' },
  fluid:      { light: '#059669', dark: '#34d399' },
  mechanical: { light: '#ea580c', dark: '#fb923c' },
};

function buildNodesMap(root: NodeLayout): Map<string, NodeInfo> {
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

const RouterSyncInner: React.FC = () => {
  const location = useLocation();
  const { setSelectedName } = useSelection();
  const prevSelRef = useRef<string | null>(null);

  useEffect(() => {
    const sel = location.state?.selectedName;
    if (sel && sel !== prevSelRef.current) {
      prevSelRef.current = sel;
      setSelectedName(sel);
    }
  }, [location.state?.selectedName, setSelectedName]);

  return null;
};

const RouterSync: React.FC = () => {
  const inRouter = useInRouterContext();
  if (!inRouter) return null;
  return <RouterSyncInner />;
};

const NavButtonInner: React.FC<{
  to: string;
  state?: any;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ to, state, className, style, children }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to, { state })}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
};

const NavButton: React.FC<{
  to: string;
  state?: any;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ to, state, className, style, children }) => {
  const inRouter = useInRouterContext();
  if (!inRouter) return null;
  return <NavButtonInner to={to} state={state} className={className} style={style}>{children}</NavButtonInner>;
};

/* ═══════════════════════════════════════════════════════
   GRAPH CONTAINER (Interactive Cytoscape Topology)
   ═══════════════════════════════════════════════════════ */
interface GraphContainerProps {
  root: NodeLayout;
  connections: ConnectionLayout[];
  leftOffset: number;
  selectedMedium: string;
  traceResult: TraceResult | null;
  onStartTrace: (mode: 'upstream' | 'downstream' | 'blast_radius') => void;
  onClearTrace: () => void;
  searchQuery: string;
}

const GraphContainer: React.FC<GraphContainerProps> = ({
  root,
  connections,
  leftOffset,
  selectedMedium,
  traceResult,
  onStartTrace,
  onClearTrace,
  searchQuery
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const { setHoveredName, hoveredName } = React.useContext(HoverContext);
  const { setSelectedName, selectedName, hiddenSet } = useSelection();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const liveStateRef = useRef<Record<string, unknown>>({});
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<'elk' | 'breadthfirst' | 'concentric'>('elk');

  const allNodes = useMemo(() => {
    if (!root) return new Map<string, NodeInfo>();
    return buildNodesMap(root);
  }, [root]);

  // Construct elements for Cytoscape
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

    const bundleGroups = new Map<string, { A: string; B: string; count: number }>();

    connections.forEach((c) => {
      if (!allNodes.has(c.source) || !allNodes.has(c.target)) return;

      const pA = getTopLevelBlock(c.source);
      const pB = getTopLevelBlock(c.target);
      const rawType = (c.connectionType || (c as any).type || '').toLowerCase();
      const normalizedMed = normalizeMedium(rawType);

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
            connType: rawType || normalizedMed,
            rawType: rawType,
            medium: normalizedMed,
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

        els.push({
          data: {
            id: c.id,
            source: c.source,
            target: c.target,
            originalId: c.id,
            connType: rawType || normalizedMed,
            rawType: rawType,
            medium: normalizedMed
          },
          classes: 'real-edge'
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

  // Track active layout instance to prevent async callbacks after destroy
  const activeLayoutRef = useRef<cytoscape.Layouts | null>(null);

  // Run layout function
  const runLayout = useCallback((algo: 'elk' | 'breadthfirst' | 'concentric') => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (cy.destroyed && cy.destroyed()) return;

    // Do not run layouts if container is not visible / 0x0
    if (!containerRef.current || containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
      return;
    }

    if (activeLayoutRef.current) {
      try {
        activeLayoutRef.current.stop();
      } catch (e) {}
      activeLayoutRef.current = null;
    }

    try {
      if (algo === 'elk') {
        const layout = cy.elements().not('.real-edge').layout({
          name: 'elk',
          nodeDimensionsIncludeLabels: true,
          fit: true,
          padding: 50,
          animate: false,
          elk: {
            algorithm: 'layered',
            'elk.direction': 'DOWN',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
            'elk.layered.thoroughness': '100',
            'elk.layered.spacing.nodeNodeBetweenLayers': '60',
            'elk.spacing.nodeNode': '40',
            'elk.spacing.edgeNode': '30',
            'elk.spacing.edgeEdge': '20',
            'elk.layered.spacing.edgeNodeBetweenLayers': '30',
            'elk.layered.spacing.edgeEdgeBetweenLayers': '25',
            'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
            'elk.padding': '[top=30,left=20,bottom=20,right=20]',
            'elk.randomSeed': '1',
          },
        } as any);
        activeLayoutRef.current = layout;
        layout.run();
      } else if (algo === 'breadthfirst') {
        const layout = cy.elements().layout({
          name: 'breadthfirst',
          directed: true,
          fit: true,
          padding: 40,
          animate: true,
          animationDuration: 400
        } as any);
        activeLayoutRef.current = layout;
        layout.run();
      } else if (algo === 'concentric') {
        const layout = cy.elements().layout({
          name: 'concentric',
          fit: true,
          padding: 40,
          animate: true,
          animationDuration: 400,
          concentric: (node: any) => node.degree(),
          levelWidth: () => 2
        } as any);
        activeLayoutRef.current = layout;
        layout.run();
      }
    } catch (e) {
      console.warn('Cytoscape layout execution error:', e);
    }
  }, []);

  // Update Cytoscape selections, highlighting, tracing, and filters
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    cy.elements().removeClass('hovered selected parent-selected connection-selected highlighted neighbor dimmed hidden selected-parent trace-highlight trace-blast');

    // 1. Medium filter
    if (selectedMedium && selectedMedium !== 'all') {
      cy.edges().forEach((e: any) => {
        const ct = e.data('connType');
        if (ct && ct !== selectedMedium) {
          e.addClass('dimmed');
        }
      });
    }

    // 2. Hidden elements
    if (hiddenSet.size > 0) {
      cy.elements().filter((e: any) => hiddenSet.has(e.data('originalId')) || hiddenSet.has(e.data('represents'))).addClass('hidden');
    }

    // 3. Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchingNodes = cy.nodes().filter((n: any) => n.id().toLowerCase().includes(q));
      if (matchingNodes.nonempty()) {
        matchingNodes.addClass('highlighted');
        cy.nodes().not(matchingNodes).not(matchingNodes.ancestors()).addClass('dimmed');
      }
    }

    // 4. Trace Result highlighting
    if (traceResult) {
      const isBlast = traceResult.mode === 'blast_radius';
      const highlightClass = isBlast ? 'trace-blast' : 'trace-highlight';

      cy.elements().addClass('dimmed');

      traceResult.nodeIds.forEach(id => {
        const n = cy.getElementById(id);
        if (n.nonempty()) {
          n.removeClass('dimmed').addClass(highlightClass);
          n.ancestors().removeClass('dimmed');
        }
      });

      traceResult.edgeIds.forEach(id => {
        const e = cy.getElementById(id);
        if (e.nonempty()) {
          e.removeClass('dimmed').addClass(highlightClass);
        }
      });

      return; // Skip standard neighbor dimming while tracing
    }

    // 5. Hover state
    if (hoveredName) {
      const hovNode = cy.getElementById(hoveredName);
      if (hovNode.nonempty()) hovNode.addClass('hovered');

      const realEdges = cy.edges().filter(
        (e: any) => e.data('originalId') === hoveredName || (e.isEdge() && !e.hasClass('bundle-edge') && (e.source().id() === hoveredName || e.target().id() === hoveredName))
      );
      realEdges.addClass('hovered');
    }

    // 6. Selected state
    if (selectedName) {
      const selNode = cy.getElementById(selectedName);

      if (selNode.nonempty() && selNode.isNode()) {
        if (selNode.isParent()) {
          selNode.addClass('parent-selected');
        } else {
          selNode.addClass('selected');

          const connectedEdges = selNode.connectedEdges('.internal-edge, .real-edge');
          connectedEdges.addClass('highlighted');

          const neighbors = connectedEdges.connectedNodes().not(selNode);
          neighbors.addClass('neighbor');

          const relevant = selNode.union(connectedEdges).union(neighbors).union(selNode.ancestors()).union(neighbors.ancestors());
          cy.elements().not(relevant).not('.hub-node').not('.bundle-edge').addClass('dimmed');
        }
      } else {
        const realEdge = cy.getElementById(selectedName);
        if (realEdge.nonempty()) {
          realEdge.addClass('connection-selected highlighted');
          const src = realEdge.source();
          const tgt = realEdge.target();
          src.addClass('neighbor');
          tgt.addClass('neighbor');

          const topSrc = src.ancestors().filter((n: any) => n.data('depth') !== 0).last();
          const topTgt = tgt.ancestors().filter((n: any) => n.data('depth') !== 0).last();
          if (topSrc.nonempty()) topSrc.addClass('selected-parent');
          if (topTgt.nonempty() && topTgt !== topSrc) topTgt.addClass('selected-parent');

          const relevant = realEdge.union(src).union(tgt).union(src.ancestors()).union(tgt.ancestors());
          cy.elements().not(relevant).not('.hub-node').not('.bundle-edge').addClass('dimmed');
        }
      }
    }
  }, [hoveredName, selectedName, hiddenSet, selectedMedium, traceResult, searchQuery]);

  // Apply theme-specific cytoscape styles
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const depth0Color = isLight ? '#020617' : '#ffffff';
    const depth1Color = isLight ? '#1e293b' : '#f1f5f9';
    const depth2Color = isLight ? '#475569' : '#94a3b8';
    const depth3Color = isLight ? '#334155' : '#64748b';
    const outlineColor = isLight ? '#f0f4f8' : '#06060c';
    const outlineWidth = isLight ? 0 : 2;

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
      const c = isLight ? colors.light : colors.dark;
      (ss as any).selector(`edge[connType = "${type}"]:not(.connection-selected):not(.trace-highlight):not(.trace-blast)`).style({ 'line-color': c, 'target-arrow-color': c });
      (ss as any).selector(`edge[rawType = "${type}"]:not(.connection-selected):not(.trace-highlight):not(.trace-blast)`).style({ 'line-color': c, 'target-arrow-color': c });
      (ss as any).selector(`edge[medium = "${type}"]:not(.connection-selected):not(.trace-highlight):not(.trace-blast)`).style({ 'line-color': c, 'target-arrow-color': c });
    }
    ss.update();
  }, [isLight]);

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
            'font-weight': '600',
            'font-family': 'Inter, sans-serif',
            'text-outline-color': isLight ? '#f0f4f8' : '#06060c',
            'text-outline-width': isLight ? 0 : 2,
            'text-margin-y': -6,
            'shape': 'round-rectangle',
            'padding': '14px',
            'border-width': 1.5,
            'border-color': isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)',
          }
        },
        {
          selector: 'node[depth = 0]',
          style: { 'color': isLight ? '#020617' : '#ffffff' }
        },
        {
          selector: 'node[depth = 1]',
          style: { 'color': isLight ? '#1e293b' : '#f1f5f9' }
        },
        {
          selector: 'node[depth = 2]',
          style: { 'color': isLight ? '#475569' : '#94a3b8' }
        },
        {
          selector: 'node[depth >= 3]',
          style: { 'color': isLight ? '#334155' : '#64748b' }
        },
        {
          selector: ':parent',
          style: {
            'background-opacity': isLight ? 0.05 : 0.04,
            'background-color': isLight ? '#64748b' : '#334155',
            'border-width': 2,
            'border-color': isLight ? '#94a3b8' : 'rgba(255,255,255,0.12)',
            'border-style': 'solid',
            'padding': '26px',
            'text-valign': 'top',
            'text-halign': 'center',
            'font-weight': 'bold',
            'text-transform': 'uppercase',
            'text-outline-width': 0,
            'text-margin-y': -8
          }
        },
        {
          selector: '.selected-parent',
          style: {
            'border-color': 'var(--accent-primary)',
            'border-width': 2.5,
          }
        },
        {
          selector: '.parent-selected',
          style: {
            'border-color': 'var(--accent-primary)',
            'border-width': 3,
            'z-index': 20
          }
        },
        {
          selector: 'edge.internal-edge, edge.real-edge',
          style: {
            'width': 2,
            'curve-style': 'taxi',
            'taxi-direction': 'auto',
            'opacity': 0.75,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.85,
          } as any
        },
        // Distinct Connection Colors by Type (Power: Amber, Data: Cyan, Signal: Purple, Resource/Fluid: Emerald, Mechanical: Orange)
        {
          selector: 'edge[connType = "power"], edge[rawType = "power"], edge[medium = "power"]',
          style: {
            'line-color': isLight ? '#d97706' : '#f59e0b',
            'target-arrow-color': isLight ? '#d97706' : '#f59e0b',
          }
        },
        {
          selector: 'edge[connType = "data"], edge[rawType = "data"], edge[medium = "data"]',
          style: {
            'line-color': isLight ? '#0891b2' : '#22d3ee',
            'target-arrow-color': isLight ? '#0891b2' : '#22d3ee',
          }
        },
        {
          selector: 'edge[connType = "signal"], edge[rawType = "signal"], edge[medium = "signal"]',
          style: {
            'line-color': isLight ? '#7c3aed' : '#a78bfa',
            'target-arrow-color': isLight ? '#7c3aed' : '#a78bfa',
          }
        },
        {
          selector: 'edge[connType = "resource"], edge[rawType = "resource"], edge[connType = "fluid"], edge[rawType = "fluid"], edge[medium = "fluid"]',
          style: {
            'line-color': isLight ? '#059669' : '#34d399',
            'target-arrow-color': isLight ? '#059669' : '#34d399',
          }
        },
        {
          selector: 'edge[connType = "mechanical"], edge[rawType = "mechanical"], edge[medium = "mechanical"]',
          style: {
            'line-color': isLight ? '#ea580c' : '#fb923c',
            'target-arrow-color': isLight ? '#ea580c' : '#fb923c',
          }
        },
        {
          selector: '.bundle-edge',
          style: {
            'display': 'none'
          } as any
        },
        {
          selector: '.hub-node',
          style: {
            'display': 'none'
          } as any
        },
        {
          selector: '.hidden',
          style: { 'display': 'none' }
        },
        {
          selector: '.dimmed',
          style: { 'opacity': 0.2 }
        },
        {
          selector: '.highlighted',
          style: {
            'opacity': 1,
            'width': 3.5,
            'z-index': 15,
          }
        },
        {
          selector: 'edge.connection-selected',
          style: {
            'width': 5,
            'z-index': 25,
            'line-color': 'var(--accent-primary)',
            'target-arrow-color': 'var(--accent-primary)',
            'opacity': 1
          } as any
        },
        {
          selector: 'node.selected',
          style: {
            'border-width': 3.5,
            'border-color': 'var(--accent-primary)',
            'z-index': 20
          }
        },
        {
          selector: 'node.neighbor',
          style: {
            'border-width': 2.5,
            'border-color': '#38d9f5',
            'opacity': 1,
            'z-index': 10,
          }
        },
        // Circuit Trace Highlights
        {
          selector: '.trace-highlight',
          style: {
            'border-color': 'var(--accent-primary)',
            'border-width': 3.5,
            'line-color': 'var(--accent-primary)',
            'target-arrow-color': 'var(--accent-primary)',
            'width': 4.5,
            'opacity': 1,
            'z-index': 30
          } as any
        },
        // Blast Radius Outage Highlights
        {
          selector: '.trace-blast',
          style: {
            'border-color': '#f87171',
            'border-width': 3.5,
            'line-color': '#f87171',
            'target-arrow-color': '#f87171',
            'width': 4.5,
            'opacity': 1,
            'z-index': 30
          } as any
        }
      ]
    });

    cyRef.current = cy;
    let hasInitialLayoutRun = false;
    if (containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
      hasInitialLayoutRun = true;
      runLayout('elk');
    }

    const updateZoomTypography = () => {
      if (cy.destroyed && cy.destroyed()) return;
      try {
        const z = cy.zoom();
        const calcFSize = (base: number, sMin: number, sMax: number, zHide: number) => {
          if (z < zHide) return 0.001;
          const screen = base * z;
          return (Math.min(Math.max(screen, sMin), sMax)) / z;
        };

        cy.style()
          .selector('node[depth = 0], :parent[depth = 0]')
          .style({ 'font-size': `${calcFSize(120, 14, 24, 0.05)}px` })
          .selector('node[depth = 1], :parent[depth = 1]')
          .style({ 'font-size': `${calcFSize(80, 12, 18, 0.15)}px` })
          .selector('node[depth >= 2]')
          .style({ 'font-size': `${calcFSize(40, 10, 14, 0.25)}px` })
          .update();

        const edgeOpacity = z < 0.25 ? 0.2 : (z < 0.6 ? 0.2 + (z - 0.25)/0.35 * 0.55 : 0.75);
        cy.style().selector('.internal-edge:not(.highlighted):not(.connection-selected):not(.trace-highlight):not(.trace-blast), .real-edge:not(.highlighted):not(.connection-selected):not(.trace-highlight):not(.trace-blast)').style({ 'opacity': edgeOpacity }).update();
      } catch (e) {}
    };

    cy.on('zoom', updateZoomTypography);

    cy.on('layoutstop', () => {
      if (cy.destroyed && cy.destroyed()) return;
      try {
        cy.fit(undefined, 50);
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

        updateZoomTypography();
      } catch (e) {}
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

    const handleEdgeTap = (e: cytoscape.EventObject) => {
      e.stopPropagation();
      if (e.target.hasClass('bundle-edge')) return;
      const id = e.target.hasClass('visual-edge') ? e.target.data('represents') : e.target.id();
      setSelectedName(id);
    };

    const handleNodeTap = (e: cytoscape.EventObject) => {
      e.stopPropagation();
      const node = e.target;
      if (node.hasClass('hub-node')) return;
      setSelectedName(node.id());
    };

    const handleBgTap = (e: cytoscape.EventObject) => {
      if (e.target === cy) {
        setSelectedName(null);
      }
    };

    cy.on('mouseover', 'node, edge', handleMouseOver);
    cy.on('mouseout', 'node, edge', handleMouseOut);
    cy.on('tap', 'edge', handleEdgeTap);
    cy.on('tap', 'node', handleNodeTap);
    cy.on('tap', handleBgTap);

    const observer = new ResizeObserver((entries) => {
      if (cy && !cy.destroyed()) {
        try {
          const entry = entries[0];
          if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            cy.resize();
            if (!hasInitialLayoutRun) {
              hasInitialLayoutRun = true;
              runLayout(layoutAlgorithm);
            }
          }
        } catch (e) {}
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (activeLayoutRef.current) {
        try {
          activeLayoutRef.current.stop();
        } catch (e) {}
        activeLayoutRef.current = null;
      }
      try {
        cy.destroy();
      } catch (e) {}
      cyRef.current = null;
    };
  }, [elements, setHoveredName, setSelectedName, runLayout, isLight]);

  const selectedNodeObj = selectedName && root ? (function findN(r: NodeLayout, n: string): NodeLayout | null {
    if (r.name === n) return r;
    for (const c of r.children) {
      const f = findN(c, n);
      if (f) return f;
    }
    return null;
  })(root, selectedName) : null;

  const selectedConnObj = selectedName && connections ? connections.find(x => x.id === selectedName) : null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      <RouterSync />
      {/* Cytoscape Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: isLight ? '#f8fafc' : 'var(--bg-main)',
            backgroundImage: isLight
              ? 'radial-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px)'
              : 'radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
          data-testid="cytoscape-container"
        />

        {/* Floating Canvas HUD Controls Island */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 4,
            background: isLight ? '#ffffff' : 'rgba(15, 21, 37, 0.94)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 40,
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* Zoom In */}
          <button
            onClick={() => {
              if (cyRef.current) {
                cyRef.current.zoom({ level: cyRef.current.zoom() * 1.25, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } });
              }
            }}
            title="Zoom In"
            className="btn-icon"
            style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomIn size={16} />
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => {
              if (cyRef.current) {
                cyRef.current.zoom({ level: cyRef.current.zoom() * 0.8, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } });
              }
            }}
            title="Zoom Out"
            className="btn-icon"
            style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomOut size={16} />
          </button>

          {/* Fit to Screen */}
          <button
            onClick={() => {
              if (cyRef.current) {
                cyRef.current.fit(undefined, 50);
              }
            }}
            title="Fit to Screen"
            className="btn-icon"
            style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Maximize2 size={15} />
          </button>

          {/* Reset View */}
          <button
            onClick={() => {
              if (cyRef.current) {
                cyRef.current.fit(undefined, 50);
                cyRef.current.minZoom(cyRef.current.zoom() / 3.5);
              }
            }}
            title="Reset View"
            className="btn-icon"
            style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Target size={16} />
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 2px' }} />

          {/* Layout Algorithm Switcher */}
          <select
            value={layoutAlgorithm}
            onChange={(e) => {
              const a = e.target.value as any;
              setLayoutAlgorithm(a);
              runLayout(a);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              padding: '0 8px',
              outline: 'none',
              cursor: 'pointer'
            }}
            title="Change Layout Engine"
          >
            <option value="elk" style={{ background: 'var(--bg-panel-solid)' }}>Hierarchical (ELK)</option>
            <option value="breadthfirst" style={{ background: 'var(--bg-panel-solid)' }}>Tree (Breadth-First)</option>
            <option value="concentric" style={{ background: 'var(--bg-panel-solid)' }}>Concentric Radial</option>
          </select>
        </div>

        {/* Hover Card */}
        {hoveredName && root && connections && (
          <div style={{ position: 'absolute', top: 16, left: leftOffset + 16, pointerEvents: 'none', zIndex: 100 }}>
            <HoverCard root={root} connections={connections} liveStateRef={liveStateRef} explicitName={hoveredName} />
          </div>
        )}

        {/* Circuit Tracing & Blast Radius HUD */}
        <TraceAnalysisHUD
          selectedName={selectedName}
          traceResult={traceResult}
          onStartTrace={onStartTrace}
          onClearTrace={onClearTrace}
          isLight={isLight}
        />
      </div>

      {/* Slide-Out Inspector Drawer */}
      {selectedName && root && connections && (
        <div
          className="slide-in-right"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 380,
            zIndex: 100,
            background: 'var(--bg-panel-solid)',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              background: 'rgba(80, 219, 192, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedNodeObj ? 'Component Inspector' : 'Connection Inspector'}
              </span>
            </div>
            <button
              onClick={() => setSelectedName(null)}
              className="btn-icon"
              style={{ borderRadius: 'var(--radius-full)', padding: 6 }}
            >
              &times;
            </button>
          </div>

          {/* Quick Action Navigation Bar */}
          <div
            style={{
              padding: '8px 18px',
              background: 'rgba(0,0,0,0.15)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: 8,
              fontSize: 11
            }}
          >
            {selectedNodeObj && (
              <>
                <NavButton
                  to="/twin"
                  state={{ selectedComponentName: selectedNodeObj.name }}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}
                >
                  <ExternalLink size={11} />
                  <span>View in 3D Twin</span>
                </NavButton>
                <NavButton
                  to="/components"
                  state={{ inspectNodeName: selectedNodeObj.name }}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}
                >
                  <Cpu size={11} />
                  <span>Inspect Spec</span>
                </NavButton>
              </>
            )}

            {selectedConnObj && (
              <button
                onClick={() => onStartTrace('blast_radius')}
                className="btn btn-sm btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, color: '#f87171' }}
              >
                <ShieldAlert size={11} />
                <span>Simulate Blast Radius</span>
              </button>
            )}
          </div>

          {/* Inspector Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedNodeObj ? (
              <PropertyInspector node={selectedNodeObj} connections={connections} liveStateRef={liveStateRef} flat={true} />
            ) : selectedConnObj ? (
              <ConnectionInspector connection={selectedConnObj} liveStateRef={liveStateRef} flat={true} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN CONNECTIONS PAGE EXPORT
   ═══════════════════════════════════════════════════════ */
export function ConnectionsPage() {
  return (
    <SelectionProvider>
      <ConnectionsPageContent />
    </SelectionProvider>
  );
}

function ConnectionsPageContent() {
  const { hierarchy: rawHierarchy, connections: rawConnections, isLoadingData, spec, liveStateRef } = useStation();
  const { setSelectedName } = useSelection();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>('schematic');
  const [selectedMedium, setSelectedMedium] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  // Circuit trace state
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);

  // Resizable left sidebar listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        setLeftPanelWidth(prev => Math.max(200, Math.min(600, prev + e.movementX)));
      }
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
    };

    if (isResizingLeft) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft]);

  // Build Scene Layout
  const sceneLayout = useMemo(() => {
    if (!rawHierarchy || !rawConnections) return null;
    try {
      return buildSceneLayout(rawHierarchy, rawConnections, spec || {});
    } catch (e) {
      console.error('Failed to build scene layout:', e);
      return null;
    }
  }, [rawHierarchy, rawConnections, spec]);

  const [renderedConnections, setRenderedConnections] = useState<ConnectionLayout[]>([]);

  useEffect(() => {
    if (!sceneLayout) {
      setRenderedConnections([]);
      return;
    }
    if (sceneLayout.connectionRouterGenerator) {
      const gen = sceneLayout.connectionRouterGenerator();
      while (!gen.next().done) {
        // synchronously exhaust
      }
    }
    setRenderedConnections([...sceneLayout.connections]);
  }, [sceneLayout]);

  // Circuit Tracing Algorithm
  const handleStartTrace = useCallback((mode: 'upstream' | 'downstream' | 'blast_radius', targetNodeName?: string) => {
    const target = targetNodeName || (sceneLayout?.root?.name);
    if (!target || !renderedConnections.length) return;

    const visitedNodes = new Set<string>([target]);
    const visitedEdges = new Set<string>();

    const queue: string[] = [target];

    while (queue.length > 0) {
      const curr = queue.shift()!;

      renderedConnections.forEach(c => {
        if (mode === 'upstream') {
          // Look for edges where target === curr
          if (c.target === curr && !visitedEdges.has(c.id)) {
            visitedEdges.add(c.id);
            if (!visitedNodes.has(c.source)) {
              visitedNodes.add(c.source);
              queue.push(c.source);
            }
          }
        } else {
          // Downstream or Blast Radius: look for edges where source === curr
          if (c.source === curr && !visitedEdges.has(c.id)) {
            visitedEdges.add(c.id);
            if (!visitedNodes.has(c.target)) {
              visitedNodes.add(c.target);
              queue.push(c.target);
            }
          }
        }
      });
    }

    setTraceResult({
      mode,
      targetId: target,
      nodeIds: visitedNodes,
      edgeIds: visitedEdges,
      blastAffectedCount: visitedNodes.size - 1
    });
  }, [renderedConnections, sceneLayout]);

  const handleClearTrace = useCallback(() => {
    setTraceResult(null);
  }, []);

  // Loading State - Keep <span>Loading...</span> for unit-test compatibility
  if (isLoadingData) {
    return (
      <div className="loading-container" style={{ height: '100%' }}>
        <div className="loading-spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  // Empty State
  if (!rawHierarchy || !rawConnections || !sceneLayout) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <span className="empty-state-title">No twin data available.</span>
        <span className="empty-state-desc">Please wait for station data to load or check the connection.</span>
      </div>
    );
  }

  return (
    <HoverContext.Provider
      value={{
        hoveredName,
        hoveredAssociated: new Set(),
        selectedAssociated: new Set(),
        hoveredAncestors: new Set(),
        selectedAncestors: new Set(),
        activeLayer: null,
        componentsInteractable: true,
        connectionsInteractable: true,
        setHoveredName
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          {/* Top Mission Control Ribbon */}
          <ConnectionsStatsRibbon
            connections={renderedConnections}
            activeView={activeView}
            onChangeView={setActiveView}
            selectedMedium={selectedMedium}
            onSelectMedium={setSelectedMedium}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLight={isLight}
            liveStateRef={liveStateRef}
          />

          {/* Perspective View Content Area */}
          <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
            {activeView === 'schematic' ? (
              <>
                {/* Collapsible Sidebar */}
                <div
                  style={{
                    width: isLeftPanelOpen ? leftPanelWidth : 44,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    borderRight: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-panel)',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: isLight ? '2px 0 8px rgba(0,0,0,0.04)' : '4px 0 15px rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <ConnectionsList
                    connections={renderedConnections}
                    isSidebarOpen={isLeftPanelOpen}
                    onToggleSidebar={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                    activeFilterMedium={selectedMedium}
                    onSelectFilterMedium={setSelectedMedium}
                    liveStateRef={liveStateRef}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: -2,
                      bottom: 0,
                      width: '4px',
                      cursor: 'ew-resize',
                      zIndex: 50,
                      display: isLeftPanelOpen ? 'block' : 'none',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsResizingLeft(true);
                    }}
                  />
                </div>

                {/* Cytoscape Topology Graph */}
                <GraphContainer
                  root={sceneLayout.root}
                  connections={renderedConnections}
                  leftOffset={isLeftPanelOpen ? leftPanelWidth : 44}
                  selectedMedium={selectedMedium}
                  traceResult={traceResult}
                  onStartTrace={(m) => handleStartTrace(m)}
                  onClearTrace={handleClearTrace}
                  searchQuery={searchQuery}
                />
              </>
            ) : activeView === 'bus_architecture' ? (
              <SubsystemBusView
                root={sceneLayout.root}
                connections={renderedConnections}
                isLight={isLight}
                selectedMedium={selectedMedium}
                onSelectMedium={setSelectedMedium}
                searchQuery={searchQuery}
                onSelectComponent={(name) => {
                  setSelectedName(name);
                  setActiveView('schematic');
                }}
                onSwitchToSchematic={(blockName) => {
                  if (blockName) {
                    setSelectedName(blockName);
                    setSearchQuery(blockName);
                  }
                  setActiveView('schematic');
                }}
                onStartTrace={(mode, targetId) => {
                  setActiveView('schematic');
                  handleStartTrace(mode, targetId);
                }}
                liveStateRef={liveStateRef}
              />
            ) : (
              <DependencyMatrixView
                root={sceneLayout.root}
                connections={renderedConnections}
                isLight={isLight}
                onSelectConnection={(connId) => {
                  setSelectedName(connId);
                  setActiveView('schematic');
                }}
                onSwitchToSchematic={(blockName) => {
                  if (blockName) {
                    setSelectedName(blockName);
                    setSearchQuery(blockName);
                  }
                  setActiveView('schematic');
                }}
              />
            )}
          </div>
        </div>
    </HoverContext.Provider>
  );
}
