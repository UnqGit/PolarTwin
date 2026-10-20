import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStation } from '../components/StationContext';
import { useTheme } from '../components/ThemeContext';
import { StationHologram3D } from '../components/StationHologram3D';
import { TopologyMiniVisualizer, type TopologyMedium } from '../components/TopologyMiniVisualizer';
import { Footer } from '../components/Footer';
import {
  Activity, Thermometer, Zap, Package, Radar,
  Cpu, Server, Radio, Wind, Droplets, ShieldCheck,
  Globe, ArrowRight, Play, AlertTriangle, CheckCircle2,
  ExternalLink, Clock, MapPin, RefreshCw, Layers3, Network,
  Maximize2, Eye, Compass, Flame, Snowflake, Shield, Info, Sparkles
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   SUBSYSTEM DEFINITIONS & METADATA
   ═══════════════════════════════════════════════════════ */
interface SubsystemConfig {
  id: string;
  name: string;
  title: string;
  icon: any;
  color: string;
  accentBg: string;
  borderAccent: string;
  tag: string;
  category: string;
  description: string;
  pinCoord: { top: string; left: string };
}

const SUBSYSTEM_CONFIGS: Record<string, SubsystemConfig> = {
  EnergyBlock: {
    id: 'EnergyBlock',
    name: 'EnergyBlock',
    title: 'Energy & Power Grid',
    icon: Zap,
    color: '#f8d57e',
    accentBg: 'rgba(248, 213, 126, 0.12)',
    borderAccent: 'rgba(248, 213, 126, 0.3)',
    tag: 'Primary 400V AC Bus',
    category: 'Power Infrastructure',
    description: 'Diesel turbine generation, katabatic wind harvesting & distribution bus',
    pinCoord: { top: '42%', left: '38%' },
  },
  HVACBlock: {
    id: 'HVACBlock',
    name: 'HVACBlock',
    title: 'HVAC & Life Support',
    icon: Thermometer,
    color: '#38d9f5',
    accentBg: 'rgba(56, 217, 245, 0.12)',
    borderAccent: 'rgba(56, 217, 245, 0.3)',
    tag: 'Atmospheric Envelope',
    category: 'Habitability & Thermal',
    description: 'Habitation thermal regulation, ventilation cycles & air exchange',
    pinCoord: { top: '48%', left: '46%' },
  },
  ControlBlock: {
    id: 'ControlBlock',
    name: 'ControlBlock',
    title: 'Central SCADA & Comms',
    icon: Radio,
    color: '#a78bfa',
    accentBg: 'rgba(167, 139, 250, 0.12)',
    borderAccent: 'rgba(167, 139, 250, 0.3)',
    tag: 'Telemetry & Modbus',
    category: 'Command & Avionics',
    description: 'Main SCADA server, LEO satellite uplink & sensor telemetry relays',
    pinCoord: { top: '36%', left: '62%' },
  },
  WaterAndWasteBlock: {
    id: 'WaterAndWasteBlock',
    name: 'WaterAndWasteBlock',
    title: 'Water & Fluid Systems',
    icon: Droplets,
    color: '#60a5fa',
    accentBg: 'rgba(96, 165, 250, 0.12)',
    borderAccent: 'rgba(96, 165, 250, 0.3)',
    tag: 'Closed Fluid Loop',
    category: 'Consumables & Hydrology',
    description: 'Meltwater extraction, potable heating & graywater recycling pump loops',
    pinCoord: { top: '56%', left: '52%' },
  },
  ResearchBlock: {
    id: 'ResearchBlock',
    name: 'ResearchBlock',
    title: 'Research & Science Labs',
    icon: Activity,
    color: '#50dbc0',
    accentBg: 'rgba(80, 219, 192, 0.12)',
    borderAccent: 'rgba(80, 219, 192, 0.3)',
    tag: 'Payload & Instrumentation',
    category: 'Polar Science',
    description: 'Wet & dry analytical laboratories, geomagnetic & aurora sensors',
    pinCoord: { top: '54%', left: '68%' },
  },
  InventoryBlock: {
    id: 'InventoryBlock',
    name: 'InventoryBlock',
    title: 'Inventory & Cryo Fuel',
    icon: Package,
    color: '#fb923c',
    accentBg: 'rgba(251, 146, 60, 0.12)',
    borderAccent: 'rgba(251, 146, 60, 0.3)',
    tag: 'Mission Reserves',
    category: 'Logistics & Fuel',
    description: 'Arctic fuel storage, polar emergency rations & mechanical spares',
    pinCoord: { top: '64%', left: '32%' },
  },
};

/* ═══════════════════════════════════════════════════════
   FORMATTING HELPERS
   ═══════════════════════════════════════════════════════ */
function formatWatts(w: number): string {
  if (w >= 1000000) return `${(w / 1000000).toFixed(2)} MW`;
  if (w >= 1000) return `${(w / 1000).toFixed(1)} kW`;
  return `${w.toFixed(0)} W`;
}

function formatSimTime(sec: number): string {
  if (!sec || sec <= 0) return 'T+00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Overview() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const navigate = useNavigate();

  const {
    selectedStation,
    hierarchy,
    connections,
    spec,
    runtime,
    liveStateRef,
    simTime,
    simStatus,
    selectedScenarioId,
    diagLog,
    simLog,
  } = useStation();

  // Selected center view: 3D Hologram, Orbital Satellite Map, or Topology Mesh
  const [activeCenterView, setActiveCenterView] = useState<'3d' | 'satellite' | 'topology'>('3d');
  const [selectedSubsystemPin, setSelectedSubsystemPin] = useState<string | null>(null);
  const [topologyMedium, setTopologyMedium] = useState<TopologyMedium>('all');
  const [tickPulse, setTickPulse] = useState(0);

  // Pulse effect when simulation updates
  useEffect(() => {
    if (simTime > 0) {
      setTickPulse(p => p + 1);
    }
  }, [simTime]);

  const hierarchyData = useMemo(() => hierarchy || [], [hierarchy]);
  const connectionsData = useMemo(() => connections || [], [connections]);

  /* ── Compute Subsystem Hierarchy & Rollups ─────────────────── */
  const subsystems = useMemo(() => {
    const parentMap = new Map<string, string>();
    hierarchyData.forEach((n: any) => {
      if (n.children) {
        n.children.forEach((c: string) => parentMap.set(c, n.name));
      }
    });

    // Find the station root node
    const stationNode = hierarchyData.find((n: any) => n.type === 'station') 
      || hierarchyData.find((n: any) => n.name === selectedStation)
      || hierarchyData[0];

    const blockNames: string[] = stationNode?.children || [
      'EnergyBlock', 'HVACBlock', 'ControlBlock', 'WaterAndWasteBlock', 'ResearchBlock', 'InventoryBlock'
    ];

    const live = liveStateRef?.current || {};

    return blockNames.map((blockName) => {
      const config = SUBSYSTEM_CONFIGS[blockName] || {
        id: blockName,
        name: blockName,
        title: blockName.replace(/Block$/, '').replace(/([A-Z])/g, ' $1').trim(),
        icon: Cpu,
        color: 'var(--accent-primary)',
        accentBg: 'rgba(80, 219, 192, 0.1)',
        borderAccent: 'rgba(80, 219, 192, 0.25)',
        tag: 'Subsystem',
        category: 'Base Module',
        description: 'Station subsystem and interconnected sensors',
        pinCoord: { top: '50%', left: '50%' },
      };

      // Collect all descendants
      const allDescendants: string[] = [];
      const queue = [blockName];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const node = hierarchyData.find((n: any) => n.name === curr);
        if (node?.children) {
          node.children.forEach((c: string) => {
            if (!allDescendants.includes(c)) {
              allDescendants.push(c);
              queue.push(c);
            }
          });
        }
      }

      // Check failure / inactive / active counts
      let failCount = 0;
      let inactiveCount = 0;
      allDescendants.forEach(name => {
        const st = (live[name] as any)?.status;
        if (st === 'failure') failCount++;
        else if (st === 'inactive') inactiveCount++;
      });

      const blockState = live[blockName] as any;
      if (blockState?.status === 'failure') failCount++;

      let status: 'active' | 'degraded' | 'failure' = 'active';
      if (failCount > 0) status = 'failure';
      else if (inactiveCount > 0) status = 'degraded';

      const totalNodes = allDescendants.length;
      const activeNodes = Math.max(0, totalNodes - failCount - inactiveCount);

      // Block-specific live telemetry highlights
      let primaryMetric = 'Nominal State';
      let secondaryMetric = `${activeNodes}/${totalNodes} Nodes Active`;

      if (blockName === 'EnergyBlock') {
        const genPwr = (live['MainGenerator'] as any)?.power 
          ?? (live['MainGeneratorPower'] as any)?.power
          ?? 250000;
        const genTemp = (live['MainGenerator'] as any)?.temperature ?? 52.5;
        primaryMetric = `${formatWatts(genPwr)} Output`;
        secondaryMetric = `Temp: ${genTemp.toFixed(1)}°C · 400V Bus`;
      } else if (blockName === 'HVACBlock') {
        const hvacTemp = (live['MainAC'] as any)?.temperature?.output 
          ?? (live['HVACBlock'] as any)?.temperature 
          ?? 16.0;
        primaryMetric = `Temp: ${typeof hvacTemp === 'number' ? hvacTemp.toFixed(1) : hvacTemp}°C`;
        secondaryMetric = `Airflow: 0.14 m³/s · Nominal`;
      } else if (blockName === 'ControlBlock') {
        const srvPwr = (live['MainServer'] as any)?.power ?? 600;
        primaryMetric = `SCADA Server: ${srvPwr}W`;
        secondaryMetric = `LEO Stream: 57.5 kHz · 14ms`;
      } else if (blockName === 'WaterAndWasteBlock') {
        const wVol = (live['WaterTank'] as any)?.volume ?? 1500;
        primaryMetric = `Reserves: ${wVol.toFixed(0)} L`;
        secondaryMetric = `Recycle Loop: Active`;
      } else if (blockName === 'ResearchBlock') {
        primaryMetric = `Instruments: Online`;
        secondaryMetric = `Geomagnetic & Met Mast`;
      } else if (blockName === 'InventoryBlock') {
        const fVol = (live['FuelTank'] as any)?.volume ?? 1500;
        primaryMetric = `Cryo Fuel: ${fVol.toFixed(0)} L`;
        secondaryMetric = `148 Days Autonomy`;
      }

      return {
        ...config,
        status,
        totalNodes,
        activeNodes,
        failCount,
        primaryMetric,
        secondaryMetric,
        descendants: allDescendants,
      };
    });
  }, [hierarchyData, liveStateRef, selectedStation, simTime]);

  /* ── Aggregated Vital Signs ─────────────────────────────────── */
  const globalVitals = useMemo(() => {
    const live = liveStateRef?.current || {};
    let totalNodes = hierarchyData.length;
    let failedNodes = 0;
    let inactiveNodes = 0;

    hierarchyData.forEach((n: any) => {
      const st = (live[n.name] as any)?.status;
      if (st === 'failure') failedNodes++;
      else if (st === 'inactive') inactiveNodes++;
    });

    const activeNodes = Math.max(0, totalNodes - failedNodes - inactiveNodes);
    const healthPercent = totalNodes > 0 ? Math.round((activeNodes / totalNodes) * 100) : 100;

    // Power output calculation
    const mainPwr = (live['MainGenerator'] as any)?.power ?? 250000;
    const backupPwr = (live['BackupGenerator'] as any)?.power ?? 0;
    const isBackupActive = (live['BackupGenerator'] as any)?.status === 'active';
    const totalGenWatts = mainPwr + (isBackupActive ? backupPwr : 0);

    // Habitat climate
    const habitatTemp = (live['Maitri'] as any)?.temperature 
      ?? (live['HVACBlock'] as any)?.temperature 
      ?? 18.5;

    // Active connection pathways
    const totalConnections = connectionsData.length;

    return {
      healthPercent,
      activeNodes,
      totalNodes,
      failedNodes,
      totalGenWatts,
      habitatTemp: typeof habitatTemp === 'number' ? habitatTemp.toFixed(1) : habitatTemp,
      externalTemp: '-24.8',
      windChill: '-36.2',
      totalConnections,
    };
  }, [hierarchyData, connectionsData, liveStateRef, simTime]);

  /* ── Recent Alarms / Incidents ──────────────────────────────── */
  const activeAlerts = useMemo(() => {
    const alerts: { id: string; title: string; desc: string; severity: 'critical' | 'warning' | 'info'; time: string }[] = [];
    const live = liveStateRef?.current || {};

    // Scan for failures in live state
    Object.entries(live).forEach(([compName, state]: [string, any]) => {
      if (state?.status === 'failure') {
        alerts.push({
          id: `fault-${compName}`,
          title: `Hardware Trip: ${compName}`,
          desc: state?.error || 'Operational threshold exceeded or emergency trip engaged',
          severity: 'critical',
          time: simTime > 0 ? formatSimTime(simTime) : 'Active',
        });
      }
    });

    // Add recent diagLog entries
    if (diagLog && diagLog.length > 0) {
      diagLog.slice(-3).reverse().forEach((d: any, idx: number) => {
        alerts.push({
          id: `diag-${idx}`,
          title: d.title || d.event || 'System Diagnostic Notification',
          desc: d.message || d.desc || JSON.stringify(d),
          severity: d.level === 'error' ? 'critical' : 'warning',
          time: d.time ? formatSimTime(d.time) : 'Recent',
        });
      });
    }

    return alerts;
  }, [liveStateRef, diagLog, simTime]);

  /* ── Drill-down Navigation into Components ──────────────────── */
  const handleInspectSubsystem = (blockName: string) => {
    if (!selectedStation) return;
    navigate(`/${selectedStation}/components`, {
      state: { drillStack: [selectedStation], inspectNodeName: blockName },
    });
  };

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      background: isLight ? 'var(--bg-main)' : 'radial-gradient(ellipse at 50% 0%, #0d1527 0%, #080b13 75%)',
    }}>
      <div style={{
        padding: '28px 36px 40px 36px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        maxWidth: 1720,
        margin: '0 auto',
        width: '100%',
      }}>

        {/* ═══════════════════════════════════════════════════════
           SECTION A: EXECUTIVE MISSION HEADER
           ═══════════════════════════════════════════════════════ */}
        <div className="fade-in" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h1 style={{
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                margin: 0,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                {selectedStation || 'Maitri'}
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: isLight ? '#0284c7' : 'var(--accent-primary)',
                  background: isLight ? '#e0f2fe' : 'rgba(80, 219, 192, 0.12)',
                  border: isLight ? '1px solid #bae6fd' : '1px solid rgba(80, 219, 192, 0.25)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Mission Control
                </span>
              </h1>
            </div>

            <p style={{
              margin: 0,
              fontSize: 13.5,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} style={{ color: 'var(--accent-cyan)' }} />
                Queen Maud Land, Antarctica (70°45′58″S, 11°43′56″E)
              </span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>Elevation: 117m</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ color: isLight ? '#059669' : 'var(--status-active)', fontWeight: 600 }}>
                25 Wintering Crew On-Station
              </span>
            </p>
          </div>

          {/* Simulation & Heartbeat Status Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: isLight ? '#ffffff' : 'rgba(15, 20, 32, 0.85)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)',
            backdropFilter: 'blur(12px)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            {/* Live Clock / Tick */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Clock size={15} style={{ color: 'var(--accent-cyan)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Mission Clock
                </span>
                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatSimTime(simTime)}
                </span>
              </div>
            </div>

            <div style={{ width: 1, height: 26, background: 'var(--border-color)' }} />

            {/* Sim State Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: simStatus.toLowerCase() === 'running' ? '#4ade80' : '#f8d57e',
                boxShadow: `0 0 8px ${simStatus.toLowerCase() === 'running' ? '#4ade80' : '#f8d57e'}`,
                animation: simStatus.toLowerCase() === 'running' ? 'pulseDot 1.5s infinite' : 'none',
              }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Engine Pulse
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 800,
                  color: simStatus.toLowerCase() === 'running' ? 'var(--status-active)' : 'var(--accent-amber)',
                  textTransform: 'uppercase',
                }}>
                  {simStatus}
                </span>
              </div>
            </div>

            <div style={{ width: 1, height: 26, background: 'var(--border-color)' }} />

            {/* Scenario Link */}
            <button
              onClick={() => navigate(`/${selectedStation}/scenarios`)}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--radius-lg)',
              }}
              title="Open Deterministic Scenario Studio"
            >
              <Play size={12} style={{ color: 'var(--accent-primary)' }} />
              <span>{selectedScenarioId ? selectedScenarioId.slice(0, 16) : 'Run Scenarios'}</span>
              <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
           SECTION B: HIGH-PRECISION VITAL SIGNS (KPI GRID)
           ═══════════════════════════════════════════════════════ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
        }}>
          {/* KPI 1: Power Generation */}
          <div className="glass-panel stat-card fade-in delay-1" style={{
            padding: '20px 22px',
            borderRadius: 'var(--radius-xl)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">
                <Zap size={16} style={{ color: 'var(--accent-amber)' }} />
                <span>Station Power Output</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                color: 'var(--accent-amber)', background: 'rgba(248, 213, 126, 0.12)',
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
              }}>
                400V AC Bus
              </span>
            </div>
            <div className="stat-value" style={{ fontSize: 28, margin: '8px 0 4px 0' }}>
              {formatWatts(globalVitals.totalGenWatts)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Primary Turbine + Microgrid Active</span>
            </div>
          </div>

          {/* KPI 2: Thermal Equilibrium */}
          <div className="glass-panel stat-card fade-in delay-2" style={{
            padding: '20px 22px',
            borderRadius: 'var(--radius-xl)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">
                <Thermometer size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>Habitat Climate / Ambient</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                color: 'var(--accent-cyan)', background: 'rgba(56, 217, 245, 0.12)',
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
              }}>
                Thermal Stable
              </span>
            </div>
            <div className="stat-value" style={{ fontSize: 28, margin: '8px 0 4px 0' }}>
              +{globalVitals.habitatTemp} °C
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                / {globalVitals.externalTemp} °C Ext
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Katabatic Wind Chill: {globalVitals.windChill} °C</span>
            </div>
          </div>

          {/* KPI 3: System Operational Integrity */}
          <div className="glass-panel stat-card fade-in delay-3" style={{
            padding: '20px 22px',
            borderRadius: 'var(--radius-xl)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">
                <ShieldCheck size={16} style={{ color: globalVitals.failedNodes > 0 ? 'var(--accent-red)' : 'var(--status-active)' }} />
                <span>Subsystem Integrity</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                color: globalVitals.failedNodes > 0 ? '#ef4444' : 'var(--status-active)',
                background: globalVitals.failedNodes > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(74, 222, 128, 0.12)',
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
              }}>
                {globalVitals.healthPercent}% Online
              </span>
            </div>
            <div className="stat-value" style={{ fontSize: 28, margin: '8px 0 4px 0' }}>
              {globalVitals.activeNodes}
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                /{globalVitals.totalNodes} Nodes
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{globalVitals.failedNodes === 0 ? '0 Critical Alarms Detected' : `${globalVitals.failedNodes} Active Hardware Trip(s)`}</span>
            </div>
          </div>

          {/* KPI 4: Interconnect Topology */}
          <div className="glass-panel stat-card fade-in delay-4" style={{
            padding: '20px 22px',
            borderRadius: 'var(--radius-xl)',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
          onClick={() => navigate(`/${selectedStation}/connections`)}
          title="Inspect Complete Interconnection Graph"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">
                <Network size={16} style={{ color: 'var(--accent-purple)' }} />
                <span>Interconnect Pathways</span>
              </div>
              <ExternalLink size={14} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div className="stat-value" style={{ fontSize: 28, margin: '8px 0 4px 0' }}>
              {globalVitals.totalConnections}
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                Buses & Loops
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Power, Glycol Fluid & SCADA Signals</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
           SECTION C: MAIN COMMAND CENTER VIEWPORT (DUAL/TRIPLE MODE)
           ═══════════════════════════════════════════════════════ */}
        <div className="glass-panel fade-in delay-2" style={{
          borderRadius: 'var(--radius-xl)',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: isLight ? '1.5px solid #cbd5e1' : '1px solid rgba(80, 219, 192, 0.25)',
          boxShadow: isLight
            ? '0 12px 36px -8px rgba(0,0,0,0.08)'
            : '0 20px 50px -15px rgba(0,0,0,0.8), 0 0 30px rgba(80,219,192,0.08) inset',
        }}>
          {/* Command Viewport Header Navigation */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 22px',
            borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
            background: isLight ? '#f8fafc' : 'rgba(12, 16, 27, 0.95)',
            flexWrap: 'wrap',
            gap: 12,
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Radar size={18} style={{ color: isLight ? '#0284c7' : 'var(--accent-cyan)' }} />
              <div>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Spatial Telemetry Viewport
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8, fontFamily: 'monospace' }}>
                  {activeCenterView === '3d' ? 'Interactive 3D Digital Twin' : activeCenterView === 'satellite' ? 'Orbital SAR Satellite Telemetry' : 'Logical Interconnect Topology'}
                </span>
              </div>
            </div>

            {/* View Mode Switcher Pills */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: isLight ? '#e2e8f0' : 'rgba(0, 0, 0, 0.4)',
              padding: 4,
              borderRadius: 'var(--radius-full)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <button
                onClick={() => setActiveCenterView('3d')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 'var(--radius-full)',
                  border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: activeCenterView === '3d' ? (isLight ? '#ffffff' : 'var(--accent-primary)') : 'transparent',
                  color: activeCenterView === '3d' ? (isLight ? '#0f172a' : '#030a0f') : 'var(--text-secondary)',
                  boxShadow: activeCenterView === '3d' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers3 size={13} />
                <span>3D Spatial Twin</span>
              </button>

              <button
                onClick={() => setActiveCenterView('satellite')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 'var(--radius-full)',
                  border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: activeCenterView === 'satellite' ? (isLight ? '#ffffff' : 'var(--accent-primary)') : 'transparent',
                  color: activeCenterView === 'satellite' ? (isLight ? '#0f172a' : '#030a0f') : 'var(--text-secondary)',
                  boxShadow: activeCenterView === 'satellite' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Globe size={13} />
                <span>Geospatial Radar</span>
              </button>

              <button
                onClick={() => setActiveCenterView('topology')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 'var(--radius-full)',
                  border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: activeCenterView === 'topology' ? (isLight ? '#ffffff' : 'var(--accent-primary)') : 'transparent',
                  color: activeCenterView === 'topology' ? (isLight ? '#0f172a' : '#030a0f') : 'var(--text-secondary)',
                  boxShadow: activeCenterView === 'topology' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Network size={13} />
                <span>Topology Mesh</span>
              </button>
            </div>

            {/* Quick action: Jump to dedicated workspace */}
            <button
              onClick={() => {
                if (activeCenterView === '3d') navigate(`/${selectedStation}/twin`);
                else if (activeCenterView === 'satellite') navigate(`/${selectedStation}/components`);
                else navigate(`/${selectedStation}/connections`);
              }}
              className="btn btn-secondary btn-sm"
              style={{ gap: 6, fontSize: 12 }}
            >
              <span>Launch Full Workspace</span>
              <Maximize2 size={12} />
            </button>
          </div>

          {/* VIEWPORT CANVAS / CONTAINER */}
          <div style={{ position: 'relative', width: '100%', minHeight: 480, height: 480, overflow: 'hidden' }}>
            
            {/* ── Mode 1: 3D Holographic Twin ── */}
            {activeCenterView === '3d' && (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <StationHologram3D
                  isLight={isLight}
                  height="100%"
                  style={{
                    borderRadius: 0,
                    border: 'none',
                    boxShadow: 'none',
                  }}
                />
              </div>
            )}

            {/* ── Mode 2: Orbital Satellite & Geospatial Map ── */}
            {activeCenterView === 'satellite' && (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: 'url(/maitri_satellite.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Radar sweep scanning line animation */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(99,219,188,0.06) 50%, rgba(56,217,245,0.12) 100%)',
                  animation: 'scanline 5s linear infinite',
                  pointerEvents: 'none',
                }} />

                {/* Polar Coordinates Telemetry HUD */}
                <div style={{
                  position: 'absolute',
                  top: 18, left: 18,
                  zIndex: 5,
                  background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(8, 11, 19, 0.88)',
                  backdropFilter: 'blur(10px)',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 16px',
                  maxWidth: 320,
                  boxShadow: 'var(--shadow-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Compass size={14} style={{ color: 'var(--accent-cyan)' }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      SAR Geospatial Telemetry
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <div>LAT: 70°45′58″ S · LON: 11°43′56″ E</div>
                    <div>BASIN: Schirmacher Oasis / Lake Priyadarshini</div>
                    <div>SUN ELEVATION: 24.8° (Continuous Polar Light)</div>
                    <div>WIND: 18.4 kt SSE · KATABATIC GRADIENT</div>
                  </div>
                </div>

                {/* Subsystem Tactical Radar Pins */}
                {Object.values(SUBSYSTEM_CONFIGS).map((sub) => {
                  const isHovered = selectedSubsystemPin === sub.id;
                  const SubIcon = sub.icon;
                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleInspectSubsystem(sub.name)}
                      onMouseEnter={() => setSelectedSubsystemPin(sub.id)}
                      onMouseLeave={() => setSelectedSubsystemPin(null)}
                      style={{
                        position: 'absolute',
                        top: sub.pinCoord.top,
                        left: sub.pinCoord.left,
                        transform: 'translate(-50%, -50%)',
                        cursor: 'pointer',
                        zIndex: isHovered ? 20 : 10,
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      {/* Pulsing ring */}
                      <div style={{
                        position: 'absolute',
                        inset: -8,
                        borderRadius: '50%',
                        background: sub.accentBg,
                        border: `1px solid ${sub.borderAccent}`,
                        animation: 'pulseDot 2s infinite',
                        pointerEvents: 'none',
                      }} />

                      {/* Tactical Pin Button */}
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: isLight ? '#ffffff' : '#0c101b',
                        border: `2px solid ${sub.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: sub.color,
                        boxShadow: `0 0 16px ${sub.color}`,
                        transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                        transition: 'transform 0.2s ease',
                      }}>
                        <SubIcon size={18} />
                      </div>

                      {/* Tooltip on hover */}
                      {isHovered && (
                        <div style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%) translateY(-8px)',
                          background: isLight ? '#ffffff' : '#080b13',
                          border: `1px solid ${sub.color}`,
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          whiteSpace: 'nowrap',
                          boxShadow: 'var(--shadow-lg)',
                          zIndex: 30,
                          pointerEvents: 'none',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {sub.title}
                          </div>
                          <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: sub.color }}>
                            {sub.tag} · Click to Inspect
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Bottom satellite legend */}
                <div style={{
                  position: 'absolute',
                  bottom: 16, right: 16,
                  background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(8,11,19,0.85)',
                  backdropFilter: 'blur(8px)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulseDot 2s infinite' }} />
                  <span>SAR LIVE FEED · CLICK PINS TO INSPECT MODULES</span>
                </div>
              </div>
            )}

            {/* ── Mode 3: Interactive Topology Mini-Mesh ── */}
            {activeCenterView === 'topology' && (
              <div style={{
                width: '100%',
                height: '100%',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                background: isLight ? '#f8fafc' : '#080c16',
                position: 'relative',
              }}>
                {/* Medium Filter Pills */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  zIndex: 2,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Active Layer:
                  </span>
                  {(['all', 'power', 'fluid', 'data', 'signal'] as TopologyMedium[]).map((med) => (
                    <button
                      key={med}
                      onClick={() => setTopologyMedium(med)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        background: topologyMedium === med ? (isLight ? '#0284c7' : 'var(--accent-primary)') : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'),
                        color: topologyMedium === med ? (isLight ? '#ffffff' : '#030a0f') : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {med}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <TopologyMiniVisualizer activeMedium={topologyMedium} isLight={isLight} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
           SECTION D: REAL SUBSYSTEMS MATRIX (THE 6 POLAR BLOCKS)
           ═══════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Station Operational Subsystems
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Live operational health across 6 core Antarctic station blocks
              </p>
            </div>

            <button
              onClick={() => navigate(`/${selectedStation}/components`)}
              className="btn btn-secondary btn-sm"
              style={{ gap: 6 }}
            >
              <span>Complete Component Hierarchy</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* 6 Subsystem Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
          }}>
            {subsystems.map((sub, i) => {
              const SubIcon = sub.icon;
              const isFail = sub.status === 'failure';
              const isDegraded = sub.status === 'degraded';

              const statusColor = isFail ? '#ef4444' : isDegraded ? '#f8d57e' : 'var(--status-active)';
              const statusBg = isFail ? 'rgba(239, 68, 68, 0.12)' : isDegraded ? 'rgba(248, 213, 126, 0.12)' : 'rgba(74, 222, 128, 0.12)';
              const statusText = isFail ? 'HARDWARE TRIP' : isDegraded ? 'DEGRADED' : 'NOMINAL';

              return (
                <div
                  key={sub.id}
                  onClick={() => handleInspectSubsystem(sub.name)}
                  className="glass-panel card-hover fade-in"
                  style={{
                    borderRadius: 'var(--radius-xl)',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    border: isFail ? '1.5px solid rgba(239, 68, 68, 0.4)' : undefined,
                    animationDelay: `${i * 0.06}s`,
                    transition: 'all 0.25s ease',
                  }}
                >
                  {/* Radial accent glow */}
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    width: 140, height: 140,
                    background: `radial-gradient(circle at 100% 0%, ${sub.accentBg} 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }} />

                  <div>
                    {/* Header: Icon + Category + Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 44, height: 44,
                          borderRadius: 'var(--radius-lg)',
                          background: sub.accentBg,
                          border: `1px solid ${sub.borderAccent}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: sub.color,
                          boxShadow: `0 0 14px ${sub.accentBg}`,
                        }}>
                          <SubIcon size={22} />
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                            {sub.category}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {sub.title}
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                        padding: '3px 9px', borderRadius: 'var(--radius-full)',
                        background: statusBg,
                        color: statusColor,
                        border: `1px solid ${statusColor}33`,
                      }}>
                        <div style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: statusColor,
                          boxShadow: `0 0 6px ${statusColor}`,
                          animation: sub.status === 'active' ? 'pulseDot 2s infinite' : 'none',
                        }} />
                        {statusText}
                      </div>
                    </div>

                    <p style={{
                      fontSize: 12.5,
                      color: 'var(--text-secondary)',
                      margin: '0 0 16px 0',
                      lineHeight: 1.45,
                    }}>
                      {sub.description}
                    </p>
                  </div>

                  {/* Telemetry Chips & Action Row */}
                  <div style={{
                    paddingTop: 14,
                    borderTop: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {sub.primaryMetric}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {sub.secondaryMetric}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 700, color: isLight ? '#0284c7' : 'var(--accent-primary)',
                    }}>
                      <span>Inspect</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
           SECTION E: LIVE INCIDENT & DIAGNOSTIC STREAM
           ═══════════════════════════════════════════════════════ */}
        {activeAlerts.length > 0 ? (
          <div className="glass-panel fade-in" style={{
            borderRadius: 'var(--radius-xl)',
            padding: '20px 24px',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            background: isLight ? '#fef2f2' : 'rgba(40, 10, 15, 0.65)',
            boxShadow: '0 8px 30px rgba(239, 68, 68, 0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.01em' }}>
                  Active Hardware & Simulation Warnings ({activeAlerts.length})
                </span>
              </div>
              <button
                onClick={() => navigate(`/${selectedStation}/diagnostics`)}
                className="btn btn-sm"
                style={{
                  background: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 700,
                  fontSize: 11.5, gap: 6,
                }}
              >
                <span>Open Telemetry Lab</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeAlerts.map(alert => (
                <div key={alert.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.4)',
                  border: isLight ? '1px solid #fecaca' : '1px solid rgba(239, 68, 68, 0.25)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{alert.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>— {alert.desc}</span>
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#ef4444', fontWeight: 700 }}>
                    {alert.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-panel fade-in" style={{
            borderRadius: 'var(--radius-xl)',
            padding: '16px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: isLight ? '#f0fdf4' : 'rgba(10, 30, 22, 0.45)',
            border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(74, 222, 128, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} style={{ color: 'var(--status-active)' }} />
              <div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                  All Base Subsystems Nominal
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  Continuous deterministic physics & telemetry monitoring active. Zero unhandled trips.
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate(`/${selectedStation}/diagnostics`)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11.5, gap: 5 }}
            >
              <span>Historical Telemetry</span>
              <ArrowRight size={11} />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           SECTION F: WORKSPACE LAUNCHPADS (DECK NAVIGATION)
           ═══════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Mission Operations Workspaces
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {[
              {
                title: '3D Digital Twin',
                route: `/${selectedStation}/twin`,
                icon: Layers3,
                color: '#38d9f5',
                desc: 'Full 3D CAD spatial view with component breakdown & free-fly orbit.',
              },
              {
                title: 'Logical Topology',
                route: `/${selectedStation}/connections`,
                icon: Network,
                color: '#50dbc0',
                desc: 'Cytoscape & ELK circuit graphs, fluid pipes & signal transmission.',
              },
              {
                title: 'Scenario Engine',
                route: `/${selectedStation}/scenarios`,
                icon: Play,
                color: '#f8d57e',
                desc: 'Deterministic `.scene` script execution, timeline playout & failure tests.',
              },
              {
                title: 'Diagnostics Lab',
                route: `/${selectedStation}/diagnostics`,
                icon: Activity,
                color: '#a78bfa',
                desc: 'Time-series telemetry curves, historical simulation records & anomalies.',
              },
            ].map(w => {
              const Icon = w.icon;
              return (
                <div
                  key={w.title}
                  onClick={() => navigate(w.route)}
                  className="glass-panel card-hover"
                  style={{
                    borderRadius: 'var(--radius-xl)',
                    padding: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 130,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-md)',
                        background: `${w.color}15`,
                        border: `1px solid ${w.color}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: w.color,
                      }}>
                        <Icon size={16} />
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {w.title}
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                      {w.desc}
                    </p>
                  </div>

                  <div style={{
                    marginTop: 14,
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11.5, fontWeight: 700, color: w.color,
                  }}>
                    <span>Open Workspace</span>
                    <ArrowRight size={12} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <Footer />
    </div>
  );
}
