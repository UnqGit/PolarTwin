import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStation } from '../components/StationContext';
import {
  Activity, Thermometer, Zap, Box, AlertTriangle, Package, Radar,
  Cpu, Server, Radio, Wind, Droplets, BatteryCharging, ShieldCheck,
  Globe, Sun, Fan, Layers, Database, HardDrive, Wifi, Workflow, Compass, Gauge, Building2,
  Flame, Snowflake, Eye, Waves
} from 'lucide-react';
import { IMAGE_MAP } from '../lib/constants';
import { Footer } from '../components/Footer';

export interface BlockData {
  id: string;
  name: string;
  type?: string;
  status: 'active' | 'inactive' | 'failure';
  img: string;
  innerTotal: number;
  innerActive: number;
  path: string[];
}

function getComponentIcon(type?: string, name?: string) {
  const t = (type || '').toLowerCase();
  const n = (name || '').toLowerCase();

  const isSensor = t.includes('sensor') || n.includes('sensor');
  const isTelemetry = t.includes('telemetry') || n.includes('telemetry') || n.includes('signal');
  const isThermal = t.includes('thermal') || n.includes('thermal') || t.includes('temp') || n.includes('temp') || n.includes('heat') || n.includes('cold');

  // Sensor / Telemetry / Thermal specialized SVG matching
  if (isSensor || isTelemetry || isThermal) {
    if (n.includes('temp') || n.includes('heat') || n.includes('thermal')) {
      if (n.includes('cold') || n.includes('cryo') || n.includes('freeze') || n.includes('subzero') || n.includes('polar')) return Snowflake;
      if (n.includes('fire') || n.includes('hot') || n.includes('combust')) return Flame;
      return Thermometer;
    }
    if (n.includes('press') || n.includes('gauge') || n.includes('baro') || n.includes('psi')) return Gauge;
    if (n.includes('vibr') || n.includes('seismic') || n.includes('wave') || n.includes('accel') || n.includes('sound')) return Waves;
    if (n.includes('opt') || n.includes('laser') || n.includes('vision') || n.includes('cam') || n.includes('light')) return Eye;
    if (n.includes('humid') || n.includes('moist') || n.includes('dew')) return Droplets;
    if (n.includes('wind') || n.includes('anemo') || n.includes('flow')) return Wind;
    if (n.includes('radar') || n.includes('sonar') || n.includes('prox')) return Radar;
    if (n.includes('gyro') || n.includes('compass') || n.includes('orient') || n.includes('tilt')) return Compass;
    if (n.includes('pulse') || n.includes('freq') || n.includes('stat')) return Activity;

    // Rich diverse set of sensor/telemetry/thermal SVG icons
    const sensorIcons = [Thermometer, Gauge, Activity, Radar, Waves, Flame, Snowflake, Eye, Compass, Droplets];
    const sHash = Math.abs(n.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0));
    return sensorIcons[sHash % sensorIcons.length];
  }

  // Power / Generator / Energy
  if (t.includes('power') || t.includes('generator') || n.includes('power') || n.includes('gen') || n.includes('watt')) return Zap;
  if (t.includes('solar') || n.includes('solar') || n.includes('panel')) return Sun;
  if (t.includes('battery') || n.includes('battery') || n.includes('cell')) return BatteryCharging;
  if (t.includes('antenna') || t.includes('comm') || n.includes('antenna') || n.includes('radio')) return Radio;
  if (t.includes('wifi') || n.includes('wifi') || n.includes('network')) return Wifi;
  if (t.includes('server') || n.includes('server') || n.includes('host')) return Server;
  if (t.includes('controller') || t.includes('cpu') || n.includes('cpu') || n.includes('processor') || n.includes('control')) return Cpu;
  if (t.includes('db') || t.includes('database') || n.includes('data') || n.includes('db')) return Database;
  if (t.includes('pump') || t.includes('fluid') || n.includes('pump') || n.includes('water') || n.includes('fluid') || n.includes('cool')) return Droplets;
  if (t.includes('vent') || t.includes('hvac') || t.includes('air') || n.includes('vent') || n.includes('fan') || n.includes('hvac')) return Wind;
  if (t.includes('storage') || t.includes('warehouse') || n.includes('storage') || n.includes('stock')) return Package;
  if (t.includes('alarm') || t.includes('security') || n.includes('alarm') || n.includes('sec')) return ShieldCheck;
  if (t.includes('building') || t.includes('campus') || t.includes('block') || n.includes('block') || n.includes('zone')) return Building2;

  const fallbackIcons = [Cpu, Layers, Workflow, Compass, Gauge, Globe, HardDrive, Fan];
  const hash = Math.abs(n.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0));
  return fallbackIcons[hash % fallbackIcons.length];
}

const STYLE_INJECTION = `
  @keyframes scanline {
    0% { transform: translateY(-100%); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 20px currentColor; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .metric-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .metric-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 230, 118, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
  }
  .grid-card {
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .grid-card:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 14px 32px -5px rgba(0, 0, 0, 0.6), 0 0 20px var(--card-glow, rgba(0, 230, 118, 0.25));
    border-color: var(--card-border-hover, rgba(255, 255, 255, 0.3));
  }
  .fade-enter {
    animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .overview-container::-webkit-scrollbar {
    display: none;
  }
  .overview-container {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

function GridCard({ block, fading, onClick }: { block: BlockData; fading: boolean; onClick: () => void }) {
  if (!block) return null;

  const isFailure = block.status === 'failure';
  const isInactive = block.status === 'inactive';

  const statusColor = isFailure
    ? '#ef4444'
    : isInactive
    ? 'var(--text-tertiary)'
    : 'var(--accent-blue)';

  const cardGlow = isFailure
    ? 'rgba(239, 68, 68, 0.25)'
    : isInactive
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(59, 130, 246, 0.25)';

  const cardBorderHover = isFailure
    ? 'rgba(239, 68, 68, 0.5)'
    : isInactive
    ? 'rgba(255, 255, 255, 0.25)'
    : 'rgba(59, 130, 246, 0.5)';

  const iconBg = isFailure
    ? 'rgba(239, 68, 68, 0.12)'
    : isInactive
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(59, 130, 246, 0.12)';

  const ComponentIcon = getComponentIcon(block.type, block.name);

  return (
    <div
      className="grid-card glass-panel"
      onClick={onClick}
      style={{
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        aspectRatio: '1',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-md)',
        padding: '28px 20px',
        border: '1px solid var(--border-color)',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: fading ? 0 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.005) 100%)',
        ['--card-glow' as any]: cardGlow,
        ['--card-border-hover' as any]: cardBorderHover,
      }}
    >
      {/* Background radial accent glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)`,
          pointerEvents: 'none',
          opacity: 0.65,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          zIndex: 2,
          width: '100%',
        }}
      >
        {/* Minimalist Component Symbol Logo - Vibrant Blue */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 18px rgba(59, 130, 246, 0.25)',
            transition: 'transform 0.3s ease',
          }}
        >
          <ComponentIcon size={26} color="#3b82f6" />
        </div>

        {/* Block Title */}
        <span
          style={{
            fontWeight: 700,
            fontSize: '17px',
            color: 'var(--text-primary)',
            lineHeight: 1.25,
            wordBreak: 'break-word',
            maxWidth: '100%',
          }}
        >
          {block.name}
        </span>

        {/* Status Pill Tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.8px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: iconBg,
            border: `1px solid ${statusColor}30`,
            color: statusColor,
            textTransform: 'uppercase',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
            }}
          />
          {block.status}
        </div>

        {/* Nested Active Nodes Count */}
        {block.innerTotal > 0 && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '2px',
            }}
          >
            <span>
              {block.innerActive} / {block.innerTotal} Active nodes
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Overview() {
  const { selectedStation, hierarchy, liveStateRef, simTime } = useStation();
  const navigate = useNavigate();

  const [telemetry] = useState({
    powerOutput: '1.2 MW',
    temperature: '-18.5 °C',
    nextSupply: '14 Days'
  });

  const hierarchyData = hierarchy || [];

  const stats = useMemo(() => {
    const totalComponents = hierarchyData.length;
    const activeComponents = totalComponents;
    return {
      activeComponents,
      totalComponents,
      ...telemetry
    };
  }, [hierarchyData, telemetry]);

  const blocks = useMemo(() => {
    // Build parent map to quickly get paths
    const parentMap = new Map<string, string>();
    hierarchyData.forEach((n: any) => {
      if (n.children) {
        n.children.forEach((c: string) => parentMap.set(c, n.name));
      }
    });

    const getPath = (name: string) => {
      const path = [];
      let curr: string | undefined = parentMap.get(name);
      while (curr) {
        path.unshift(curr);
        curr = parentMap.get(curr);
      }
      return path;
    };

    const blockNodes = hierarchyData.filter((n: any) => n.type !== 'station');
    return blockNodes.map((b: any, i: number) => {
      const allDescendants = new Set<string>();
      const queue = [...(b.children || [])];
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr && !allDescendants.has(curr)) {
          allDescendants.add(curr);
          const node = hierarchyData.find((n: any) => n.name === curr);
          if (node && node.children) queue.push(...node.children);
        }
      }

      // Extract real status if available
      let status: 'active' | 'inactive' | 'failure' = 'active';
      if (liveStateRef?.current?.[b.name]) {
        const compState: any = liveStateRef.current[b.name];
        if (compState.status === 'failure') status = 'failure';
        else if (compState.status === 'inactive') status = 'inactive';
      }

      return {
        id: b.name,
        name: b.name,
        type: b.type,
        status,
        img: IMAGE_MAP[b.type] || IMAGE_MAP.default,
        innerTotal: allDescendants.size,
        innerActive: allDescendants.size,
        path: getPath(b.name)
      };
    });
  }, [hierarchyData, liveStateRef, simTime]);

  const numGrids = useMemo(() => {
    return Math.max(1, Math.floor(Math.log2(blocks.length || 1)));
  }, [blocks.length]);

  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const [isFading, setIsFading] = useState(false);

  // Initialize random indices
  useEffect(() => {
    if (blocks.length === 0) return;
    const initial: number[] = [];
    for (let i = 0; i < numGrids; i++) {
      initial.push(Math.floor(Math.random() * blocks.length));
    }
    setActiveIndices(initial);
  }, [blocks.length, numGrids]);

  // Synchronized rotation
  useEffect(() => {
    if (blocks.length <= numGrids) return; // Not enough blocks to rotate

    const intervalTime = 6000; // Rotate every 6s
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        // Pick new random indices
        setActiveIndices(prev => {
          return prev.map(() => Math.floor(Math.random() * blocks.length));
        });
        setIsFading(false);
      }, 600); // 600ms fade out before swapping
    }, intervalTime);

    return () => clearInterval(timer);
  }, [blocks.length, numGrids]);

  const handleCardClick = (block: BlockData) => {
    if (!selectedStation) return;
    navigate(`/${selectedStation}/components`, {
      state: {
        drillStack: block.path,
        inspectNodeName: block.name
      }
    });
  };

  return (
    <div className="overview-container fade-enter" style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <style>{STYLE_INJECTION}</style>
      <div style={{ padding: '32px 40px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>{selectedStation || 'Loading...'} Overview</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>System status and high-level telemetry</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '28px', marginBottom: '40px' }}>
          {/* Satellite View */}
          <div className="glass-panel" style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
            minHeight: '340px'
          }}>
            <div style={{ padding: '24px 32px', position: 'absolute', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Radar size={22} color="var(--accent-cyan)" />
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '0.5px' }}>Satellite View</h2>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Live spatial telemetry feed</p>
            </div>

            <div style={{
              flex: 1,
              backgroundImage: 'url(/maitri_satellite.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, height: '100%',
                background: 'linear-gradient(to bottom, transparent 0%, rgba(181, 102, 255, 0.1) 50%, rgba(0, 230, 118, 0.2) 100%)',
                animation: 'scanline 5s linear infinite'
              }} />

              <div style={{ position: 'absolute', top: '35%', left: '28%', color: 'var(--accent-cyan)' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 2.5s infinite' }} />
              </div>
              <div style={{ position: 'absolute', top: '65%', left: '72%', color: 'var(--accent-blue)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 3s infinite 1s' }} />
              </div>
              <div style={{ position: 'absolute', top: '45%', left: '60%', color: 'var(--accent-amber)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor', animation: 'pulse-dot 4s infinite 0.5s' }} />
              </div>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                <Activity size={24} color="var(--accent-blue)" />
                <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Components</span>
              </div>
              <div style={{ fontSize: '36px', fontWeight: 800, marginTop: '16px', letterSpacing: '-1px' }}>
                <span style={{ color: 'var(--text-primary)' }}>{stats.activeComponents}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '20px', fontWeight: 600 }}> / {stats.totalComponents}</span>
              </div>
            </div>

            <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                <Zap size={24} color="var(--accent-amber)" />
                <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Power</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '16px', color: 'var(--text-primary)' }}>
                {stats.powerOutput}
              </div>
            </div>

            <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                <Thermometer size={24} color="var(--accent-cyan)" />
                <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Temp</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '16px', color: 'var(--text-primary)' }}>
                {stats.temperature}
              </div>
            </div>

            <div className="glass-panel metric-card" style={{ padding: '28px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                <Package size={24} color="var(--text-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Supply</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '16px', color: 'var(--text-primary)' }}>
                {stats.nextSupply}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Component Matrix</h2>
          </div>

          {blocks.length > 0 && activeIndices.length === numGrids ? (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '24px',
              paddingBottom: '32px'
            }}>
              {activeIndices.map((blockIdx, i) => (
                <div className="fade-enter" style={{ width: '240px', flex: '0 0 240px', animationDelay: `${i * 0.08}s` }} key={i}>
                  <GridCard
                    block={blocks[blockIdx]}
                    fading={isFading}
                    onClick={() => handleCardClick(blocks[blockIdx])}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '16px' }}>
              No components available in the matrix.
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
