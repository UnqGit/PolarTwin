import React, { useState, useMemo } from 'react';
import {
  Zap, Thermometer, Radio, Droplets, Activity, Package, Cpu, Box,
  ArrowRight, ShieldCheck, AlertTriangle, ExternalLink, GitFork, Info,
  Search, X, Filter, RefreshCw, Layers, ChevronRight, CornerDownRight, CheckCircle2
} from 'lucide-react';
import { SUBSYSTEM_CONFIGS, DEFAULT_SUBSYSTEM, MEDIUM_CONFIGS, normalizeMedium } from './types';
import type { SubsystemTheme } from './types';
import type { NodeLayout, ConnectionLayout } from '../../lib/layout';

interface SubsystemBusViewProps {
  root: NodeLayout;
  connections: ConnectionLayout[];
  isLight: boolean;
  selectedMedium?: string;
  onSelectMedium?: (medium: string) => void;
  searchQuery?: string;
  onSelectComponent: (name: string) => void;
  onSwitchToSchematic: (focusNodeName?: string) => void;
  onStartTrace?: (mode: 'upstream' | 'downstream' | 'blast_radius', targetId?: string) => void;
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
}

export interface SubsystemInterconnect {
  id: string;
  source: string;
  target: string;
  connections: ConnectionLayout[];
  mediaCounts: Record<string, number>;
  primaryMedium: string;
  totalCount: number;
}

export const SubsystemBusView: React.FC<SubsystemBusViewProps> = ({
  root,
  connections,
  isLight,
  selectedMedium = 'all',
  onSelectMedium,
  searchQuery = '',
  onSelectComponent,
  onSwitchToSchematic,
  onStartTrace,
  liveStateRef
}) => {
  const [selectedSubsystem, setSelectedSubsystem] = useState<string | null>(null);
  const [hoveredSubsystem, setHoveredSubsystem] = useState<string | null>(null);
  const [selectedBus, setSelectedBus] = useState<SubsystemInterconnect | null>(null);
  const [hoveredBusId, setHoveredBusId] = useState<string | null>(null);
  const [hoverDirection, setHoverDirection] = useState<'all' | 'in' | 'out'>('all');

  // Floating tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    bus: SubsystemInterconnect;
  } | null>(null);

  // Drawer inner search & filter states
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerMediumFilter, setDrawerMediumFilter] = useState('all');
  const [activeSubsystemTab, setActiveSubsystemTab] = useState<'units' | 'trunks' | 'overview'>('units');

  // Map each component to its top-level block
  const nodeToBlockMap = useMemo(() => {
    const map = new Map<string, string>();
    function visit(n: NodeLayout, topParentName?: string) {
      const isTopLevel = !topParentName && root && n.name !== root.name;
      const currentTop = isTopLevel ? n.name : topParentName;
      if (currentTop) {
        map.set(n.name, currentTop);
      }
      for (const c of n.children) {
        visit(c, currentTop || n.name);
      }
    }
    if (root) {
      for (const child of root.children) {
        visit(child, child.name);
      }
    }
    return map;
  }, [root]);

  // Aggregate connections into inter-subsystem buses
  const buses = useMemo(() => {
    const busMap = new Map<string, ConnectionLayout[]>();

    connections.forEach(c => {
      const srcBlock = nodeToBlockMap.get(c.source) || 'General';
      const tgtBlock = nodeToBlockMap.get(c.target) || 'General';

      if (srcBlock !== tgtBlock) {
        const key = `${srcBlock}->${tgtBlock}`;
        const list = busMap.get(key) || [];
        list.push(c);
        busMap.set(key, list);
      }
    });

    const result: SubsystemInterconnect[] = [];
    busMap.forEach((conns, key) => {
      const [source, target] = key.split('->');
      const mediaCounts: Record<string, number> = {};
      conns.forEach(c => {
        const m = normalizeMedium(c.connectionType);
        mediaCounts[m] = (mediaCounts[m] || 0) + 1;
      });

      let maxCount = 0;
      let primaryMedium = 'data';
      Object.entries(mediaCounts).forEach(([m, count]) => {
        if (count > maxCount) {
          maxCount = count;
          primaryMedium = m;
        }
      });

      result.push({
        id: key,
        source,
        target,
        connections: conns,
        mediaCounts,
        primaryMedium,
        totalCount: conns.length,
      });
    });

    return result;
  }, [connections, nodeToBlockMap]);

  // Subsystem block layout coordinates on a clean grid
  const blockPositions: Record<string, { x: number; y: number }> = {
    EnergyBlock:        { x: 180, y: 150 },
    HVACBlock:          { x: 550, y: 150 },
    ControlBlock:       { x: 920, y: 150 },
    InventoryBlock:     { x: 180, y: 490 },
    WaterAndWasteBlock: { x: 550, y: 490 },
    ResearchBlock:      { x: 920, y: 490 },
  };

  // Find components inside a subsystem
  const subsystemComponents = useMemo(() => {
    const comps: Record<string, string[]> = {};
    nodeToBlockMap.forEach((block, nodeName) => {
      if (!comps[block]) comps[block] = [];
      comps[block].push(nodeName);
    });
    return comps;
  }, [nodeToBlockMap]);

  // Live telemetry metrics
  const live = liveStateRef?.current || {};

  // For a given subsystem, calculate inbound/outbound buses and stats
  const subsystemStats = useMemo(() => {
    const stats: Record<string, {
      inbound: SubsystemInterconnect[];
      outbound: SubsystemInterconnect[];
      totalInConns: number;
      totalOutConns: number;
      connectedPeers: Set<string>;
    }> = {};

    Object.keys(SUBSYSTEM_CONFIGS).forEach(key => {
      stats[key] = {
        inbound: [],
        outbound: [],
        totalInConns: 0,
        totalOutConns: 0,
        connectedPeers: new Set(),
      };
    });

    buses.forEach(b => {
      if (stats[b.source]) {
        stats[b.source].outbound.push(b);
        stats[b.source].totalOutConns += b.totalCount;
        stats[b.source].connectedPeers.add(b.target);
      }
      if (stats[b.target]) {
        stats[b.target].inbound.push(b);
        stats[b.target].totalInConns += b.totalCount;
        stats[b.target].connectedPeers.add(b.source);
      }
    });

    return stats;
  }, [buses]);

  // Active highlighted subsystem (either hovered or selected)
  const activeSubsystem = hoveredSubsystem || selectedSubsystem;

  // Connected peers of active subsystem
  const activePeers = useMemo(() => {
    if (!activeSubsystem || !subsystemStats[activeSubsystem]) return new Set<string>();
    return subsystemStats[activeSubsystem].connectedPeers;
  }, [activeSubsystem, subsystemStats]);

  // Determine if a bus is matched by the selectedMedium filter
  const isBusMatchingMedium = (bus: SubsystemInterconnect) => {
    if (!selectedMedium || selectedMedium === 'all') return true;
    return (bus.mediaCounts[selectedMedium] || 0) > 0;
  };

  // Check if bus is highlighted by active subsystem
  const isBusHighlighted = (bus: SubsystemInterconnect) => {
    if (hoveredBusId === bus.id || selectedBus?.id === bus.id) return true;
    if (!activeSubsystem) return false;
    if (hoverDirection === 'in') return bus.target === activeSubsystem;
    if (hoverDirection === 'out') return bus.source === activeSubsystem;
    return bus.source === activeSubsystem || bus.target === activeSubsystem;
  };

  const isBusDimmed = (bus: SubsystemInterconnect) => {
    if (!isBusMatchingMedium(bus)) return true;
    if (activeSubsystem) {
      return !isBusHighlighted(bus);
    }
    if (hoveredBusId) {
      return hoveredBusId !== bus.id;
    }
    return false;
  };

  // Filtered connections for the selected bus drawer
  const drawerBusConnections = useMemo(() => {
    if (!selectedBus) return [];
    let list = selectedBus.connections;
    if (drawerMediumFilter !== 'all') {
      list = list.filter(c => normalizeMedium(c.connectionType) === drawerMediumFilter);
    }
    if (drawerSearch.trim()) {
      const q = drawerSearch.toLowerCase().trim();
      list = list.filter(c =>
        c.source.toLowerCase().includes(q) ||
        c.target.toLowerCase().includes(q) ||
        (c.relation && c.relation.toLowerCase().includes(q)) ||
        (c.connectionType && c.connectionType.toLowerCase().includes(q))
      );
    }
    return list;
  }, [selectedBus, drawerMediumFilter, drawerSearch]);

  // Filtered components for selected subsystem drawer
  const drawerSubsystemComponents = useMemo(() => {
    if (!selectedSubsystem) return [];
    const comps = subsystemComponents[selectedSubsystem] || [];
    if (!drawerSearch.trim()) return comps;
    const q = drawerSearch.toLowerCase().trim();
    return comps.filter(c => c.toLowerCase().includes(q));
  }, [selectedSubsystem, subsystemComponents, drawerSearch]);

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: isLight ? '#f8fafc' : 'var(--bg-main)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Mission Control Header Bar ─── */}
      <div
        style={{
          padding: '10px 20px',
          background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15, 21, 37, 0.85)',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          zIndex: 20,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Title & Description */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(80, 219, 192, 0.15)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(80, 219, 192, 0.2)',
            }}
          >
            <GitFork size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Subsystem Interconnect Bus Architecture</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(56, 217, 245, 0.15)',
                  color: '#38d9f5',
                }}
              >
                {buses.length} Macro Trunks
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Interactive transmission conduits & telemetry highways linking polar facility modules
            </div>
          </div>
        </div>

        {/* Medium Filter Pills Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectMedium && onSelectMedium('all')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              border: selectedMedium === 'all'
                ? '1px solid var(--accent-primary)'
                : isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
              background: selectedMedium === 'all'
                ? (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(80, 219, 192, 0.15)')
                : (isLight ? '#ffffff' : 'rgba(255,255,255,0.03)'),
              color: selectedMedium === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Trunks
          </button>

          {Object.entries(MEDIUM_CONFIGS).map(([mKey, conf]) => {
            if (mKey === 'resource') return null; // Deduplicate resource/fluid
            const Icon = conf.icon;
            const isMatch = selectedMedium === mKey || (selectedMedium === 'fluid' && mKey === 'resource');

            return (
              <button
                key={mKey}
                onClick={() => onSelectMedium && onSelectMedium(isMatch ? 'all' : mKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: isMatch
                    ? `1px solid ${conf.color}`
                    : isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
                  background: isMatch
                    ? `${conf.color}22`
                    : (isLight ? '#ffffff' : 'rgba(255,255,255,0.03)'),
                  color: isMatch ? (isLight ? conf.lightColor : conf.color) : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={12} color={conf.color} />
                <span>{conf.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Interactive Diagram Canvas ─── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          minWidth: 1100,
          minHeight: 700,
          padding: 24,
          userSelect: 'none',
        }}
        onClick={(e) => {
          // Deselect when clicking canvas background
          if ((e.target as HTMLElement).tagName === 'DIV' && (e.target as HTMLElement).getAttribute('data-canvas-bg')) {
            setSelectedSubsystem(null);
            setSelectedBus(null);
          }
        }}
        data-canvas-bg="true"
      >
        {/* Background Grid Accent */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: isLight
              ? 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)'
              : 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            pointerEvents: 'none',
          }}
        />

        {/* ─── SVG Bus Conduit Layer ─── */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <defs>
            {/* Conduit Glow Filters */}
            <filter id="bus-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Directional Flow Arrow Markers */}
            {Object.entries(MEDIUM_CONFIGS).map(([k, conf]) => (
              <marker
                key={`arrow-${k}`}
                id={`arrow-${k}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={conf.color} />
              </marker>
            ))}
          </defs>

          {/* Render All Interconnect Conduits */}
          {buses.map((bus) => {
            const srcPos = blockPositions[bus.source] || { x: 500, y: 300 };
            const tgtPos = blockPositions[bus.target] || { x: 500, y: 300 };

            const isSelected = selectedBus?.id === bus.id;
            const isHovered = hoveredBusId === bus.id;
            const isHighlighted = isBusHighlighted(bus);
            const isDimmed = isBusDimmed(bus);

            const medConf = MEDIUM_CONFIGS[bus.primaryMedium] || MEDIUM_CONFIGS.data;
            const strokeColor = isSelected ? 'var(--accent-primary)' : medConf.color;

            // Curve calculation for pleasant routing
            const dx = tgtPos.x - srcPos.x;
            const dy = tgtPos.y - srcPos.y;
            const cx = (srcPos.x + tgtPos.x) / 2 + (dy !== 0 ? (dx === 0 ? 35 : 0) : 0);
            const cy = (srcPos.y + tgtPos.y) / 2 + (dx !== 0 ? (dy === 0 ? -30 : 0) : 0);

            const pathD = `M ${srcPos.x} ${srcPos.y} Q ${cx} ${cy} ${tgtPos.x} ${tgtPos.y}`;

            const baseWidth = Math.max(3, Math.min(8, bus.totalCount * 0.9));
            const currentStrokeWidth = isSelected ? 6.5 : isHovered || isHighlighted ? 5 : baseWidth;
            const currentOpacity = isDimmed ? 0.08 : (isSelected ? 1 : isHovered || isHighlighted ? 0.95 : 0.55);

            return (
              <g
                key={bus.id}
                style={{
                  transition: 'opacity 0.25s ease',
                  opacity: currentOpacity,
                }}
              >
                {/* 1. FAT INVISIBLE HITBOX for effortless hover & click */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={32}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    setHoveredBusId(bus.id);
                    setTooltip({ x: e.clientX, y: e.clientY, bus });
                  }}
                  onMouseMove={(e) => {
                    setTooltip({ x: e.clientX, y: e.clientY, bus });
                  }}
                  onMouseLeave={() => {
                    setHoveredBusId(null);
                    setTooltip(null);
                  }}
                  onClick={() => {
                    setSelectedBus(bus);
                    setSelectedSubsystem(null);
                  }}
                />

                {/* 2. OUTER GLOW AURA (when active) */}
                {(isSelected || isHovered || isHighlighted) && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={currentStrokeWidth + 8}
                    strokeOpacity={0.35}
                    filter="url(#bus-glow)"
                    strokeLinecap="round"
                  />
                )}

                {/* 3. CORE TRANSMISSION CONDUIT */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={currentStrokeWidth}
                  strokeOpacity={0.9}
                  strokeLinecap="round"
                  markerEnd={`url(#arrow-${bus.primaryMedium})`}
                />

                {/* 4. ANIMATED PARTICLE FLOW DASHES */}
                {!isDimmed && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isLight ? '#ffffff' : '#ffffff'}
                    strokeWidth={2}
                    strokeDasharray="6 14"
                    strokeOpacity={isHovered || isSelected || isHighlighted ? 0.9 : 0.6}
                    style={{
                      animation: isHovered || isSelected ? 'dashMove 1.2s linear infinite' : 'dashMove 2.2s linear infinite',
                    }}
                  />
                )}

                {/* 5. INTERACTIVE MIDPOINT BADGE */}
                <foreignObject
                  x={cx - 42}
                  y={cy - 14}
                  width={84}
                  height={28}
                  style={{ overflow: 'visible', pointerEvents: 'auto' }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBus(bus);
                      setSelectedSubsystem(null);
                    }}
                    onMouseEnter={(e) => {
                      setHoveredBusId(bus.id);
                      setTooltip({ x: e.clientX, y: e.clientY, bus });
                    }}
                    onMouseLeave={() => {
                      setHoveredBusId(null);
                      setTooltip(null);
                    }}
                    style={{
                      background: isSelected
                        ? 'var(--accent-primary)'
                        : isLight ? '#ffffff' : 'rgba(15, 21, 37, 0.95)',
                      border: isSelected
                        ? '2px solid #ffffff'
                        : `1.5px solid ${strokeColor}`,
                      borderRadius: 'var(--radius-full)',
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: isSelected ? '#030A0F' : (isLight ? '#030A0F' : strokeColor),
                      textAlign: 'center',
                      boxShadow: isSelected
                        ? '0 0 16px var(--accent-primary)'
                        : '0 3px 10px rgba(0,0,0,0.4)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <span>{bus.totalCount} lines</span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* ─── Interactive Subsystem Blocks ─── */}
        {Object.entries(SUBSYSTEM_CONFIGS).map(([blockKey, theme]) => {
          const pos = blockPositions[blockKey];
          if (!pos) return null;

          const Icon = theme.icon;
          const comps = subsystemComponents[blockKey] || [];
          const isSelected = selectedSubsystem === blockKey;
          const isHovered = hoveredSubsystem === blockKey;
          const isPeerActive = activePeers.has(blockKey);
          const isDimmed = activeSubsystem && activeSubsystem !== blockKey && !isPeerActive;

          const stats = subsystemStats[blockKey] || { totalInConns: 0, totalOutConns: 0, inbound: [], outbound: [] };

          // Live power / thermal metrics
          let blockWatts = 0;
          let degradedCount = 0;
          comps.forEach(cName => {
            const st = (live as any)[cName];
            if (st?.power_w) blockWatts += st.power_w;
            if (st?.status === 'fault' || st?.status === 'failure') degradedCount++;
          });

          return (
            <div
              key={blockKey}
              onClick={() => {
                setSelectedSubsystem(isSelected ? null : blockKey);
                setSelectedBus(null);
                setDrawerSearch('');
              }}
              onMouseEnter={() => setHoveredSubsystem(blockKey)}
              onMouseLeave={() => {
                setHoveredSubsystem(null);
                setHoverDirection('all');
              }}
              style={{
                position: 'absolute',
                left: pos.x - 125,
                top: pos.y - 75,
                width: 250,
                borderRadius: 'var(--radius-xl)',
                background: isLight ? '#ffffff' : 'rgba(15, 21, 37, 0.95)',
                border: isSelected
                  ? `2px solid ${theme.color}`
                  : isPeerActive
                    ? `1.5px dashed ${theme.color}`
                    : isLight ? '1px solid #cbd5e1' : `1px solid ${theme.borderDark}`,
                boxShadow: isSelected
                  ? `0 0 28px ${theme.color}55, 0 8px 30px rgba(0,0,0,0.4)`
                  : isHovered
                    ? `0 0 20px ${theme.color}33, 0 6px 20px rgba(0,0,0,0.3)`
                    : isLight ? '0 4px 14px rgba(0,0,0,0.06)' : '0 8px 24px rgba(0,0,0,0.4)',
                padding: '14px 16px',
                cursor: 'pointer',
                zIndex: isSelected || isHovered ? 15 : 10,
                opacity: isDimmed ? 0.35 : 1,
                transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                transition: 'all 0.22s cubic-bezier(0.2, 0, 0, 1)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Header with Icon, Name & Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-md)',
                      background: theme.bgDark,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.color,
                      boxShadow: `0 0 10px ${theme.color}33`,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {theme.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {theme.category}
                    </div>
                  </div>
                </div>

                {degradedCount > 0 ? (
                  <span
                    style={{
                      color: '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: 'rgba(248, 113, 113, 0.12)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    title={`${degradedCount} faulted units`}
                  >
                    <AlertTriangle size={12} />
                    <span>{degradedCount}</span>
                  </span>
                ) : (
                  <span
                    style={{
                      color: '#4ade80',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 10,
                      fontWeight: 600,
                      background: 'rgba(74, 222, 128, 0.12)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    title="All Nominal"
                  >
                    <ShieldCheck size={12} />
                    <span>Nominal</span>
                  </span>
                )}
              </div>

              {/* Tag / Description */}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.3 }}>
                {theme.tag}
              </div>

              {/* Inbound & Outbound Conduits Interactive Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredSubsystem(blockKey);
                    setHoverDirection('in');
                  }}
                  onMouseLeave={() => setHoverDirection('all')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '3px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Hover to highlight inbound incoming lines"
                >
                  <span style={{ color: '#38d9f5' }}>⬇ In:</span>
                  <span>{stats.totalInConns} lines</span>
                </span>

                <span
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredSubsystem(blockKey);
                    setHoverDirection('out');
                  }}
                  onMouseLeave={() => setHoverDirection('all')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '3px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Hover to highlight outgoing outbound lines"
                >
                  <span style={{ color: '#f59e0b' }}>⬆ Out:</span>
                  <span>{stats.totalOutConns} lines</span>
                </span>
              </div>

              {/* Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.06)',
                  fontSize: 11,
                }}
              >
                <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
                  {comps.length} units {blockWatts > 0 ? `· ${(blockWatts/1000).toFixed(1)} kW` : ''}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwitchToSchematic(blockKey);
                    }}
                    title="Focus in 2D Component Schematic"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: theme.bgDark,
                      color: isLight ? theme.lightColor : theme.color,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>Schematic</span>
                    <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Floating Hover Conduit Tooltip HUD ─── */}
      {tooltip && !selectedBus && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(window.innerWidth - 260, tooltip.x + 16),
            top: Math.min(window.innerHeight - 160, tooltip.y + 16),
            width: 250,
            background: isLight ? '#ffffff' : 'rgba(12, 17, 30, 0.96)',
            border: `1.5px solid ${MEDIUM_CONFIGS[tooltip.bus.primaryMedium]?.color || 'var(--accent-primary)'}`,
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            padding: '12px 14px',
            zIndex: 100,
            pointerEvents: 'none',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{tooltip.bus.source}</span>
              <ArrowRight size={12} color="var(--accent-primary)" />
              <span>{tooltip.bus.target}</span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--accent-primary)',
                background: 'rgba(80, 219, 192, 0.15)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {tooltip.bus.totalCount} lines
            </span>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Macro trunk carrying high-throughput transmission lines
          </div>

          {/* Breakdown chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {Object.entries(tooltip.bus.mediaCounts).map(([mKey, count]) => {
              const conf = MEDIUM_CONFIGS[mKey] || MEDIUM_CONFIGS.data;
              const Icon = conf.icon;
              return (
                <span
                  key={mKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: `${conf.color}22`,
                    color: isLight ? conf.lightColor : conf.color,
                  }}
                >
                  <Icon size={10} color={conf.color} />
                  <span>{count}x {conf.label.split(' ')[0]}</span>
                </span>
              );
            })}
          </div>

          <div style={{ fontSize: 9, color: 'var(--accent-primary)', fontStyle: 'italic', textAlign: 'right' }}>
            Click trunk to inspect constituent wires & pipes →
          </div>
        </div>
      )}

      {/* ─── Slide-Up / Dedicated Interactive Drawer ─── */}
      {(selectedBus || selectedSubsystem) && (
        <div
          className="slide-in-up"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: 320,
            background: isLight ? '#ffffff' : 'rgba(12, 17, 30, 0.98)',
            borderTop: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
            zIndex: 50,
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* ═════════ BUS INSPECTOR MODE ═════════ */}
          {selectedBus ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-md)',
                      background: `${MEDIUM_CONFIGS[selectedBus.primaryMedium]?.color || 'var(--accent-primary)'}22`,
                      color: MEDIUM_CONFIGS[selectedBus.primaryMedium]?.color || 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GitFork size={18} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Interconnect Trunk: {selectedBus.source} ➔ {selectedBus.target}
                      </span>
                      <span
                        style={{
                          background: 'rgba(80, 219, 192, 0.15)',
                          color: 'var(--accent-primary)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {selectedBus.totalCount} Lines Bundled
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Click any individual conduit below to focus and inspect it in the 2D Schematic
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {onStartTrace && (
                    <button
                      onClick={() => onStartTrace('downstream', selectedBus.source)}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>Trace Trunk Circuit</span>
                      <ChevronRight size={12} />
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedBus(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 20,
                      padding: '4px 8px',
                    }}
                    title="Close"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Sub-Filters: Search & Medium Filter inside Bus */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexShrink: 0 }}>
                {/* Search */}
                <div style={{ position: 'relative', width: 240 }}>
                  <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Filter connections in trunk..."
                    value={drawerSearch}
                    onChange={(e) => setDrawerSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '5px 8px 5px 28px',
                      borderRadius: 'var(--radius-md)',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
                      background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                  {drawerSearch && (
                    <button
                      onClick={() => setDrawerSearch('')}
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Medium Chips in Drawer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => setDrawerMediumFilter('all')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 10,
                      fontWeight: 600,
                      border: drawerMediumFilter === 'all' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      background: drawerMediumFilter === 'all' ? 'rgba(80, 219, 192, 0.15)' : 'transparent',
                      color: drawerMediumFilter === 'all' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    All ({selectedBus.totalCount})
                  </button>
                  {Object.entries(selectedBus.mediaCounts).map(([mKey, count]) => {
                    const conf = MEDIUM_CONFIGS[mKey] || MEDIUM_CONFIGS.data;
                    const isActive = drawerMediumFilter === mKey;
                    return (
                      <button
                        key={mKey}
                        onClick={() => setDrawerMediumFilter(isActive ? 'all' : mKey)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 10,
                          fontWeight: 600,
                          border: isActive ? `1px solid ${conf.color}` : '1px solid transparent',
                          background: isActive ? `${conf.color}22` : 'transparent',
                          color: isActive ? conf.color : 'var(--text-tertiary)',
                          cursor: 'pointer',
                        }}
                      >
                        {conf.label.split(' ')[0]} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conduits List in this bus */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, paddingBottom: 8 }}>
                {drawerBusConnections.map(c => {
                  const m = normalizeMedium(c.connectionType);
                  const conf = MEDIUM_CONFIGS[m] || MEDIUM_CONFIGS.data;
                  const Icon = conf.icon;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectComponent(c.id);
                        onSwitchToSchematic(c.id);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 'var(--radius-sm)',
                            background: `${conf.color}22`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={12} color={conf.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {c.source} <span style={{ color: 'var(--text-tertiary)' }}>→</span> {c.target}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'lowercase' }}>
                            {c.relation || c.connectionType}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: `${conf.color}22`,
                            color: isLight ? conf.lightColor : conf.color,
                            fontWeight: 700,
                          }}
                        >
                          {c.connectionType}
                        </span>
                        <ExternalLink size={11} color="var(--text-tertiary)" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : selectedSubsystem ? (
            /* ═════════ SUBSYSTEM INSPECTOR MODE ═════════ */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-md)',
                      background: SUBSYSTEM_CONFIGS[selectedSubsystem]?.bgDark || 'rgba(80, 219, 192, 0.15)',
                      color: SUBSYSTEM_CONFIGS[selectedSubsystem]?.color || 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Layers size={18} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Subsystem: {SUBSYSTEM_CONFIGS[selectedSubsystem]?.title || selectedSubsystem}
                      </span>
                      <span
                        style={{
                          background: 'rgba(80, 219, 192, 0.15)',
                          color: 'var(--accent-primary)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {(subsystemComponents[selectedSubsystem] || []).length} Units
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {SUBSYSTEM_CONFIGS[selectedSubsystem]?.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {onStartTrace && (
                    <button
                      onClick={() => onStartTrace('blast_radius', selectedSubsystem)}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Simulate complete outage impact of this subsystem"
                    >
                      <AlertTriangle size={12} />
                      <span>Simulate Blast Radius</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSwitchToSchematic(selectedSubsystem)}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>Focus in 2D Schematic</span>
                    <ExternalLink size={12} />
                  </button>

                  <button
                    onClick={() => setSelectedSubsystem(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 20,
                      padding: '4px 8px',
                    }}
                    title="Close"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Subsystem Navigation Tabs & Search */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexShrink: 0 }}>
                {/* Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => setActiveSubsystemTab('units')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 11,
                      fontWeight: 700,
                      border: activeSubsystemTab === 'units' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      background: activeSubsystemTab === 'units' ? 'rgba(80, 219, 192, 0.15)' : 'transparent',
                      color: activeSubsystemTab === 'units' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Internal Units ({(subsystemComponents[selectedSubsystem] || []).length})
                  </button>

                  <button
                    onClick={() => setActiveSubsystemTab('trunks')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 11,
                      fontWeight: 700,
                      border: activeSubsystemTab === 'trunks' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      background: activeSubsystemTab === 'trunks' ? 'rgba(80, 219, 192, 0.15)' : 'transparent',
                      color: activeSubsystemTab === 'trunks' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Connected Trunks ({((subsystemStats[selectedSubsystem]?.inbound.length || 0) + (subsystemStats[selectedSubsystem]?.outbound.length || 0))})
                  </button>
                </div>

                {/* Filter search */}
                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search units in block..."
                    value={drawerSearch}
                    onChange={(e) => setDrawerSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px 8px 4px 28px',
                      borderRadius: 'var(--radius-md)',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
                      background: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
                {activeSubsystemTab === 'units' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                    {drawerSubsystemComponents.map(comp => {
                      const st = (live as any)[comp];
                      const isFault = st?.status === 'fault' || st?.status === 'failure';
                      const watts = st?.power_w;

                      return (
                        <div
                          key={comp}
                          onClick={() => {
                            onSelectComponent(comp);
                            onSwitchToSchematic(comp);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-md)',
                            background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: isFault ? '#f87171' : '#4ade80',
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {comp}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {watts !== undefined && (
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                {watts}W
                              </span>
                            )}
                            <ExternalLink size={10} color="var(--text-tertiary)" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Connected Trunks Tab */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {/* Inbound trunks */}
                    {(subsystemStats[selectedSubsystem]?.inbound || []).map(b => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBus(b)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 10, color: '#38d9f5', fontWeight: 700 }}>INBOUND FEED</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {b.source} ➔ {b.target}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)' }}>
                          {b.totalCount} lines →
                        </span>
                      </div>
                    ))}

                    {/* Outbound trunks */}
                    {(subsystemStats[selectedSubsystem]?.outbound || []).map(b => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBus(b)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>OUTBOUND TRUNK</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {b.source} ➔ {b.target}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)' }}>
                          {b.totalCount} lines →
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
