import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStation } from '../components/StationContext';
import { useTheme } from '../components/ThemeContext';
import {
  ChevronRight, ChevronLeft, Info, Box, Layers, Activity, Search, X,
  Zap, Thermometer, Radio, Droplets, Package, Cpu,
  LayoutGrid, List, RefreshCw, Gauge, FolderOpen, Network, Compass
} from 'lucide-react';
import { PropertyInspector } from '../components/PropertyInspector';
import { TypeIcon } from '../components/TypeIcon';
import { buildSceneLayout } from '../lib/layout';
import { IMAGE_MAP } from '../lib/constants';
import { Footer } from '../components/Footer';

/* ═══════════════════════════════════════════════════════
   SUBSYSTEM DEFINITIONS & THEMING
   ═══════════════════════════════════════════════════════ */
interface SubsystemTheme {
  id: string;
  name: string;
  title: string;
  icon: any;
  color: string;
  lightColor: string;
  bgDark: string;
  bgLight: string;
  borderDark: string;
  borderLight: string;
  tag: string;
  category: string;
}

const SUBSYSTEM_CONFIGS: Record<string, SubsystemTheme> = {
  EnergyBlock: {
    id: 'EnergyBlock',
    name: 'EnergyBlock',
    title: 'Energy & Power Grid',
    icon: Zap,
    color: '#f8d57e',
    lightColor: '#b45309',
    bgDark: 'rgba(248, 213, 126, 0.12)',
    bgLight: '#fef3c7',
    borderDark: 'rgba(248, 213, 126, 0.32)',
    borderLight: '#fde68a',
    tag: 'Primary 400V AC Bus',
    category: 'Power Infrastructure',
  },
  HVACBlock: {
    id: 'HVACBlock',
    name: 'HVACBlock',
    title: 'HVAC & Life Support',
    icon: Thermometer,
    color: '#38d9f5',
    lightColor: '#0284c7',
    bgDark: 'rgba(56, 217, 245, 0.12)',
    bgLight: '#e0f2fe',
    borderDark: 'rgba(56, 217, 245, 0.32)',
    borderLight: '#bae6fd',
    tag: 'Atmospheric Envelope',
    category: 'Habitability & Thermal',
  },
  ControlBlock: {
    id: 'ControlBlock',
    name: 'ControlBlock',
    title: 'Central SCADA & Comms',
    icon: Radio,
    color: '#a78bfa',
    lightColor: '#7c3aed',
    bgDark: 'rgba(167, 139, 250, 0.12)',
    bgLight: '#ede9fe',
    borderDark: 'rgba(167, 139, 250, 0.32)',
    borderLight: '#ddd6fe',
    tag: 'Telemetry & Modbus',
    category: 'Command & Avionics',
  },
  WaterAndWasteBlock: {
    id: 'WaterAndWasteBlock',
    name: 'WaterAndWasteBlock',
    title: 'Water & Fluid Systems',
    icon: Droplets,
    color: '#60a5fa',
    lightColor: '#2563eb',
    bgDark: 'rgba(96, 165, 250, 0.12)',
    bgLight: '#dbeafe',
    borderDark: 'rgba(96, 165, 250, 0.32)',
    borderLight: '#bfdbfe',
    tag: 'Closed Fluid Loop',
    category: 'Consumables & Hydrology',
  },
  ResearchBlock: {
    id: 'ResearchBlock',
    name: 'ResearchBlock',
    title: 'Research & Science Labs',
    icon: Activity,
    color: '#50dbc0',
    lightColor: '#059669',
    bgDark: 'rgba(80, 219, 192, 0.12)',
    bgLight: '#d1fae5',
    borderDark: 'rgba(80, 219, 192, 0.32)',
    borderLight: '#a7f3d0',
    tag: 'Payload & Sensors',
    category: 'Polar Science',
  },
  InventoryBlock: {
    id: 'InventoryBlock',
    name: 'InventoryBlock',
    title: 'Inventory & Cryo Fuel',
    icon: Package,
    color: '#fb923c',
    lightColor: '#ea580c',
    bgDark: 'rgba(251, 146, 60, 0.12)',
    bgLight: '#ffedd5',
    borderDark: 'rgba(251, 146, 60, 0.32)',
    borderLight: '#fed7aa',
    tag: 'Mission Reserves',
    category: 'Logistics & Fuel',
  },
};

const DEFAULT_SUBSYSTEM: SubsystemTheme = {
  id: 'General',
  name: 'General',
  title: 'Auxiliary Subsystem',
  icon: Cpu,
  color: 'var(--accent-primary)',
  lightColor: '#0284c7',
  bgDark: 'rgba(99, 219, 188, 0.1)',
  bgLight: '#f0f9ff',
  borderDark: 'rgba(99, 219, 188, 0.25)',
  borderLight: '#e0f2fe',
  tag: 'Auxiliary Node',
  category: 'General Infrastructure',
};

/* ═══════════════════════════════════════════════════════
   STYLING & KEYFRAMES
   ═══════════════════════════════════════════════════════ */
const PAGE_STYLES = `
  @keyframes cardSlideIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseGlowGreen {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5); }
    50% { box-shadow: 0 0 0 5px rgba(74, 222, 128, 0); }
  }
  @keyframes pulseGlowAmber {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
    50% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0); }
  }
  @keyframes pulseGlowRed {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
    50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  }
  .comp-hub-card {
    transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.22s ease, border-color 0.22s ease;
  }
  .comp-hub-card:hover {
    transform: translateY(-3px);
  }
  .action-btn-pill {
    transition: all 0.15s ease;
  }
  .action-btn-pill:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }
  .subsystem-tab-btn {
    transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .subsystem-tab-btn:hover {
    filter: brightness(1.08);
  }
`;

/* ═══════════════════════════════════════════════════════
   HELPER FORMATTERS
   ═══════════════════════════════════════════════════════ */
function formatWatts(w: number | null | undefined): string {
  if (w === null || w === undefined || isNaN(w)) return '--';
  if (Math.abs(w) >= 1000000) return `${(w / 1000000).toFixed(2)} MW`;
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(1)} kW`;
  return `${w.toFixed(0)} W`;
}

function formatTemp(t: number | null | undefined): string {
  if (t === null || t === undefined || isNaN(t)) return '--';
  return `${t.toFixed(1)}°C`;
}

/* ═══════════════════════════════════════════════════════
   SUBSYSTEM DETECTOR
   ═══════════════════════════════════════════════════════ */
function resolveSubsystemKey(nodeName: string, hierarchy: any[]): string {
  if (SUBSYSTEM_CONFIGS[nodeName]) return nodeName;
  const visited = new Set<string>();
  let curr = hierarchy.find((n: any) => n.name === nodeName);

  while (curr && curr.parent && !visited.has(curr.name)) {
    visited.add(curr.name);
    if (SUBSYSTEM_CONFIGS[curr.parent]) {
      return curr.parent;
    }
    if (SUBSYSTEM_CONFIGS[curr.name]) {
      return curr.name;
    }
    curr = hierarchy.find((n: any) => n.name === curr.parent);
  }
  return 'General';
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export function ComponentsPage() {
  const { selectedStation, hierarchy: hierarchyData, spec, connections, liveStateRef } = useStation();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const location = useLocation();
  const navigate = useNavigate();

  // State
  const [drillStack, setDrillStack] = useState<string[]>(location.state?.drillStack || []);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const [inspectNodeName, setInspectNodeName] = useState<string | null>(location.state?.inspectNodeName || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubsystemFilter, setSelectedSubsystemFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'warning' | 'failure' | 'inactive'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'subsystem' | 'power' | 'status'>('subsystem');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Ticker to re-evaluate live metrics periodically
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => (t + 1) % 1000);
    }, 800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (location.state?.drillStack) setDrillStack(location.state.drillStack);
    if (location.state?.inspectNodeName) setInspectNodeName(location.state.inspectNodeName);
  }, [location.state]);

  const currentParentName = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  // Scene layout for inspector
  const sceneLayout = useMemo(() => {
    if (!hierarchyData || !spec) return null;
    try {
      return buildSceneLayout(hierarchyData, connections || [], spec);
    } catch (e) {
      console.error('Failed to build layout:', e);
      return null;
    }
  }, [hierarchyData, connections, spec]);

  // Topology connections count map
  const connectionsCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    if (connections && Array.isArray(connections)) {
      connections.forEach((c: any) => {
        counts[c.source] = (counts[c.source] || 0) + 1;
        counts[c.target] = (counts[c.target] || 0) + 1;
      });
    }
    return counts;
  }, [connections]);

  /* ── Evaluate Live Component Data ──────────────────────────────── */
  const resolveComponentLive = (node: any) => {
    const live = liveStateRef?.current || {};
    const rawLive = (live as any)[node.name] || (live as any)?.components?.[node.name] || {};

    let status: 'active' | 'warning' | 'failure' | 'inactive' = 'active';
    let statusLabel = 'NOMINAL';

    if (node.type === 'sensor array' && node.groupedSensors) {
      const activeCount = node.groupedSensors.filter((s: any) => {
        const st = (live as any)[s.name];
        return st && (st.running || String(st.status).toLowerCase() === 'active');
      }).length;
      const total = node.groupedSensors.length;
      if (activeCount === total) {
        status = 'active';
        statusLabel = `${activeCount}/${total} ACTIVE`;
      } else if (activeCount > 0) {
        status = 'warning';
        statusLabel = `${activeCount}/${total} DEGRADED`;
      } else {
        status = 'failure';
        statusLabel = `0/${total} FAULT`;
      }
    } else if (rawLive.status) {
      const s = String(rawLive.status).toLowerCase();
      if (['failure', 'error', 'alarm', 'critical', 'fault'].includes(s)) {
        status = 'failure';
        statusLabel = 'CRITICAL FAULT';
      } else if (['warning', 'degraded', 'caution', 'alert'].includes(s)) {
        status = 'warning';
        statusLabel = 'DEGRADED';
      } else if (['inactive', 'off', 'standby', 'disabled'].includes(s)) {
        status = 'inactive';
        statusLabel = 'STANDBY';
      } else {
        status = 'active';
        statusLabel = 'NOMINAL';
      }
    }

    // Power
    let powerWatts: number | null = null;
    if (typeof rawLive.power === 'number') powerWatts = rawLive.power;
    else if (typeof rawLive.wattage === 'number') powerWatts = rawLive.wattage;
    else if (typeof rawLive.power_draw === 'number') powerWatts = rawLive.power_draw;
    else if (typeof rawLive.power_output === 'number') powerWatts = rawLive.power_output;
    else if (typeof rawLive.consumption === 'number') powerWatts = rawLive.consumption;
    else if (node.spec?.rating?.output?.power?.max) powerWatts = Number(node.spec.rating.output.power.max) * 1000;
    else if (node.spec?.rating?.input?.power?.max) powerWatts = Number(node.spec.rating.input.power.max) * 1000;

    // Temperature
    let temperatureC: number | null = null;
    if (typeof rawLive.temperature === 'number') temperatureC = rawLive.temperature;
    else if (typeof rawLive.temp === 'number') temperatureC = rawLive.temp;
    else if (typeof rawLive.temp_c === 'number') temperatureC = rawLive.temp_c;
    else if (typeof rawLive.temperature?.output === 'number') temperatureC = rawLive.temperature.output;
    else if (node.spec?.rating?.state?.temperature?.max) {
      const min = Number(node.spec.rating.state.temperature.min || 15);
      const max = Number(node.spec.rating.state.temperature.max || 25);
      temperatureC = (min + max) / 2;
    }

    // Secondary Metric
    let secondaryMetric: { label: string; value: string } | null = null;
    if (rawLive.flowrate !== undefined) {
      secondaryMetric = { label: 'Flow', value: `${Number(rawLive.flowrate).toFixed(1)} L/h` };
    } else if (rawLive.voltage !== undefined) {
      secondaryMetric = { label: 'Bus', value: `${Number(rawLive.voltage).toFixed(0)} V` };
    } else if (rawLive.pressure !== undefined) {
      secondaryMetric = { label: 'Pressure', value: `${Number(rawLive.pressure).toFixed(1)} kPa` };
    } else if (rawLive.level !== undefined) {
      secondaryMetric = { label: 'Level', value: `${Number(rawLive.level).toFixed(0)} %` };
    } else if (rawLive.frequency !== undefined) {
      secondaryMetric = { label: 'Freq', value: `${Number(rawLive.frequency).toFixed(1)} Hz` };
    }

    const subsystemKey = resolveSubsystemKey(node.name, hierarchyData || []);
    const subsystemConfig = SUBSYSTEM_CONFIGS[subsystemKey] || DEFAULT_SUBSYSTEM;
    const connectionsCount = connectionsCountMap[node.name] || 0;

    return {
      status,
      statusLabel,
      powerWatts,
      temperatureC,
      secondaryMetric,
      subsystemKey,
      subsystemConfig,
      connectionsCount,
      childCount: node.children?.length || 0,
      isContainer: (node.children?.length || 0) > 0,
    };
  };

  /* ── Filtered & Sorted Display Nodes ────────────────────────────── */
  const { displayedNodes, fleetMetrics } = useMemo(() => {
    void tick;

    if (!hierarchyData || hierarchyData.length === 0) {
      return {
        displayedNodes: [],
        fleetMetrics: { total: 0, nominal: 0, warning: 0, failure: 0, inactive: 0, totalWatts: 0, healthIndex: 100 }
      };
    }

    let nodes: any[] = [];
    if (currentParentName === null) {
      const allNames = new Set(hierarchyData.map((n: any) => n.name));
      nodes = hierarchyData.filter((n: any) => !n.parent || !allNames.has(n.parent));
    } else {
      const parentNode = hierarchyData.find((n: any) => n.name === currentParentName);
      if (parentNode?.children) {
        nodes = hierarchyData.filter((n: any) => parentNode.children.includes(n.name));
      }
    }

    let enriched = nodes.map(n => ({
      ...n,
      telemetry: resolveComponentLive(n),
    }));

    let totalWatts = 0;
    let nominal = 0;
    let warning = 0;
    let failure = 0;
    let inactive = 0;

    enriched.forEach(item => {
      if (item.telemetry.powerWatts) totalWatts += item.telemetry.powerWatts;
      if (item.telemetry.status === 'active') nominal++;
      else if (item.telemetry.status === 'warning') warning++;
      else if (item.telemetry.status === 'failure') failure++;
      else if (item.telemetry.status === 'inactive') inactive++;
    });

    const total = enriched.length;
    const healthIndex = total > 0 ? Math.round(((nominal + warning * 0.5) / total) * 100) : 100;

    if (selectedSubsystemFilter !== 'ALL') {
      enriched = enriched.filter(item => item.telemetry.subsystemKey === selectedSubsystemFilter);
    }

    if (statusFilter !== 'ALL') {
      enriched = enriched.filter(item => item.telemetry.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      enriched = enriched.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q) ||
        item.telemetry.subsystemConfig.title.toLowerCase().includes(q) ||
        (item.tags && item.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    enriched.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortBy === 'type') {
        cmp = (a.type || '').localeCompare(b.type || '');
      } else if (sortBy === 'subsystem') {
        cmp = a.telemetry.subsystemConfig.title.localeCompare(b.telemetry.subsystemConfig.title);
      } else if (sortBy === 'power') {
        cmp = (b.telemetry.powerWatts || 0) - (a.telemetry.powerWatts || 0);
      } else if (sortBy === 'status') {
        const severity: Record<string, number> = { failure: 3, warning: 2, inactive: 1, active: 0 };
        cmp = (severity[b.telemetry.status] || 0) - (severity[a.telemetry.status] || 0);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return {
      displayedNodes: enriched,
      fleetMetrics: { total, nominal, warning, failure, inactive, totalWatts, healthIndex },
    };
  }, [
    hierarchyData, currentParentName, selectedSubsystemFilter, statusFilter,
    searchQuery, sortBy, sortOrder, tick, connectionsCountMap
  ]);

  const subsystemCounts = useMemo(() => {
    if (!hierarchyData) return {};
    const counts: Record<string, number> = { ALL: hierarchyData.length };
    hierarchyData.forEach((node: any) => {
      const key = resolveSubsystemKey(node.name, hierarchyData);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [hierarchyData]);

  /* ── Interaction Handlers ──────────────────────────────────────── */
  const transition = (fn: () => void) => {
    setFadeState('out');
    setTimeout(() => { fn(); setFadeState('in'); }, 180);
  };

  const handleDrillDown = (nodeName: string) => {
    const node = hierarchyData?.find((n: any) => n.name === nodeName);
    if (!node?.children?.length) return;
    transition(() => {
      setInspectNodeName(null);
      setDrillStack(prev => [...prev, nodeName]);
    });
  };

  const handleCrumbClick = (index: number) => {
    transition(() => {
      setInspectNodeName(null);
      setDrillStack(prev => prev.slice(0, index + 1));
    });
  };

  const handleRootClick = () => {
    transition(() => {
      setInspectNodeName(null);
      setDrillStack([]);
    });
  };

  const handleStepUp = () => {
    if (drillStack.length === 0) return;
    transition(() => {
      setInspectNodeName(null);
      setDrillStack(prev => prev.slice(0, prev.length - 1));
    });
  };

  /* ── Cross-Page Deep Links ─────────────────────────────────────── */
  const handleJumpToTwin = (componentName: string) => {
    if (!selectedStation) return;
    navigate(`/${selectedStation}/twin`, {
      state: { selectedComponentName: componentName },
    });
  };

  const handleJumpToTopology = (componentName: string) => {
    if (!selectedStation) return;
    navigate(`/${selectedStation}/connections`, {
      state: { selectedName: componentName },
    });
  };

  const handleJumpToDiagnostics = (componentName: string) => {
    if (!selectedStation) return;
    navigate(`/${selectedStation}/diagnostics`, {
      state: { selectedName: componentName },
    });
  };

  if (!selectedStation) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        <p>No active polar research station selected.</p>
      </div>
    );
  }

  // Theme-aware palette variables
  const bannerBg = isLight
    ? 'linear-gradient(135deg, rgba(80, 219, 192, 0.1) 0%, #ffffff 100%)'
    : 'linear-gradient(135deg, rgba(99, 219, 188, 0.05) 0%, rgba(13, 21, 39, 0.8) 100%)';
  const bannerBorder = isLight ? '1px solid #cbd5e1' : '1px solid rgba(99, 219, 188, 0.2)';
  const bannerShadow = isLight ? '0 4px 16px rgba(0, 0, 0, 0.04)' : '0 8px 32px rgba(0, 0, 0, 0.25)';
  const metricPillBg = isLight ? '#f8fafc' : 'rgba(6, 8, 18, 0.6)';
  const metricPillBorder = isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)';
  const cardBorder = isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)';
  const cardShadow = isLight ? '0 2px 10px rgba(0, 0, 0, 0.05)' : 'var(--shadow-sm)';

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
      color: 'var(--text-primary)',
      background: isLight ? 'var(--bg-main)' : 'var(--bg-main)',
    }}>
      <style>{PAGE_STYLES}</style>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 32px 40px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ════════════════════════════════════════════════════════
             FLEET KPI BANNER & STATION HEALTH RIBBON
             ════════════════════════════════════════════════════════ */}
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              borderRadius: 'var(--radius-xl)',
              background: bannerBg,
              border: bannerBorder,
              boxShadow: bannerShadow,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 20,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Station Brand Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 'var(--radius-lg)',
                background: isLight
                  ? 'linear-gradient(135deg, #e0f2fe 0%, #d1fae5 100%)'
                  : 'linear-gradient(135deg, rgba(99,219,188,0.2) 0%, rgba(56,217,245,0.1) 100%)',
                border: isLight ? '1px solid #bae6fd' : '1px solid rgba(99,219,188,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isLight ? '#0284c7' : 'var(--accent-primary)',
                boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.06)' : '0 0 16px rgba(99,219,188,0.2)'
              }}>
                <Cpu size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    Component Library & SCADA Fleet
                  </h1>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: isLight ? '#e0f2fe' : 'rgba(99,219,188,0.15)',
                    color: isLight ? '#0284c7' : 'var(--accent-primary)',
                    border: isLight ? '1px solid #bae6fd' : '1px solid rgba(99,219,188,0.3)',
                    textTransform: 'uppercase', letterSpacing: '0.06em'
                  }}>
                    {selectedStation}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Hardware topology, real-time telemetry status, and physical sub-assemblies
                </p>
              </div>
            </div>

            {/* Quick Fleet Health & Power Rollup */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {/* Health Score */}
              <div style={{
                padding: '10px 16px', borderRadius: 'var(--radius-md)',
                background: metricPillBg, border: metricPillBorder,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: fleetMetrics.healthIndex >= 90
                    ? (isLight ? '#dcfce7' : 'rgba(74,222,128,0.15)')
                    : (isLight ? '#fef3c7' : 'rgba(245,158,11,0.15)'),
                  border: `1px solid ${fleetMetrics.healthIndex >= 90 ? (isLight ? '#86efac' : 'rgba(74,222,128,0.4)') : (isLight ? '#fde68a' : 'rgba(245,158,11,0.4)')}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: fleetMetrics.healthIndex >= 90 ? (isLight ? '#15803d' : '#4ade80') : (isLight ? '#b45309' : '#f59e0b'),
                }}>
                  <Gauge size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Fleet Health</div>
                  <div style={{
                    fontSize: 16, fontWeight: 800,
                    color: fleetMetrics.healthIndex >= 90 ? (isLight ? '#15803d' : '#4ade80') : (isLight ? '#b45309' : '#f59e0b')
                  }}>
                    {fleetMetrics.healthIndex}%
                  </div>
                </div>
              </div>

              {/* Aggregated Power Load */}
              <div style={{
                padding: '10px 16px', borderRadius: 'var(--radius-md)',
                background: metricPillBg, border: metricPillBorder,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: isLight ? '#fef3c7' : 'rgba(248,213,126,0.15)',
                  border: isLight ? '1px solid #fde68a' : '1px solid rgba(248,213,126,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isLight ? '#b45309' : '#f8d57e',
                }}>
                  <Zap size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Scope Power</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isLight ? '#b45309' : '#f8d57e', fontFamily: 'monospace' }}>
                    {formatWatts(fleetMetrics.totalWatts)}
                  </div>
                </div>
              </div>

              {/* Status Breakdown Pills */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                background: metricPillBg, border: metricPillBorder,
              }}>
                <span title="Nominal components" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: isLight ? '#16a34a' : '#4ade80' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLight ? '#16a34a' : '#4ade80' }} />
                  {fleetMetrics.nominal}
                </span>
                <span style={{ color: 'var(--text-tertiary)', margin: '0 2px' }}>|</span>
                <span title="Degraded / Warning" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: isLight ? '#d97706' : '#f59e0b' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLight ? '#d97706' : '#f59e0b' }} />
                  {fleetMetrics.warning}
                </span>
                <span style={{ color: 'var(--text-tertiary)', margin: '0 2px' }}>|</span>
                <span title="Critical Faults" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: isLight ? '#dc2626' : '#ef4444' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLight ? '#dc2626' : '#ef4444' }} />
                  {fleetMetrics.failure}
                </span>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════
             SUBSYSTEM FILTER TABS (6 Core Overview Subsystems)
             ════════════════════════════════════════════════════════ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            {/* All Subsystems Tab */}
            <button
              onClick={() => setSelectedSubsystemFilter('ALL')}
              className="subsystem-tab-btn btn"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                fontSize: 12,
                fontWeight: 700,
                gap: 8,
                background: selectedSubsystemFilter === 'ALL'
                  ? (isLight ? '#0284c7' : 'var(--accent-primary)')
                  : (isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.04)'),
                color: selectedSubsystemFilter === 'ALL'
                  ? (isLight ? '#ffffff' : '#041014')
                  : 'var(--text-secondary)',
                border: selectedSubsystemFilter === 'ALL'
                  ? `1px solid ${isLight ? '#0284c7' : 'var(--accent-primary)'}`
                  : (isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)'),
                cursor: 'pointer',
                boxShadow: isLight && selectedSubsystemFilter !== 'ALL' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              }}
            >
              <Layers size={14} />
              All Subsystems
              <span style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 999,
                background: selectedSubsystemFilter === 'ALL'
                  ? 'rgba(0,0,0,0.2)'
                  : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'),
                color: selectedSubsystemFilter === 'ALL'
                  ? '#ffffff'
                  : 'var(--text-primary)',
              }}>
                {subsystemCounts.ALL || 0}
              </span>
            </button>

            {/* Individual Subsystems */}
            {Object.entries(SUBSYSTEM_CONFIGS).map(([key, config]) => {
              const SubsystemIcon = config.icon;
              const isSelected = selectedSubsystemFilter === key;
              const count = subsystemCounts[key] || 0;
              const activeColor = isLight ? config.lightColor : config.color;
              const activeBg = isLight ? config.bgLight : config.bgDark;
              const activeBorder = isLight ? config.borderLight : config.borderDark;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedSubsystemFilter(key)}
                  className="subsystem-tab-btn btn"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 12,
                    fontWeight: 700,
                    gap: 8,
                    background: isSelected ? activeBg : (isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)'),
                    color: isSelected ? activeColor : 'var(--text-secondary)',
                    border: isSelected ? `1.5px solid ${activeColor}` : (isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)'),
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isLight && !isSelected ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  <SubsystemIcon size={14} style={{ color: activeColor }} />
                  {config.title}
                  {count > 0 && (
                    <span style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: isSelected ? 'rgba(0,0,0,0.12)' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'),
                      color: isSelected ? activeColor : 'var(--text-tertiary)',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ════════════════════════════════════════════════════════
             TOOLBAR: BREADCRUMBS, SEARCH, FILTERS, VIEW MODES
             ════════════════════════════════════════════════════════ */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '12px 18px',
            background: 'var(--bg-panel-solid)',
            borderRadius: 'var(--radius-lg)',
            border: cardBorder,
            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
          }}>
            {/* Breadcrumb Navigation Trail */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {drillStack.length > 0 && (
                <button
                  onClick={handleStepUp}
                  className="btn btn-sm btn-secondary"
                  title="Step up one level"
                  style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', marginRight: 4 }}
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
              <span
                onClick={handleRootClick}
                style={{
                  cursor: 'pointer',
                  fontWeight: drillStack.length === 0 ? 800 : 500,
                  color: drillStack.length === 0 ? (isLight ? '#0284c7' : 'var(--accent-primary)') : 'var(--text-secondary)',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Compass size={14} />
                {selectedStation}
              </span>
              {drillStack.map((crumb, idx) => {
                const isLast = idx === drillStack.length - 1;
                return (
                  <span key={crumb} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ChevronRight size={13} style={{ color: 'var(--text-tertiary)' }} />
                    <span
                      onClick={() => !isLast && handleCrumbClick(idx)}
                      style={{
                        cursor: isLast ? 'default' : 'pointer',
                        fontWeight: isLast ? 800 : 500,
                        color: isLast ? (isLight ? '#0284c7' : 'var(--accent-primary)') : 'var(--text-secondary)',
                        fontSize: 13,
                      }}
                    >
                      {crumb}
                    </span>
                  </span>
                );
              })}
            </div>

            {/* Controls Right Stack */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)', pointerEvents: 'none'
                }} />
                <input
                  type="text"
                  placeholder="Search component, type, tag..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    paddingLeft: 32,
                    paddingRight: searchQuery ? 28 : 12,
                    width: 220,
                    height: 34,
                    fontSize: 12,
                    borderRadius: 'var(--radius-md)',
                    background: isLight ? '#f8fafc' : 'var(--bg-panel-secondary)',
                    border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
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

              {/* Status Filter Dropdown */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                style={{
                  height: 34,
                  fontSize: 12,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-md)',
                  background: isLight ? '#f8fafc' : 'var(--bg-panel-secondary)',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="active">Nominal Only</option>
                <option value="warning">Degraded / Warning</option>
                <option value="failure">Critical Fault Only</option>
                <option value="inactive">Standby / Off</option>
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{
                  height: 34,
                  fontSize: 12,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-md)',
                  background: isLight ? '#f8fafc' : 'var(--bg-panel-secondary)',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="subsystem">Sort by Subsystem</option>
                <option value="name">Sort by Name</option>
                <option value="type">Sort by Type</option>
                <option value="power">Sort by Power Draw</option>
                <option value="status">Sort by Status Severity</option>
              </select>

              {/* Sort Order Toggle */}
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="btn btn-sm btn-secondary"
                title={`Order: ${sortOrder.toUpperCase()}`}
                style={{ height: 34, padding: '0 10px' }}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>

              {/* View Mode Toggle: Grid vs Table */}
              <div style={{
                display: 'flex',
                background: isLight ? '#e2e8f0' : 'var(--bg-panel-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: 2,
                border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
              }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    background: viewMode === 'grid' ? (isLight ? '#ffffff' : 'var(--accent-primary)') : 'transparent',
                    color: viewMode === 'grid' ? (isLight ? '#0f172a' : '#041014') : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    boxShadow: viewMode === 'grid' && isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  title="Grid Cards View"
                >
                  <LayoutGrid size={14} />
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  style={{
                    background: viewMode === 'table' ? (isLight ? '#ffffff' : 'var(--accent-primary)') : 'transparent',
                    color: viewMode === 'table' ? (isLight ? '#0f172a' : '#041014') : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                    boxShadow: viewMode === 'table' && isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  title="SCADA Table View"
                >
                  <List size={14} />
                  Table
                </button>
              </div>

              {/* Scope Count Badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: isLight ? '#e0f2fe' : 'rgba(99,219,188,0.08)',
                border: isLight ? '1px solid #bae6fd' : '1px solid rgba(99,219,188,0.2)',
                borderRadius: 'var(--radius-full)',
                fontSize: 12, fontWeight: 700,
                color: isLight ? '#0284c7' : 'var(--accent-primary)',
              }}>
                {displayedNodes.length} Items
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════
             VIEW MODE A: RICH COMPONENT CARDS (GRID VIEW)
             ════════════════════════════════════════════════════════ */}
          {viewMode === 'grid' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 20,
                opacity: fadeState === 'in' ? 1 : 0,
                transition: 'opacity 0.2s ease',
                paddingBottom: 40,
              }}
            >
              {displayedNodes.map((node: any, i: number) => {
                const tel = node.telemetry;
                const isSelectedForInspect = node.name === inspectNodeName;
                const SubsystemIcon = tel.subsystemConfig.icon;
                const subsystemAccentColor = isLight ? tel.subsystemConfig.lightColor : tel.subsystemConfig.color;

                // Status colors
                let statusBg = isLight ? '#dcfce7' : 'rgba(74, 222, 128, 0.12)';
                let statusBorder = isLight ? '#86efac' : 'rgba(74, 222, 128, 0.35)';
                let statusColor = isLight ? '#15803d' : '#4ade80';
                let pulseAnim = 'pulseGlowGreen 2.5s infinite';

                if (tel.status === 'warning') {
                  statusBg = isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.14)';
                  statusBorder = isLight ? '#fde68a' : 'rgba(245, 158, 11, 0.4)';
                  statusColor = isLight ? '#b45309' : '#f59e0b';
                  pulseAnim = 'pulseGlowAmber 2.2s infinite';
                } else if (tel.status === 'failure') {
                  statusBg = isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.16)';
                  statusBorder = isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.5)';
                  statusColor = isLight ? '#dc2626' : '#ef4444';
                  pulseAnim = 'pulseGlowRed 1.8s infinite';
                } else if (tel.status === 'inactive') {
                  statusBg = isLight ? '#f1f5f9' : 'rgba(148, 163, 184, 0.1)';
                  statusBorder = isLight ? '#cbd5e1' : 'rgba(148, 163, 184, 0.25)';
                  statusColor = isLight ? '#64748b' : '#94a3b8';
                  pulseAnim = 'none';
                }

                // Image fallback
                const imgArr = IMAGE_MAP[node.type] || IMAGE_MAP.default || [];
                const imgSrc = imgArr.length > 0
                  ? imgArr[Math.abs(node.name.split('').reduce((a: number, b: string) => ((a << 5) - a) + b.charCodeAt(0), 0)) % imgArr.length]
                  : null;

                return (
                  <div
                    key={node.name}
                    className="glass-panel comp-hub-card"
                    style={{
                      borderRadius: 'var(--radius-xl)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      animation: `cardSlideIn 0.35s cubic-bezier(0.2, 0, 0, 1) ${Math.min(i * 0.03, 0.3)}s both`,
                      border: isSelectedForInspect
                        ? `2px solid ${isLight ? '#0284c7' : 'var(--accent-primary)'}`
                        : cardBorder,
                      boxShadow: isSelectedForInspect
                        ? (isLight ? '0 0 16px rgba(2, 132, 199, 0.25)' : '0 0 20px rgba(99, 219, 188, 0.3)')
                        : cardShadow,
                      background: 'var(--bg-panel-solid)',
                      position: 'relative',
                    }}
                  >
                    {/* Top Subsystem Identity Bar */}
                    <div style={{
                      padding: '8px 14px',
                      background: isLight ? '#f8fafc' : 'rgba(6, 8, 18, 0.7)',
                      borderBottom: cardBorder,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: subsystemAccentColor, fontWeight: 700 }}>
                        <SubsystemIcon size={13} />
                        <span>{tel.subsystemConfig.title}</span>
                      </div>
                      {node.parent && (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
                          in <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{node.parent}</span>
                        </div>
                      )}
                    </div>

                    {/* Technical Schematic / Visual Banner */}
                    <div style={{
                      height: 115,
                      position: 'relative',
                      overflow: 'hidden',
                      background: isLight
                        ? 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)'
                        : 'linear-gradient(180deg, rgba(12,18,32,0.9) 0%, rgba(6,8,18,0.95) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {/* Background Blueprint Grid */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: isLight
                          ? `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`
                          : `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                        backgroundSize: '16px 16px',
                        pointerEvents: 'none',
                      }} />

                      {/* Photo overlay if available */}
                      {imgSrc && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          backgroundImage: `url(${imgSrc})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          opacity: isLight ? 0.12 : 0.18,
                          filter: 'grayscale(60%)',
                        }} />
                      )}

                      {/* Technical Center Schematics Badge */}
                      <div style={{
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 5,
                      }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 'var(--radius-lg)',
                          background: isLight ? '#ffffff' : 'rgba(6, 8, 18, 0.85)',
                          border: isLight ? '1px solid #cbd5e1' : `1px solid ${tel.subsystemConfig.borderDark}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.08)' : '0 4px 14px rgba(0,0,0,0.4)',
                        }}>
                          <TypeIcon type={node.type} />
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--text-secondary)',
                          background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(6, 8, 18, 0.7)',
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: cardBorder,
                        }}>
                          {node.type || 'Component'}
                        </span>
                      </div>

                      {/* Live Operational Status Beacon */}
                      <div style={{
                        position: 'absolute', top: 10, right: 10,
                        zIndex: 3,
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 9px', borderRadius: 'var(--radius-full)',
                        background: statusBg,
                        border: `1px solid ${statusBorder}`,
                        backdropFilter: 'blur(8px)',
                        fontSize: 10, fontWeight: 700,
                        color: statusColor,
                        letterSpacing: '0.04em',
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: statusColor,
                          animation: pulseAnim,
                        }} />
                        {tel.statusLabel}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      flex: 1,
                    }}>
                      {/* Name & Type */}
                      <div>
                        <h3 style={{
                          fontSize: 15,
                          fontWeight: 700,
                          margin: '0 0 4px 0',
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.02em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }} title={node.name}>
                          {node.name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {node.spec?.description || tel.subsystemConfig.category}
                          </span>
                        </div>
                      </div>

                      {/* Live Telemetry Matrix */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isLight ? '#f8fafc' : 'rgba(6, 8, 18, 0.55)',
                        border: cardBorder,
                      }}>
                        {/* Power Load */}
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Power / Load</div>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: tel.powerWatts !== null ? (isLight ? '#b45309' : '#f8d57e') : 'var(--text-secondary)',
                            fontFamily: 'monospace', marginTop: 2
                          }}>
                            {formatWatts(tel.powerWatts)}
                          </div>
                        </div>

                        {/* Temperature or Secondary */}
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            {tel.temperatureC !== null ? 'Temperature' : tel.secondaryMetric?.label || 'Telemetry'}
                          </div>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: tel.temperatureC !== null ? (isLight ? '#0284c7' : '#38d9f5') : 'var(--text-secondary)',
                            fontFamily: 'monospace', marginTop: 2
                          }}>
                            {tel.temperatureC !== null
                              ? formatTemp(tel.temperatureC)
                              : tel.secondaryMetric?.value || 'Nominal'}
                          </div>
                        </div>
                      </div>

                      {/* Interconnection Links & Tags */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Network size={12} style={{ color: isLight ? '#0284c7' : 'var(--accent-primary)' }} />
                          <span>{tel.connectionsCount} {tel.connectionsCount === 1 ? 'Link' : 'Links'}</span>
                        </div>
                        {node.tags && node.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {node.tags.slice(0, 2).map((t: string) => (
                              <span key={t} style={{
                                fontSize: 9, padding: '1px 6px', borderRadius: 4,
                                background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)',
                                color: isLight ? '#475569' : 'var(--text-tertiary)',
                                textTransform: 'uppercase'
                              }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dedicated Subsystem Drill-Down Button (If Container) */}
                      {tel.isContainer && (
                        <button
                          onClick={() => handleDrillDown(node.name)}
                          className="btn btn-sm btn-primary"
                          style={{
                            width: '100%',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '7px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <FolderOpen size={14} />
                          Explore Subsystem ({tel.childCount} items)
                          <ChevronRight size={14} />
                        </button>
                      )}

                      {/* Balanced Action Button Grid (No gap pushing Inspect to right edge!) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                        gap: 6,
                        paddingTop: tel.isContainer ? 0 : 8,
                        borderTop: tel.isContainer ? 'none' : cardBorder,
                      }}>
                        <button
                          onClick={() => setInspectNodeName(node.name)}
                          className="btn btn-sm btn-secondary"
                          style={{
                            padding: '6px 8px', fontSize: 11, gap: 4, justifyContent: 'center',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title="Open Property Inspector"
                        >
                          <Info size={12} style={{ color: isLight ? '#0284c7' : 'var(--accent-primary)' }} />
                          Inspect
                        </button>
                        <button
                          onClick={() => handleJumpToTwin(node.name)}
                          className="btn btn-sm btn-secondary"
                          style={{
                            padding: '6px 6px', fontSize: 11, gap: 3, justifyContent: 'center',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title="Focus in 3D Twin Viewer"
                        >
                          <Compass size={12} style={{ color: isLight ? '#0284c7' : 'var(--accent-primary)' }} />
                          3D
                        </button>
                        <button
                          onClick={() => handleJumpToTopology(node.name)}
                          className="btn btn-sm btn-secondary"
                          style={{
                            padding: '6px 6px', fontSize: 11, gap: 3, justifyContent: 'center',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title="Trace in Topology Graph"
                        >
                          <Network size={12} style={{ color: '#a78bfa' }} />
                          Graph
                        </button>
                        <button
                          onClick={() => handleJumpToDiagnostics(node.name)}
                          className="btn btn-sm btn-secondary"
                          style={{
                            padding: '6px 6px', fontSize: 11, gap: 3, justifyContent: 'center',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title="View Historical Diagnostics"
                        >
                          <Activity size={12} style={{ color: '#50dbc0' }} />
                          Logs
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
             VIEW MODE B: SCADA DENSE TELEMETRY TABLE VIEW
             ════════════════════════════════════════════════════════ */}
          {viewMode === 'table' && (
            <div
              className="glass-panel"
              style={{
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                border: cardBorder,
                background: 'var(--bg-panel-solid)',
                boxShadow: cardShadow,
                opacity: fadeState === 'in' ? 1 : 0,
                transition: 'opacity 0.2s ease',
                marginBottom: 40,
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{
                      background: isLight ? '#f1f5f9' : 'rgba(6, 8, 18, 0.8)',
                      borderBottom: cardBorder,
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      <th style={{ padding: '14px 18px' }}>Status</th>
                      <th style={{ padding: '14px 18px' }}>Component / Subsystem</th>
                      <th style={{ padding: '14px 18px' }}>Subsystem Domain</th>
                      <th style={{ padding: '14px 18px' }}>Type</th>
                      <th style={{ padding: '14px 18px' }}>Power / Load</th>
                      <th style={{ padding: '14px 18px' }}>Temperature</th>
                      <th style={{ padding: '14px 18px' }}>Secondary Telemetry</th>
                      <th style={{ padding: '14px 18px' }}>Topology Links</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedNodes.map((node: any) => {
                      const tel = node.telemetry;
                      const SubsystemIcon = tel.subsystemConfig.icon;
                      const isSelected = node.name === inspectNodeName;
                      const subsystemAccentColor = isLight ? tel.subsystemConfig.lightColor : tel.subsystemConfig.color;

                      let statusDotColor = isLight ? '#16a34a' : '#4ade80';
                      if (tel.status === 'warning') statusDotColor = isLight ? '#d97706' : '#f59e0b';
                      else if (tel.status === 'failure') statusDotColor = isLight ? '#dc2626' : '#ef4444';
                      else if (tel.status === 'inactive') statusDotColor = isLight ? '#64748b' : '#94a3b8';

                      return (
                        <tr
                          key={node.name}
                          className="scada-table-row"
                          onClick={() => {
                            if (tel.isContainer) {
                              handleDrillDown(node.name);
                            } else {
                              setInspectNodeName(node.name);
                            }
                          }}
                          style={{
                            borderBottom: cardBorder,
                            background: isSelected
                              ? (isLight ? '#f0f9ff' : 'rgba(99, 219, 188, 0.08)')
                              : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {/* Status */}
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: statusDotColor,
                                boxShadow: `0 0 6px ${statusDotColor}`,
                              }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: statusDotColor }}>
                                {tel.statusLabel}
                              </span>
                            </div>
                          </td>

                          {/* Name + Subsystem Drill Button */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TypeIcon type={node.type} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{node.name}</span>
                                  {tel.isContainer && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDrillDown(node.name); }}
                                      className="btn btn-sm btn-secondary"
                                      style={{
                                        padding: '1px 7px',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        gap: 3,
                                        borderRadius: 999,
                                        color: isLight ? '#0284c7' : 'var(--accent-primary)',
                                        borderColor: isLight ? '#bae6fd' : 'rgba(99,219,188,0.3)',
                                        background: isLight ? '#f0f9ff' : 'rgba(99,219,188,0.1)',
                                      }}
                                      title="Drill into subsystem"
                                    >
                                      <FolderOpen size={10} />
                                      {tel.childCount} sub-items
                                      <ChevronRight size={10} />
                                    </button>
                                  )}
                                </div>
                                {node.parent && (
                                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Parent: {node.parent}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Subsystem Domain */}
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: subsystemAccentColor, fontWeight: 600, fontSize: 12 }}>
                              <SubsystemIcon size={13} />
                              {tel.subsystemConfig.title}
                            </div>
                          </td>

                          {/* Type */}
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                              padding: '2px 8px', borderRadius: 4,
                              background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                              color: 'var(--text-secondary)'
                            }}>
                              {node.type || 'node'}
                            </span>
                          </td>

                          {/* Power */}
                          <td style={{
                            padding: '12px 18px', fontFamily: 'monospace', fontSize: 12,
                            color: tel.powerWatts !== null ? (isLight ? '#b45309' : '#f8d57e') : 'var(--text-tertiary)',
                            whiteSpace: 'nowrap'
                          }}>
                            {formatWatts(tel.powerWatts)}
                          </td>

                          {/* Temperature */}
                          <td style={{
                            padding: '12px 18px', fontFamily: 'monospace', fontSize: 12,
                            color: tel.temperatureC !== null ? (isLight ? '#0284c7' : '#38d9f5') : 'var(--text-tertiary)',
                            whiteSpace: 'nowrap'
                          }}>
                            {formatTemp(tel.temperatureC)}
                          </td>

                          {/* Secondary */}
                          <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {tel.secondaryMetric ? (
                              <span><strong style={{ color: 'var(--text-tertiary)' }}>{tel.secondaryMetric.label}:</strong> {tel.secondaryMetric.value}</span>
                            ) : '--'}
                          </td>

                          {/* Connections */}
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              color: tel.connectionsCount > 0 ? (isLight ? '#0284c7' : 'var(--accent-primary)') : 'var(--text-tertiary)',
                              display: 'flex', alignItems: 'center', gap: 4
                            }}>
                              <Network size={12} />
                              {tel.connectionsCount}
                            </span>
                          </td>

                          {/* Actions (Including Dedicated Drill In Button for Containers) */}
                          <td style={{ padding: '12px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} onClick={e => e.stopPropagation()}>
                              {tel.isContainer && (
                                <button
                                  onClick={() => handleDrillDown(node.name)}
                                  className="btn btn-sm btn-primary"
                                  title="Drill into subsystem items"
                                  style={{ padding: '4px 9px', fontSize: 10, gap: 4 }}
                                >
                                  <FolderOpen size={11} />
                                  Drill In
                                </button>
                              )}
                              <button
                                onClick={() => setInspectNodeName(node.name)}
                                className="btn btn-sm btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 10 }}
                              >
                                Inspect
                              </button>
                              <button
                                onClick={() => handleJumpToTwin(node.name)}
                                className="btn btn-sm btn-secondary"
                                title="Focus in 3D Twin"
                                style={{ padding: '4px 8px', fontSize: 10 }}
                              >
                                3D
                              </button>
                              <button
                                onClick={() => handleJumpToTopology(node.name)}
                                className="btn btn-sm btn-secondary"
                                title="View in Connections Graph"
                                style={{ padding: '4px 8px', fontSize: 10 }}
                              >
                                Graph
                              </button>
                              <button
                                onClick={() => handleJumpToDiagnostics(node.name)}
                                className="btn btn-sm btn-secondary"
                                title="View Run Diagnostics"
                                style={{ padding: '4px 8px', fontSize: 10 }}
                              >
                                Logs
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
             EMPTY STATE
             ════════════════════════════════════════════════════════ */}
          {displayedNodes.length === 0 && (
            <div className="glass-panel empty-state" style={{
              padding: '60px 20px',
              textAlign: 'center',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-panel-solid)',
              border: cardBorder
            }}>
              <Box size={44} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                No components match criteria
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 450, margin: '0 auto 16px auto' }}>
                {searchQuery
                  ? `No components found matching "${searchQuery}" in the selected subsystem filter.`
                  : 'No hardware nodes found at this hierarchy level or matching the selected filters.'}
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedSubsystemFilter('ALL'); setStatusFilter('ALL'); }}
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 16px' }}
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        <Footer />
      </div>

      {/* ════════════════════════════════════════════════════════
         SLIDE-OUT PROPERTY INSPECTOR DRAWER
         ════════════════════════════════════════════════════════ */}
      {inspectNodeName && hierarchyData && (
        <div
          className="slide-in-right"
          style={{
            width: 420,
            flexShrink: 0,
            background: 'var(--bg-panel-solid)',
            borderLeft: cardBorder,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: isLight ? '-8px 0 24px rgba(0, 0, 0, 0.08)' : '-12px 0 32px rgba(0, 0, 0, 0.45)',
            zIndex: 30,
          }}
        >
          {/* Inspector Header with Direct Quick Actions */}
          <div style={{
            padding: '16px 20px',
            borderBottom: cardBorder,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flexShrink: 0,
            background: isLight
              ? 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)'
              : 'linear-gradient(180deg, rgba(99,219,188,0.06) 0%, rgba(6,8,18,0.6) 100%)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                  background: isLight ? '#e0f2fe' : 'rgba(99,219,188,0.15)',
                  border: isLight ? '1px solid #bae6fd' : '1px solid rgba(99,219,188,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isLight ? '#0284c7' : 'var(--accent-primary)',
                }}>
                  <Info size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Component Inspector</h3>
                  <div style={{
                    fontSize: 11, color: isLight ? '#0284c7' : 'var(--accent-primary)',
                    marginTop: 2, fontWeight: 700, letterSpacing: '0.02em',
                    maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {inspectNodeName}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectNodeName(null)}
                className="btn-icon"
                style={{ borderRadius: 'var(--radius-full)', padding: 6 }}
                title="Close Inspector"
              >
                <X size={16} />
              </button>
            </div>

            {/* Cross-Page Action Ribbon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingTop: 8,
              borderTop: cardBorder,
            }}>
              <button
                onClick={() => handleJumpToTwin(inspectNodeName)}
                className="btn btn-sm btn-secondary"
                style={{ flex: 1, gap: 5, fontSize: 11, justifyContent: 'center' }}
                title="Open in 3D Digital Twin Viewer"
              >
                <Compass size={13} style={{ color: isLight ? '#0284c7' : 'var(--accent-primary)' }} />
                Focus 3D
              </button>
              <button
                onClick={() => handleJumpToTopology(inspectNodeName)}
                className="btn btn-sm btn-secondary"
                style={{ flex: 1, gap: 5, fontSize: 11, justifyContent: 'center' }}
                title="View in Cytoscape Topology Graph"
              >
                <Network size={13} style={{ color: '#a78bfa' }} />
                Topology
              </button>
              <button
                onClick={() => handleJumpToDiagnostics(inspectNodeName)}
                className="btn btn-sm btn-secondary"
                style={{ flex: 1, gap: 5, fontSize: 11, justifyContent: 'center' }}
                title="View Historical Run Logs & Charts"
              >
                <Activity size={13} style={{ color: '#50dbc0' }} />
                Diagnostics
              </button>
            </div>
          </div>

          {/* Inspector Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {(() => {
              try {
                if (sceneLayout) {
                  const node = sceneLayout.allNodes.get(inspectNodeName);
                  if (node) {
                    return (
                      <PropertyInspector
                        node={node as any}
                        connections={sceneLayout.connections}
                        liveStateRef={liveStateRef || { current: {} }}
                        flat={true}
                      />
                    );
                  }
                }
              } catch (e) {
                console.error(e);
              }
              return (
                <div style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
                  Failed to load component details for {inspectNodeName}.
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
