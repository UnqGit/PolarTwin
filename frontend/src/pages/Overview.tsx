import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStation } from '../components/StationContext';
import { useTheme } from '../components/ThemeContext';
import {
  Activity, Thermometer, Zap, Box, Package, Radar,
  Cpu, Server, Radio, Wind, Droplets, BatteryCharging, ShieldCheck,
  Globe, Sun, Fan, Layers, Database, HardDrive, Wifi, Workflow, Compass, Gauge, Building2,
  Flame, Snowflake, Eye, Waves, ArrowRight
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
    const sensorIcons = [Thermometer, Gauge, Activity, Radar, Waves, Flame, Snowflake, Eye, Compass, Droplets];
    const sHash = Math.abs(n.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0));
    return sensorIcons[sHash % sensorIcons.length];
  }

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

function GridCard({ block, fading, onClick }: { block: BlockData; fading: boolean; onClick: () => void }) {
  if (!block) return null;

  const isFailure = block.status === 'failure';
  const isInactive = block.status === 'inactive';

  const statusColor = isFailure ? 'var(--accent-red)'
    : isInactive ? 'var(--status-inactive)'
    : 'var(--accent-primary)';

  const glowColor = isFailure ? 'rgba(248,113,113,0.18)'
    : isInactive ? 'rgba(255,255,255,0.04)'
    : 'rgba(99,219,188,0.15)';

  const iconBg = isFailure ? 'rgba(248,113,113,0.1)'
    : isInactive ? 'rgba(255,255,255,0.04)'
    : 'rgba(99,219,188,0.1)';

  const iconBorder = isFailure ? 'rgba(248,113,113,0.28)'
    : isInactive ? 'rgba(255,255,255,0.1)'
    : 'rgba(99,219,188,0.25)';

  const ComponentIcon = getComponentIcon(block.type, block.name);

  return (
    <div
      onClick={onClick}
      className="glass-panel card-hover"
      style={{
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        position: 'relative',
        aspectRatio: '1',
        cursor: 'pointer',
        padding: '24px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease, transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease',
      }}
    >
      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${glowColor} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '11px', zIndex: 2, width: '100%',
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52,
          borderRadius: 'var(--radius-lg)',
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: statusColor,
          boxShadow: `0 0 16px ${glowColor}`,
          transition: 'transform 0.25s ease',
        }}>
          <ComponentIcon size={24} />
        </div>

        {/* Name */}
        <span style={{
          fontWeight: 700, fontSize: '14px',
          color: 'var(--text-primary)',
          lineHeight: 1.25,
          wordBreak: 'break-word',
          maxWidth: '100%',
        }}>
          {block.name}
        </span>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
          padding: '3px 9px', borderRadius: 'var(--radius-full)',
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          color: statusColor,
          textTransform: 'uppercase',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 5px ${statusColor}`,
            animation: block.status === 'active' ? 'pulseDot 2.5s infinite' : 'none',
          }} />
          {block.status}
        </div>

        {/* Child count */}
        {block.innerTotal > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {block.innerActive}/{block.innerTotal} nodes
          </div>
        )}
      </div>
    </div>
  );
}

export function Overview() {
  const { theme } = useTheme();
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
    return { activeComponents, totalComponents, ...telemetry };
  }, [hierarchyData, telemetry]);

  const blocks = useMemo(() => {
    const parentMap = new Map<string, string>();
    hierarchyData.forEach((n: any) => {
      if (n.children) n.children.forEach((c: string) => parentMap.set(c, n.name));
    });

    const getPath = (name: string) => {
      const path = [];
      let curr: string | undefined = parentMap.get(name);
      while (curr) { path.unshift(curr); curr = parentMap.get(curr); }
      return path;
    };

    const blockNodes = hierarchyData.filter((n: any) => n.type !== 'station');
    return blockNodes.map((b: any) => {
      const allDescendants = new Set<string>();
      const queue = [...(b.children || [])];
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr && !allDescendants.has(curr)) {
          allDescendants.add(curr);
          const node = hierarchyData.find((n: any) => n.name === curr);
          if (node?.children) queue.push(...node.children);
        }
      }

      let status: 'active' | 'inactive' | 'failure' = 'active';
      if (liveStateRef?.current?.[b.name]) {
        const compState: any = liveStateRef.current[b.name];
        if (compState.status === 'failure') status = 'failure';
        else if (compState.status === 'inactive') status = 'inactive';
      }

      return {
        id: b.name, name: b.name, type: b.type, status,
        img: IMAGE_MAP[b.type] || IMAGE_MAP.default,
        innerTotal: allDescendants.size,
        innerActive: allDescendants.size,
        path: getPath(b.name),
      };
    });
  }, [hierarchyData, liveStateRef, simTime]);

  const numGrids = useMemo(() => Math.max(1, Math.floor(Math.log2(blocks.length || 1))), [blocks.length]);
  const [activeIndices, setActiveIndices] = useState<number[]>([]);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (blocks.length === 0) return;
    const initial: number[] = [];
    for (let i = 0; i < numGrids; i++) initial.push(Math.floor(Math.random() * blocks.length));
    setActiveIndices(initial);
  }, [blocks.length, numGrids]);

  useEffect(() => {
    if (blocks.length <= numGrids) return;
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setActiveIndices(prev => prev.map(() => Math.floor(Math.random() * blocks.length)));
        setIsFading(false);
      }, 500);
    }, 6000);
    return () => clearInterval(timer);
  }, [blocks.length, numGrids]);

  const handleCardClick = (block: BlockData) => {
    if (!selectedStation) return;
    navigate(`/${selectedStation}/components`, {
      state: { drillStack: block.path, inspectNodeName: block.name }
    });
  };

  const metricCards = [
    {
      icon: Activity, color: 'var(--accent-primary)',
      label: 'Components',
      value: <><span style={{ color: 'var(--text-primary)' }}>{stats.activeComponents}</span><span style={{ color: 'var(--text-tertiary)', fontSize: 20, fontWeight: 600 }}>/{stats.totalComponents}</span></>
    },
    { icon: Zap, color: 'var(--accent-amber)', label: 'Power Output', value: stats.powerOutput },
    { icon: Thermometer, color: 'var(--accent-cyan)', label: 'Temperature', value: stats.temperature },
    { icon: Package, color: 'var(--accent-purple)', label: 'Next Supply', value: stats.nextSupply },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '32px 36px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Page header */}
        <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
              {selectedStation || 'Loading...'} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Overview</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
              System status and high-level telemetry
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 14px',
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: 'var(--radius-full)',
            fontSize: 12, fontWeight: 700, color: 'var(--status-active)'
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--status-active)',
              boxShadow: '0 0 6px var(--status-active)',
              animation: 'pulseDot 2.5s infinite'
            }} />
            LIVE
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 24 }}>
          {/* Satellite view */}
          <div className="glass-panel fade-in delay-1" style={{
            padding: 0, overflow: 'hidden',
            borderRadius: 'var(--radius-xl)',
            minHeight: 300,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header overlay */}
            <div style={{
              padding: '20px 24px',
              background: theme === 'dark' 
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)'
                : 'linear-gradient(to bottom, rgba(255,255,255,0.9) 0%, transparent 100%)',
              position: 'relative', zIndex: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Radar size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: theme === 'dark' ? '#fff' : 'var(--text-primary)', letterSpacing: '0.02em' }}>
                  Satellite View
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulseDot 2s infinite' }} />
                  <span style={{ fontSize: 11, color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)', fontWeight: 600 }}>LIVE FEED</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'var(--text-secondary)' }}>
                Live spatial telemetry feed
              </p>
            </div>

            {/* Map image */}
            <div style={{
              flex: 1,
              backgroundImage: 'url(/maitri_satellite.jpg)',
              backgroundSize: 'cover', backgroundPosition: 'center',
              position: 'relative', minHeight: 220,
            }}>
              {/* Aurora scan overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 0%, rgba(99,219,188,0.06) 50%, rgba(56,217,245,0.1) 100%)',
                animation: 'scanline 6s linear infinite',
              }} />
              {/* Marker dots */}
              {[
                { top: '35%', left: '28%', color: 'var(--accent-cyan)', delay: '0s', size: 10 },
                { top: '62%', left: '70%', color: 'var(--accent-primary)', delay: '1s', size: 8 },
                { top: '48%', left: '58%', color: 'var(--accent-amber)', delay: '0.5s', size: 9 },
              ].map((dot, i) => (
                <div key={i} style={{ position: 'absolute', top: dot.top, left: dot.left, color: dot.color }}>
                  <div style={{
                    width: dot.size, height: dot.size, borderRadius: '50%',
                    background: 'currentColor',
                    boxShadow: `0 0 10px currentColor`,
                    animation: `pulseDot 2.5s ${dot.delay} infinite`,
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {metricCards.map((card, i) => (
              <div
                key={card.label}
                className={`glass-panel stat-card fade-in delay-${i + 1}`}
                style={{ justifyContent: 'space-between' }}
              >
                <div className="stat-label">
                  <card.icon size={16} style={{ color: card.color }} />
                  {card.label}
                </div>
                <div className="stat-value" style={{ fontSize: 28 }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Component Matrix */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
                Component Matrix
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Rotating snapshot — click to inspect
              </p>
            </div>
            <button
              onClick={() => navigate(`/${selectedStation}/components`)}
              className="btn btn-secondary btn-sm"
              style={{ gap: 6 }}
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          {blocks.length > 0 && activeIndices.length === numGrids ? (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 18,
              paddingBottom: 12,
            }}>
              {activeIndices.map((blockIdx, i) => (
                <div
                  key={i}
                  className="fade-in"
                  style={{
                    width: 200, flex: '0 0 200px',
                    animationDelay: `${i * 0.07}s`,
                    opacity: 0,
                  }}
                >
                  <GridCard
                    block={blocks[blockIdx]}
                    fading={isFading}
                    onClick={() => handleCardClick(blocks[blockIdx])}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel empty-state">
              <Box size={36} className="empty-state-icon" />
              <span className="empty-state-title">No components available</span>
              <span className="empty-state-desc">The matrix is empty or station data is loading.</span>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
