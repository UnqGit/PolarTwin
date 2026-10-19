import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Box, Network, Layers, MonitorPlay,
  AlertTriangle, ArrowRight, CheckCircle2,
  Cpu, Zap, Droplets, Radio, ShieldCheck, ExternalLink
} from 'lucide-react';

export interface WorkspaceItem {
  id: string;
  name: string;
  route: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; strokeWidth?: number }>;
  color: string;
  tagline: string;
  description: string;
  capabilities: string[];
  mockStats: { label: string; value: string; unit?: string }[];
  previewType: 'scada' | 'spatial' | 'graph' | 'tree' | 'timeline' | 'diagnostics';
}

const WORKSPACES: WorkspaceItem[] = [
  {
    id: 'overview',
    name: 'SCADA Telemetry Overview',
    route: 'overview',
    badge: 'Real-Time Telemetry',
    icon: Activity,
    color: '#50dbc0',
    tagline: 'High-frequency mission operations dashboard and vital signs',
    description: 'Aggregates power grid distribution, heating loop circulation, diesel fuel consumption curves, and ambient katabatic weather into an integrated SCADA command console updated at 10Hz without React re-render lag.',
    capabilities: [
      'Sub-second bus voltage & current telemetry streaming',
      'Dynamic power generation split (Diesel turbines vs Solar PV)',
      'Automated fuel reserve exhaustion projection (Days of Autonomy)',
      'Threshold trip alerts with visual acoustic telemetry status'
    ],
    mockStats: [
      { label: 'Bus Voltage', value: '400.2', unit: 'V AC' },
      { label: 'Grid Delivery', value: '86.4', unit: 'kW' },
      { label: 'Fuel Autonomy', value: '148', unit: 'Days' },
      { label: 'Thermal Delta', value: '+39.4', unit: '°C' },
    ],
    previewType: 'scada',
  },
  {
    id: 'twin',
    name: '3D Spatial Digital Twin',
    route: 'twin',
    badge: 'Three.js / WebGL',
    icon: Box,
    color: '#38d9f5',
    tagline: 'Physical station architecture with micro-level component raycasting',
    description: 'Renders the exact geometric layout of the Antarctic station compiled from hierarchy.twin. Engineers can rotate, zoom, and inspect individual equipment blocks with real-time thermal dissipation halos and status bounding boxes.',
    capabilities: [
      'Interactive 3D OrbitControls with raycasted hit testing',
      'Dynamic thermal radiation and heat loss visual halos',
      'Individual mesh inspections for generators, pumps, tanks, and solar racks',
      'BakeShadows optimization for 60 FPS performance on laptops'
    ],
    mockStats: [
      { label: 'Active Meshes', value: '141', unit: 'Units' },
      { label: 'FPS Target', value: '60.0', unit: 'Smooth' },
      { label: 'Camera Distance', value: '18.4', unit: 'm' },
      { label: 'Raycast Time', value: '< 2.0', unit: 'ms' },
    ],
    previewType: 'spatial',
  },
  {
    id: 'connections',
    name: 'Multi-Domain Topology Graph',
    route: 'connections',
    badge: 'Cytoscape + ELK',
    icon: Network,
    color: '#a78bfa',
    tagline: 'Deterministic directed acyclic graph across 4 physical mediums',
    description: 'Visualizes the complete operational connectivity of the station. Segregates electrical power lines, fluid cooling pipes, SCADA data cables, and satellite signal links into cleanly routed non-overlapping layers using ELK stress algorithms.',
    capabilities: [
      '4 Isolated Physical Domains: Power, Fluid, Data, Signal',
      'Directional cascade tracing from upstream source to consumer',
      'Automated layout switching (FCose force-directed & ELK layered)',
      'Instant isolation of disconnected or damaged conduits'
    ],
    mockStats: [
      { label: 'Physical Links', value: '270', unit: 'Edges' },
      { label: 'Network Domains', value: '4', unit: 'Isolated' },
      { label: 'Drop Rate', value: '0.00', unit: '%' },
      { label: 'Layout Algorithm', value: 'ELK Layered', unit: '' },
    ],
    previewType: 'graph',
  },
  {
    id: 'components',
    name: 'Component Hierarchy & Specs',
    route: 'components',
    badge: 'DSL AST Model',
    icon: Layers,
    color: '#f8d57e',
    tagline: 'Structured engineering taxonomy with canonical unit conversion',
    description: 'Provides deep structural inspection from Campus down to individual sensors. Displays engineering ratings, dimension specs, type defaults, and live override states strictly compiled from the authoritative .twin source code.',
    capabilities: [
      'Strict 6-Level Hierarchy: Campus → Station → Floor → Block → System → Component',
      'Automatic canonical unit multipliers (kW, MW, V, kV, bar, L/min)',
      'Fast search filter across 140+ components by category or tag',
      'Inspect input/output ports and operational rating tolerances'
    ],
    mockStats: [
      { label: 'Hierarchy Depth', value: '6', unit: 'Levels' },
      { label: 'Component Types', value: '18', unit: 'Classes' },
      { label: 'Overrides', value: '42', unit: 'Custom' },
      { label: 'Compilation Time', value: '14', unit: 'ms' },
    ],
    previewType: 'tree',
  },
  {
    id: 'scenarios',
    name: 'Scenario Timeline Studio',
    route: 'scenarios',
    badge: 'Deterministic Tick Engine',
    icon: MonitorPlay,
    color: '#fbbf24',
    tagline: 'Reproducible time scrubbing and disaster injection drills',
    description: 'Advances the station using discrete 15-second simulation ticks (240 ticks = 1 hour). Executes scripted .scene scenarios, pushes fault layers onto a reversible LIFO stack, and unwinds changes back to baseline when events expire.',
    capabilities: [
      'Strict discrete-event reproducibility (zero race conditions)',
      'Interactive timeline scrubber with fast-forward (1x, 2x, 5x, 10x)',
      'Reversible LIFO event stack for zero-leak fault injection',
      'Side-by-side branch comparison (Branch A Nominal vs Branch B Disaster)'
    ],
    mockStats: [
      { label: 'Tick Resolution', value: '15', unit: 'Sec/Tick' },
      { label: '1 Sim Hour', value: '240', unit: 'Ticks' },
      { label: 'Event Stack', value: 'LIFO', unit: 'Reversible' },
      { label: 'Horizon', value: '48.0', unit: 'Hours' },
    ],
    previewType: 'timeline',
  },
  {
    id: 'diagnostics',
    name: 'Cascading Failure Diagnostics',
    route: 'diagnostics',
    badge: 'Autonomous RCA',
    icon: AlertTriangle,
    color: '#f87171',
    tagline: 'Topological anomaly detection and root-cause isolation',
    description: 'When complex interdependent systems fail in a blizzard, secondary alarms can flood the control room. PolarTwin traces the topological causal chain, isolating the primary root cause within 15ms and recommending mitigation.',
    capabilities: [
      'Instant differentiation between primary root cause and secondary symptoms',
      'Algorithmic confidence scoring based on spec ratings and graph proximity',
      'Automated load-shedding recommendations to protect life support',
      'Containment latency metrics and historical post-mortem logs'
    ],
    mockStats: [
      { label: 'Inference Latency', value: '12', unit: 'ms' },
      { label: 'RCA Confidence', value: '99.4', unit: '%' },
      { label: 'Isolated Alarms', value: '14', unit: 'Secondary' },
      { label: 'Containment', value: '< 20', unit: 'ms' },
    ],
    previewType: 'diagnostics',
  },
];

export function CommandCenterTour({
  stationId = 'Maitri',
  isLight = false,
}: {
  stationId?: string;
  isLight?: boolean;
}) {
  const [activeTabId, setActiveTabId] = useState('overview');

  const activeWorkspace = WORKSPACES.find(w => w.id === activeTabId) || WORKSPACES[0];
  const ActiveIcon = activeWorkspace.icon;

  const cardBg = isLight ? '#ffffff' : 'rgba(12, 16, 27, 0.75)';
  const cardBorder = isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)';
  const innerBg = isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.35)';
  const innerBorder = isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)';

  return (
    <section style={{
      padding: '90px 24px',
      background: isLight ? '#f8fafc' : 'var(--bg-main)',
      position: 'relative',
      borderTop: '1px solid var(--border-color)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* ── Section Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ height: 2, width: 40, background: 'linear-gradient(to right, transparent, var(--accent-primary))', borderRadius: 2 }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
              Mission Control Suite
            </span>
            <div style={{ height: 2, width: 40, background: 'linear-gradient(to left, transparent, var(--accent-primary))', borderRadius: 2 }} />
          </div>

          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 16px 0', letterSpacing: '-0.03em' }}>
            Inside the PolarTwin Command Center
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: '0 auto', maxWidth: 680, lineHeight: 1.65 }}>
            PolarTwin is more than a simulation engine—it is a full-fledged operations center. Explore the 6 dedicated workspaces engineered for remote Antarctic base management.
          </p>
        </div>

        {/* ── 6 Workspace Navigation Tabs ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          marginBottom: 32,
        }}>
          {WORKSPACES.map(ws => {
            const active = ws.id === activeTabId;
            const IconComponent = ws.icon;
            return (
              <button
                key={ws.id}
                onClick={() => setActiveTabId(ws.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: active
                    ? (isLight ? '#ffffff' : 'rgba(80, 219, 192, 0.12)')
                    : (isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.03)'),
                  border: active
                    ? `1.5px solid ${ws.color}`
                    : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)'),
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: active
                    ? (isLight ? '0 6px 18px rgba(0,0,0,0.06)' : `0 0 20px ${ws.color}25`)
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: active ? `${ws.color}25` : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ws.color,
                  flexShrink: 0,
                }}>
                  <IconComponent size={18} strokeWidth={2.4} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: active ? 800 : 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {ws.name.replace(/^(SCADA |Multi-Domain |Component |Cascading )/, '')}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {ws.badge}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Active Workspace Featured Showcase ── */}
        <div style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 'var(--radius-xl)',
          padding: '36px',
          boxShadow: isLight ? '0 12px 40px rgba(0,0,0,0.05)' : 'var(--shadow-lg)',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 32,
          alignItems: 'center',
        }}>

          {/* Left Column: Details & Capabilities */}
          <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                background: `${activeWorkspace.color}20`,
                color: activeWorkspace.color,
                border: `1px solid ${activeWorkspace.color}40`,
              }}>
                {activeWorkspace.badge}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                Route: /{stationId}/{activeWorkspace.route}
              </span>
            </div>

            <div>
              <h3 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 10px 0', letterSpacing: '-0.02em' }}>
                {activeWorkspace.name}
              </h3>
              <p style={{ fontSize: 15, fontWeight: 600, color: activeWorkspace.color, margin: '0 0 12px 0' }}>
                {activeWorkspace.tagline}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                {activeWorkspace.description}
              </p>
            </div>

            {/* 4 Key Capabilities List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0' }}>
              {activeWorkspace.capabilities.map((cap, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={16} style={{ color: activeWorkspace.color, flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {cap}
                  </span>
                </div>
              ))}
            </div>

            {/* Launch CTA Button */}
            <div style={{ marginTop: 8 }}>
              <Link
                to={`/${stationId}/${activeWorkspace.route}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-full)',
                  background: isLight ? '#0284c7' : 'var(--accent-primary)',
                  color: isLight ? '#ffffff' : '#030A0F',
                  fontWeight: 800,
                  fontSize: 14,
                  textDecoration: 'none',
                  boxShadow: isLight
                    ? '0 6px 20px rgba(2, 132, 199, 0.35)'
                    : '0 0 25px rgba(80, 219, 192, 0.35)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <span>Launch {activeWorkspace.name} for {stationId}</span>
                <ArrowRight size={17} strokeWidth={2.5} />
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Live Preview Card */}
          <div style={{
            gridColumn: 'span 6',
            background: innerBg,
            border: innerBorder,
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            {/* Top Preview Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: innerBorder, paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: `${activeWorkspace.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: activeWorkspace.color,
                }}>
                  <ActiveIcon size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Live Operational Node: {stationId} Station
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                    Telemetry Stream: ACTIVE (10 Hz)
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(74, 222, 128, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(74, 222, 128, 0.3)',
              }}>
                SYNCHRONIZED
              </div>
            </div>

            {/* 4 Live Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {activeWorkspace.mockStats.map((stat, i) => (
                <div key={i} style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)',
                  border: innerBorder,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: activeWorkspace.color, marginTop: 4 }}>
                    {stat.value} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stat.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Preview Canvas / Diagram Banner */}
            <div style={{
              padding: '16px',
              borderRadius: 8,
              background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)',
              border: innerBorder,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontSize: 12,
              fontFamily: 'monospace',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: 11 }}>
                <span>WORKSPACE SIGNATURE</span>
                <span style={{ color: activeWorkspace.color }}>Spec §{activeWorkspace.id === 'overview' ? '4' : activeWorkspace.id === 'twin' ? '6' : activeWorkspace.id === 'connections' ? '8' : activeWorkspace.id === 'components' ? '3' : activeWorkspace.id === 'scenarios' ? '13' : '15'}</span>
              </div>

              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {activeWorkspace.id === 'overview' && '▶ [SCADA] Bus 400V Nominal | Diesel Turbines: 2 Online | Fuel Burn: 12.4 L/h | Grid Load: 68%'}
                {activeWorkspace.id === 'twin' && '▶ [Three.js] Viewport Bounds [-8, +8] | Stilt clearance: 1.4m | Radome Satellite link online'}
                {activeWorkspace.id === 'connections' && '▶ [Topology] 270 Links Routed | Power: 88 | Fluid: 64 | Data: 72 | Signal: 46 | Zero Cross-Domain Leaks'}
                {activeWorkspace.id === 'components' && '▶ [AST Tree] Campus:Maitri → Block:MainPod → Generator:Diesel1 → Output:400V AC (Canonical)'}
                {activeWorkspace.id === 'scenarios' && '▶ [Timeline] T+0.0h → T+48.0h | 1 Tick = 15 Sec | Deterministic Playback | LIFO Event Stack Clean'}
                {activeWorkspace.id === 'diagnostics' && '▶ [RCA Tracer] Anomaly Ingestion → Graph Traversal → Root Isolated: Gen1 Breaker Sag (12ms)'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Link
                  to={`/${stationId}/${activeWorkspace.route}`}
                  style={{
                    color: activeWorkspace.color,
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>Open Full Workspace</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
