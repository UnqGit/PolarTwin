import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, type StationManifest } from '../lib/api';
import {
  Snowflake, Activity, Box, MapPin, Radio,
  MonitorPlay, Zap, Sun, Moon, ArrowRight,
  Globe, Cpu, FileCode, Clock, Layers,
  Play, Pause, RotateCcw, Check, Copy,
  AlertTriangle, ShieldCheck, Terminal, Code2,
  Sparkles, Filter, Database, Sliders, ChevronRight, ChevronDown, X,
  Network, Thermometer, Wind, Droplets, Flame, Workflow, Gauge
} from 'lucide-react';
import { useTheme } from '../components/ThemeContext';
import { StationHologram3D } from '../components/StationHologram3D';
import { TopologyMiniVisualizer } from '../components/TopologyMiniVisualizer';
import { CommandCenterTour } from '../components/CommandCenterTour';
import { Footer } from '../components/Footer';

/* ── Aurora & Snow particle canvas ───────────────────────────── */
function AuroraCanvas({ theme }: { theme: 'light' | 'dark' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);

    const isDark = theme === 'dark';
    const particles: { x: number; y: number; r: number; speed: number; speedX: number; alpha: number; color: string }[] = [];

    if (isDark) {
      const colors = ['#63dbc0', '#38d9f5', '#a78bfa', '#f8d57e'];
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.5 + 0.3,
          speed: Math.random() * 0.3 + 0.05,
          speedX: 0,
          alpha: Math.random() * 0.5 + 0.1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    } else {
      // Light theme: Snow particles with a mix of pure white and icy blue
      const colors = ['#ffffff', '#ffffff', '#e0f2fe', '#bae6fd'];
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2.5 + 0.8,
          speed: Math.random() * 1.5 + 0.5,
          speedX: Math.random() * 1 - 0.5,
          alpha: Math.random() * 0.8 + 0.2,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }

    let frame = 0;
    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      frame += 0.005;

      if (isDark) {
        // Aurora waves
        for (let band = 0; band < 3; band++) {
          const grad = ctx.createLinearGradient(0, 0, w, 0);
          const offset = band * 0.15;
          const yBase = h * (0.3 + band * 0.12) + Math.sin(frame * 0.7 + band) * 40;
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(Math.min(1, 0.2 + offset), `rgba(99,219,188,${0.04 + band * 0.015})`);
          grad.addColorStop(Math.min(1, 0.5 + offset), `rgba(56,217,245,${0.06 + band * 0.01})`);
          grad.addColorStop(Math.min(1, 0.8 + offset), `rgba(167,139,250,${0.04})`);
          grad.addColorStop(1, 'transparent');

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, yBase);
          for (let x = 0; x <= w; x += 8) {
            const y = yBase +
              Math.sin(x * 0.003 + frame + band) * 30 +
              Math.sin(x * 0.007 + frame * 1.3) * 15;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();
        }
      }

      // Particles (Stars or Snow)
      particles.forEach((p, idx) => {
        if (isDark) {
          p.y -= p.speed;
          if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
        } else {
          // Snow movement with gentle breeze
          p.y += p.speed;
          p.x += p.speedX + Math.sin(frame * 2 + idx * 0.1) * 0.5;
          if (p.y > h + 5) { p.y = -5; p.x = Math.random() * w; }
          if (p.x > w + 5) { p.x = -5; }
          if (p.x < -5) { p.x = w + 5; }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);

        if (!isDark) {
          // Subtle drop shadow for snow in light mode to contrast with bright background
          ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 4;
        }

        ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        if (!isDark) {
          ctx.shadowBlur = 0;
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

/* ── Station Card (Live Antarctic Deployment) ────────────────── */
function StationCard({ station }: { station: StationManifest }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Geographic coordinates & oasis info
  const isMaitri = station.station_id.toLowerCase().includes('maitri');
  const coords = isMaitri ? '70°46′S, 11°44′E · Schirmacher Oasis' : 'Antarctica Base Node';

  return (
    <Link
      to={`/${station.station_id}/overview`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        className="glass-panel card-hover"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-xl)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
          background: isLight
            ? 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.9) 100%)'
            : 'var(--bg-panel)',
          boxShadow: isLight
            ? '0 10px 30px -10px rgba(2, 132, 199, 0.15), 0 4px 6px -4px rgba(0, 0, 0, 0.05)'
            : 'var(--shadow-md)',
          border: isLight ? '1px solid rgba(2, 132, 199, 0.18)' : '1px solid var(--border-color)',
        }}
      >
        {/* Accent glow corner */}
        <div style={{
          position: 'absolute',
          top: -40, right: -40,
          width: 140, height: 140,
          borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle, rgba(2,132,199,0.12) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99,219,188,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 'var(--radius-md)',
            background: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(99,219,188,0.12)',
            border: isLight ? '1.5px solid rgba(2, 132, 199, 0.25)' : '1.5px solid rgba(99,219,188,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-primary)',
            flexShrink: 0,
            boxShadow: isLight ? 'none' : 'var(--shadow-glow)',
          }}>
            <MapPin size={24} strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{
                margin: 0, fontSize: '20px', fontWeight: 900,
                color: 'var(--text-primary)', letterSpacing: '-0.02em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {station.station_id} Station
              </h3>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.3)'
              }}>
                ONLINE
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                {coords}
              </span>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        </div>

        {/* Live Polar Telemetry Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          background: isLight ? '#f1f5f9' : 'rgba(0, 0, 0, 0.35)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: 11,
          fontFamily: 'monospace',
        }}>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 9.5 }}>AMBIENT TEMP</div>
            <div style={{ fontWeight: 800, color: 'var(--accent-cyan)', marginTop: 2 }}>-38.2°C</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 9.5 }}>GRID LOAD</div>
            <div style={{ fontWeight: 800, color: 'var(--accent-primary)', marginTop: 2 }}>86.4 kW</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 9.5 }}>AUTONOMY</div>
            <div style={{ fontWeight: 800, color: '#4ade80', marginTop: 2 }}>148 Days</div>
          </div>
        </div>

        <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.06)' : 'var(--border-color)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
              <Box size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span><strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{station.component_count}</strong> Units</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
              <Activity size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <span><strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{station.connection_count}</strong> Links</span>
            </div>
          </div>

          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            Enter Command Center →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Mock (locked) Station Card (Bharati Base) ────────── */
function MockStationCard() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div
      style={{ display: 'block', opacity: isLight ? 0.9 : 0.75 }}
      title="Phase 2 Deployment: Compilation pass verified, staging for production telemetry"
    >
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
          background: isLight ? 'rgba(255,255,255,0.75)' : 'var(--bg-panel)',
          border: isLight ? '1px dashed rgba(2, 132, 199, 0.3)' : '1px dashed rgba(255,255,255,0.2)',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 14, right: 16,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          background: isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(248,213,126,0.12)',
          color: 'var(--accent-amber)',
          border: isLight ? '1px solid rgba(217, 119, 6, 0.25)' : '1px solid rgba(248,213,126,0.3)',
          padding: '3px 10px',
          borderRadius: 'var(--radius-full)',
        }}>
          STAGED · PHASE 2
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 'var(--radius-md)',
            background: isLight ? 'rgba(0,0,0,0.03)' : 'var(--bg-input)',
            border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-amber)',
            flexShrink: 0,
          }}>
            <MapPin size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Bharati Station
            </h3>
            <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              69°24′S, 76°11′E · Larsmann Hills
            </span>
          </div>
        </div>

        {/* Spec Staging Strip */}
        <div style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          background: isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.25)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.04)',
          fontSize: 11,
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Aerodynamic 3-Deck Pod</span>
          <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>AST Compiled Valid</span>
        </div>

        <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.06)' : 'var(--border-color)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '12.5px' }}>
              <Box size={15} /> <span><strong>278</strong> Components</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '12.5px' }}>
              <Activity size={15} /> <span><strong>433</strong> Connections</span>
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Awaiting Telemetry Stream
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PLATFORM CAPABILITIES BENTO ARCHITECTURE
   ═══════════════════════════════════════════════════════ */
function PlatformCapabilitiesSection({ isLight }: { isLight: boolean }) {
  // 1. Multi-physics engine state
  const [physicsMode, setPhysicsMode] = useState<'nominal' | 'peak' | 'critical'>('nominal');

  // 2. Multi-medium graph state
  const [activeMedium, setActiveMedium] = useState<'all' | 'power' | 'fluid' | 'data' | 'signal'>('all');

  // 3. Reversible LIFO stack state
  const [stackPushed, setStackPushed] = useState(false);

  // 4. Cascade anomaly state
  const [faultScenario, setFaultScenario] = useState<'gen' | 'bus' | 'pump'>('gen');

  // 5. Antarctic climate state
  const [climatePreset, setClimatePreset] = useState<'calm' | 'storm' | 'blizzard'>('blizzard');

  // 6. Comparative A/B scrub state
  const [scrubTime, setScrubTime] = useState(14.0);

  // Card background and border helpers
  const cardBg = isLight ? '#ffffff' : 'rgba(12, 16, 27, 0.75)';
  const cardBorder = isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)';
  const innerBg = isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.35)';
  const innerBorder = isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)';

  // Physics dynamic metrics
  const physicsData = {
    nominal: {
      voltage: '48.2 V',
      current: '310 A',
      power: '14.9 kW',
      powerPercent: 42,
      temp: '64.5 °C',
      tempPercent: 48,
      coolant: '18.2 L/min',
      status: 'OPTIMAL BALANCE',
      statusColor: '#4ade80',
    },
    peak: {
      voltage: '46.8 V',
      current: '645 A',
      power: '30.2 kW',
      powerPercent: 78,
      temp: '79.2 °C',
      tempPercent: 72,
      coolant: '26.4 L/min',
      status: 'HIGH UTILIZATION',
      statusColor: '#fbbf24',
    },
    critical: {
      voltage: '39.4 V',
      current: '920 A',
      power: '36.2 kW',
      powerPercent: 96,
      temp: '98.5 °C',
      tempPercent: 95,
      coolant: '32.0 L/min',
      status: 'THERMAL LIMIT SURGE',
      statusColor: '#f87171',
    },
  }[physicsMode];

  // Climate dynamic metrics
  const climateData = {
    calm: {
      temp: '-18.0 °C',
      wind: '12 m/s',
      windLabel: 'Moderate Breeze',
      solar: '8.4 kW',
      heatDemand: '100% (Baseline)',
      badgeColor: '#38d9f5',
    },
    storm: {
      temp: '-42.5 °C',
      wind: '36 m/s',
      windLabel: 'Polar Gale',
      solar: '1.4 kW',
      heatDemand: '168% (+68%)',
      badgeColor: '#fbbf24',
    },
    blizzard: {
      temp: '-58.5 °C',
      wind: '52 m/s',
      windLabel: 'Katabatic Whiteout',
      solar: '0.0 kW',
      heatDemand: '242% (+142%)',
      badgeColor: '#f87171',
    },
  }[climatePreset];

  // Cascade breadcrumbs
  const cascadeData = {
    gen: {
      root: 'Generator 1 Mechanical Seizure at T=0.0h',
      cascade1: 'Bus A under-voltage sag (<36V threshold tripped)',
      mitigation: 'Automated load-shedding isolated Non-Critical Labs · Essential Life Support preserved on Bus B',
      confidence: '99.8%',
      latency: '12ms',
    },
    bus: {
      root: 'Transformer T1 Phase Imbalance at T=0.0h',
      cascade1: 'Bus B Primary Breaker tripped to prevent fire risk',
      mitigation: 'Battery Bank 2 engaged in 14ms · Heating pumps seamlessly sustained without thermal drop',
      confidence: '99.4%',
      latency: '14ms',
    },
    pump: {
      root: 'Coolant Circulation Pump 2 Flow Failure at T=0.0h',
      cascade1: 'Heat exchanger core temperature spiked above 92°C',
      mitigation: 'Dynamic engine governor automatically throttled diesel generators to 40% until standby loop online',
      confidence: '98.9%',
      latency: '24ms',
    },
  }[faultScenario];

  // A/B branch dynamic calculations based on scrubTime (0 to 48 hours)
  const isBranchFaultActive = scrubTime >= 8.0;
  const branchAFuel = Math.max(15, +(95 - scrubTime * 1.25).toFixed(1));
  const branchBFuel = isBranchFaultActive
    ? Math.max(4, +(95 - 8.0 * 1.25 - (scrubTime - 8.0) * 2.6).toFixed(1))
    : branchAFuel;
  const branchATemp = 21.5;
  const branchBTemp = isBranchFaultActive
    ? +(21.5 - Math.min(16.5, (scrubTime - 8.0) * 0.45)).toFixed(1)
    : 21.5;
  const branchAPower = 100;
  const branchBPower = isBranchFaultActive ? 52 : 100;

  return (
    <section style={{
      padding: '100px 24px',
      background: isLight ? '#FFFFFF' : 'var(--bg-panel-secondary)',
      borderTop: '1px solid var(--border-color)',
      borderBottom: '1px solid var(--border-color)',
      boxShadow: isLight ? '0 -10px 40px rgba(0,0,0,0.02)' : 'none',
      position: 'relative',
    }}>
      {/* Subtle background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isLight
          ? 'radial-gradient(circle at 10% 10%, rgba(2, 132, 199, 0.03) 0%, transparent 50%), radial-gradient(circle at 90% 90%, rgba(124, 58, 237, 0.03) 0%, transparent 50%)'
          : 'radial-gradient(circle at 20% 0%, rgba(80, 219, 192, 0.05) 0%, transparent 60%), radial-gradient(circle at 80% 100%, rgba(167, 139, 250, 0.05) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 2, width: 44, background: 'linear-gradient(to right, transparent, var(--accent-purple))', borderRadius: 2 }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-purple)' }}>
              Core Infrastructure Architecture
            </span>
            <div style={{ height: 2, width: 44, background: 'linear-gradient(to left, transparent, var(--accent-purple))', borderRadius: 2 }} />
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 16px 0', letterSpacing: '-0.03em' }}>
            Platform Capabilities & Engine Suite
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: '0 auto', maxWidth: 660, lineHeight: 1.65 }}>
            Engineered for mission-critical Antarctic facilities. Explore the multi-physics differential solver, multi-medium topology graph, reversible LIFO execution, and autonomous diagnostics.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="bento-grid">

          {/* ── CARD 1: Multi-Physics Deterministic Engine (Span 7) ── */}
          <div className="bento-card bento-card-7 glass-panel" style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
          }}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                  background: isLight ? 'rgba(80, 219, 192, 0.15)' : 'rgba(80, 219, 192, 0.12)',
                  border: isLight ? '1px solid rgba(80, 219, 192, 0.3)' : '1px solid rgba(80, 219, 192, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}>
                  <Zap size={24} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary)' }}>
                    Physics Kernel · ODE Dynamics
                  </div>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Multi-Physics Deterministic Engine
                  </h3>
                </div>
              </div>

              {/* Interactive Mode Pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'nominal', label: 'Nominal (48V)' },
                  { id: 'peak', label: 'Peak Load' },
                  { id: 'critical', label: 'Thermal Surge' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPhysicsMode(m.id as any)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      border: physicsMode === m.id
                        ? (isLight ? '1.5px solid #0284c7' : '1.5px solid var(--accent-primary)')
                        : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)'),
                      background: physicsMode === m.id
                        ? (isLight ? '#e0f2fe' : 'rgba(80, 219, 192, 0.15)')
                        : 'transparent',
                      color: physicsMode === m.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 11.5,
                      fontWeight: physicsMode === m.id ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Simulates coupled electrical power distribution, heat exchanger dissipation, and fuel combustion dynamics using 4th-order Runge-Kutta numerical integration in strict lock-step synchronization.
            </p>

            {/* Interactive Live Telemetry HUD */}
            <div style={{
              background: innerBg,
              border: innerBorder,
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                  Live Bus State
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: `${physicsData.statusColor}20`,
                  color: physicsData.statusColor,
                  border: `1px solid ${physicsData.statusColor}40`,
                }}>
                  {physicsData.status}
                </span>
              </div>

              {/* 4 Metric Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
                <div style={{ padding: '10px 12px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)', borderRadius: 8, border: innerBorder }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Bus Voltage</div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'monospace', color: physicsData.statusColor, marginTop: 2 }}>{physicsData.voltage}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>I: {physicsData.current}</div>
                </div>

                <div style={{ padding: '10px 12px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)', borderRadius: 8, border: innerBorder }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Power</div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent-primary)', marginTop: 2 }}>{physicsData.power}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>Cap: {physicsData.powerPercent}%</div>
                </div>

                <div style={{ padding: '10px 12px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)', borderRadius: 8, border: innerBorder }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Core Thermal</div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'monospace', color: physicsData.tempPercent > 80 ? 'var(--status-failure)' : 'var(--accent-cyan)', marginTop: 2 }}>{physicsData.temp}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>Load: {physicsData.tempPercent}%</div>
                </div>

                <div style={{ padding: '10px 12px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)', borderRadius: 8, border: innerBorder }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Coolant Flow</div>
                  <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent-cyan)', marginTop: 2 }}>{physicsData.coolant}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>Loop Active</div>
                </div>
              </div>

              {/* Formula & Spec Banner */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                padding: '6px 12px', borderRadius: 6,
                background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)'
              }}>
                <span>dx/dt = f(x, u, t) · Runge-Kutta 4th-Order Solver</span>
                <span style={{ color: 'var(--accent-primary)' }}>Lockstep Synchronized · 0.05h Step</span>
              </div>
            </div>
          </div>

          {/* ── CARD 2: Multi-Medium Edge Routing (Span 5) ── */}
          <div className="bento-card bento-card-5 glass-panel" style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: isLight ? 'rgba(56, 217, 245, 0.15)' : 'rgba(56, 217, 245, 0.12)',
                border: isLight ? '1px solid rgba(56, 217, 245, 0.3)' : '1px solid rgba(56, 217, 245, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-cyan)',
              }}>
                <Network size={24} strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)' }}>
                  Multi-Medium Graph · Spec §8
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Multi-Medium Edge Routing
                </h3>
              </div>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Models facility topology across 4 distinct physical and logical domains, ensuring upstream power supplies, coolant loops, and SCADA telemetry don't cross-contaminate.
            </p>

            {/* Medium Selector Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { id: 'all', label: 'All 48 Links', color: 'var(--text-primary)' },
                { id: 'power', label: '⚡ Power (16)', color: 'var(--accent-primary)' },
                { id: 'fluid', label: '💧 Fluid (12)', color: 'var(--accent-cyan)' },
                { id: 'data', label: '📡 Data (14)', color: 'var(--accent-purple)' },
                { id: 'signal', label: '🛰️ Signal (6)', color: 'var(--accent-amber)' },
              ].map(med => (
                <button
                  key={med.id}
                  onClick={() => setActiveMedium(med.id as any)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: activeMedium === med.id
                      ? `1.5px solid ${med.color}`
                      : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)'),
                    background: activeMedium === med.id
                      ? (isLight ? '#f0fdfa' : 'rgba(255,255,255,0.08)')
                      : 'transparent',
                    color: activeMedium === med.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: activeMedium === med.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {med.label}
                </button>
              ))}
            </div>

            {/* Interactive Topological Graph Visualizer */}
            <div style={{ marginTop: 'auto' }}>
              <TopologyMiniVisualizer activeMedium={activeMedium} isLight={isLight} />
            </div>
          </div>

          {/* ── CARD 3: Reversible LIFO State Stack (Span 4) ── */}
          <div className="bento-card bento-card-4 glass-panel" style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-lg)',
                background: isLight ? 'rgba(167, 139, 250, 0.15)' : 'rgba(167, 139, 250, 0.12)',
                border: isLight ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid rgba(167, 139, 250, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-purple)',
              }}>
                <RotateCcw size={22} strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-purple)' }}>
                  Temporal Runtime
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Reversible LIFO Stack
                </h3>
              </div>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Injected failures reside in transient LIFO stack layers. When event durations expire, the engine automatically unwinds the stack to baseline without memory corruption.
            </p>

            {/* Interactive Stack Action */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setStackPushed(!stackPushed)}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: stackPushed
                    ? (isLight ? '#fee2e2' : 'rgba(248, 113, 113, 0.15)')
                    : (isLight ? '#f0fdf4' : 'rgba(74, 222, 128, 0.15)'),
                  border: stackPushed
                    ? '1.5px solid var(--accent-red)'
                    : '1.5px solid var(--status-success)',
                  color: stackPushed
                    ? (isLight ? '#991b1b' : '#fca5a5')
                    : (isLight ? '#166534' : '#86efac'),
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s ease',
                }}
              >
                {stackPushed ? <RotateCcw size={14} /> : <AlertTriangle size={14} />}
                <span>{stackPushed ? 'Pop & Unwind Layer' : 'Inject Overheat Fault Layer'}</span>
              </button>
            </div>

            {/* Visual LIFO Layers */}
            <div style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
            }}>
              {stackPushed ? (
                <div
                  className="stack-active-pulse"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: isLight ? '#fee2e2' : 'rgba(248, 113, 113, 0.18)',
                    border: '1.5px solid var(--accent-red)',
                    color: isLight ? '#991b1b' : '#fca5a5',
                    fontWeight: 700,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>[Top Layer] event:overheat (142.5°C)</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace' }}>Expires T+2.0h</span>
                </div>
              ) : (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: isLight ? '#dcfce7' : 'rgba(74, 222, 128, 0.12)',
                  border: '1px solid var(--status-success)',
                  color: isLight ? '#166534' : '#86efac',
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <ShieldCheck size={14} />
                  <span>Baseline Restored (Zero Corruption)</span>
                </div>
              )}

              {/* Base Layer */}
              <div style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: innerBg,
                border: innerBorder,
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>[Base Layer] Station Twin Baseline</span>
                <span style={{ fontSize: 10, color: 'var(--accent-primary)', fontWeight: 700 }}>65.0°C Nominal</span>
              </div>
            </div>
          </div>

          {/* ── CARD 4: Cascading Failure Diagnostics (Span 4) ── */}
          <div className="bento-card bento-card-4 glass-panel" style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-lg)',
                background: isLight ? 'rgba(248, 113, 113, 0.15)' : 'rgba(248, 113, 113, 0.12)',
                border: isLight ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(248, 113, 113, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--status-failure)',
              }}>
                <AlertTriangle size={22} strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--status-failure)' }}>
                  Anomaly Detection
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Cascade Failure Tracer
                </h3>
              </div>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Traces topological propagation when critical equipment faults, distinguishing initial root causes from secondary alarms to prevent catastrophic blackout.
            </p>

            {/* Scenario Buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[
                { id: 'gen', label: 'Gen Trip' },
                { id: 'bus', label: 'Bus Short' },
                { id: 'pump', label: 'Pump Cut' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFaultScenario(f.id as any)}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: faultScenario === f.id
                      ? '1.5px solid var(--status-failure)'
                      : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)'),
                    background: faultScenario === f.id
                      ? (isLight ? '#fee2e2' : 'rgba(248, 113, 113, 0.15)')
                      : 'transparent',
                    color: faultScenario === f.id ? 'var(--status-failure)' : 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: faultScenario === f.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Breadcrumb Cascade Trace */}
            <div style={{
              marginTop: 'auto',
              background: innerBg,
              border: innerBorder,
              borderRadius: 'var(--radius-lg)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 11.5,
              lineHeight: 1.45,
            }}>
              <div style={{ color: 'var(--status-failure)', fontWeight: 700 }}>
                1. ROOT: {cascadeData.root}
              </div>
              <div style={{ color: 'var(--accent-amber)', fontWeight: 600, paddingLeft: 8 }}>
                ↳ 2. CASCADE: {cascadeData.cascade1}
              </div>
              <div style={{ color: 'var(--status-success)', fontWeight: 600, paddingLeft: 16 }}>
                ↳ 3. MITIGATION: {cascadeData.mitigation}
              </div>
              <div style={{
                marginTop: 4, paddingTop: 6, borderTop: innerBorder,
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'monospace'
              }}>
                <span>Accuracy: {cascadeData.confidence}</span>
                <span>Latency: {cascadeData.latency}</span>
              </div>
            </div>
          </div>

          {/* ── CARD 5: Extreme Antarctic Climate Modeling (Span 4) ── */}
          <div className="bento-card bento-card-4 glass-panel" style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-lg)',
                background: isLight ? 'rgba(248, 213, 126, 0.15)' : 'rgba(248, 213, 126, 0.12)',
                border: isLight ? '1px solid rgba(248, 213, 126, 0.3)' : '1px solid rgba(248, 213, 126, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-amber)',
              }}>
                <Snowflake size={22} strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-amber)' }}>
                  Climate Subsystems · Spec §12
                </div>
                <h3 style={{ margin: '2px 0 0 0', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Extreme Polar Climate
                </h3>
              </div>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Models subzero thermal dissipation down to -60°C, katabatic wind shear, and polar night solar array blackouts, stressing building insulation to the limit.
            </p>

            {/* Climate Presets */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[
                { id: 'calm', label: 'Calm (-18°C)' },
                { id: 'storm', label: 'Gale (-42°C)' },
                { id: 'blizzard', label: 'Blizzard (-58°C)' },
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => setClimatePreset(c.id as any)}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: climatePreset === c.id
                      ? '1.5px solid var(--accent-amber)'
                      : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)'),
                    background: climatePreset === c.id
                      ? (isLight ? '#fef3c7' : 'rgba(248, 213, 126, 0.15)')
                      : 'transparent',
                    color: climatePreset === c.id ? (isLight ? '#92400e' : 'var(--accent-amber)') : 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: climatePreset === c.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Climate Telemetry Readout */}
            <div style={{
              marginTop: 'auto',
              background: innerBg,
              border: innerBorder,
              borderRadius: 'var(--radius-lg)',
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              fontSize: 12,
            }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Ambient Temp</div>
                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent-cyan)', marginTop: 2 }}>{climateData.temp}</div>
              </div>

              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Katabatic Winds</div>
                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent-amber)', marginTop: 2 }}>{climateData.wind}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{climateData.windLabel}</div>
              </div>

              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Solar Irradiance</div>
                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: climateData.solar === '0.0 kW' ? 'var(--status-failure)' : 'var(--status-success)', marginTop: 2 }}>{climateData.solar}</div>
              </div>

              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Heating Demand</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{climateData.heatDemand}</div>
              </div>
            </div>
          </div>

          {/* ── CARD 6: Multi-Scenario Comparative Analysis & Timeline Scrubbing (Span 12) ── */}
          <div className="bento-card bento-card-12 glass-panel" style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: isLight ? '0 10px 36px rgba(0,0,0,0.05)' : 'var(--shadow-lg)',
          }}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, rgba(80, 219, 192, 0.2) 0%, rgba(167, 139, 250, 0.2) 100%)',
                  border: isLight ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid rgba(167, 139, 250, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isLight ? '#7c3aed' : 'var(--accent-purple)',
                }}>
                  <Sliders size={24} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-purple)' }}>
                    Scenario Diff & Benchmarking · Spec §13-14
                  </div>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Comparative Scenario A/B Analysis & Mission Timeline
                  </h3>
                </div>
              </div>

              {/* Scrubber Clock Badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 'var(--radius-full)',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
                fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent-cyan)'
              }}>
                <Clock size={16} />
                <span>Mission Time: T + {scrubTime.toFixed(1)}h / 48.0h</span>
              </div>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 900 }}>
              Simultaneously scrub two diverging scenario branches to evaluate station survivability. Observe the exact moment when environmental shock forces generator failure and quantify remaining critical reserve margins.
            </p>

            {/* Timeline Range Slider */}
            <div style={{
              background: innerBg,
              border: innerBorder,
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              marginBottom: 18,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Timeline Scrub Control (0h → 48h)</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: isBranchFaultActive ? 'var(--status-failure)' : 'var(--status-success)' }}>
                  {isBranchFaultActive ? '● BRANCH B OVERLOAD ACTIVE (Fault injected at T+8.0h)' : '○ NOMINAL PARALLEL (Pre-fault)'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="48"
                step="0.5"
                value={scrubTime}
                onChange={e => setScrubTime(parseFloat(e.target.value))}
                className="dsl-slider"
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                <span>T+0.0h (Mission Start)</span>
                <span style={{ color: 'var(--status-failure)', fontWeight: 700 }}>▼ T+8.0h (Severe Blizzard + Generator Trip)</span>
                <span>T+48.0h (End of Horizon)</span>
              </div>
            </div>

            {/* Dual A/B Comparison Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {/* Branch A */}
              <div style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-lg)',
                background: isLight ? '#f0fdf4' : 'rgba(74, 222, 128, 0.05)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} /> Branch A: Nominal Baseline
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-success)' }}>100% OPERATIONAL</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Standard diurnal climate. Heating, communications, and power grids operating within specification ratings.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4, fontSize: 12 }}>
                  <div><strong>Fuel Reserve:</strong> {branchAFuel}% (Nominal)</div>
                  <div><strong>Station Temp:</strong> {branchATemp}°C (Comfort)</div>
                  <div><strong>Grid Delivery:</strong> {branchAPower}% Bus Capacity</div>
                  <div><strong>Survival Horizon:</strong> &gt; 180 Days</div>
                </div>
              </div>

              {/* Branch B */}
              <div style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-lg)',
                background: isBranchFaultActive
                  ? (isLight ? '#fef2f2' : 'rgba(248, 113, 113, 0.08)')
                  : (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'),
                border: isBranchFaultActive
                  ? '1.5px solid rgba(248, 113, 113, 0.4)'
                  : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)'),
                display: 'flex', flexDirection: 'column', gap: 10,
                transition: 'all 0.2s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: isBranchFaultActive ? 'var(--status-failure)' : 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <AlertTriangle size={16} style={{ color: isBranchFaultActive ? 'var(--status-failure)' : 'var(--text-tertiary)' }} />
                    Branch B: Blizzard + Generator Failure
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isBranchFaultActive ? 'var(--status-failure)' : 'var(--text-tertiary)'
                  }}>
                    {isBranchFaultActive ? 'EMERGENCY SHED' : 'STANDBY'}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {isBranchFaultActive
                    ? 'Generator 1 offline. Station running on backup diesel turbines with heavy fuel acceleration.'
                    : 'Fault scheduled at T+8.0h. Currently executing nominal parallel baseline.'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4, fontSize: 12 }}>
                  <div><strong>Fuel Reserve:</strong> <span style={{ color: isBranchFaultActive ? 'var(--status-failure)' : 'inherit', fontWeight: 700 }}>{branchBFuel}%</span></div>
                  <div><strong>Station Temp:</strong> <span style={{ color: isBranchFaultActive ? 'var(--accent-cyan)' : 'inherit', fontWeight: 700 }}>{branchBTemp}°C</span></div>
                  <div><strong>Grid Delivery:</strong> <span style={{ color: isBranchFaultActive ? 'var(--status-warning)' : 'inherit', fontWeight: 700 }}>{branchBPower}%</span></div>
                  <div><strong>Survival Horizon:</strong> <span style={{ color: isBranchFaultActive ? 'var(--status-failure)' : 'inherit', fontWeight: 700 }}>{isBranchFaultActive ? 'Critical in 24.5h' : 'Stable'}</span></div>
                </div>
              </div>
            </div>

            {/* Bottom Delta Banner */}
            <div style={{
              marginTop: 18,
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: isBranchFaultActive
                ? (isLight ? '#fffbeb' : 'rgba(248, 213, 126, 0.08)')
                : (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'),
              border: isBranchFaultActive
                ? '1px solid rgba(248, 213, 126, 0.3)'
                : innerBorder,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 12.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: 'var(--accent-amber)' }} />
                <span>
                  <strong>Comparative Divergence Delta:</strong>{' '}
                  {isBranchFaultActive
                    ? `Branch B has burned ${(branchAFuel - branchBFuel).toFixed(1)}% more fuel than baseline. Perimeter temperature down by ${(branchATemp - branchBTemp).toFixed(1)}°C.`
                    : 'Zero delta. Branch B runs identical to nominal baseline until fault injection at T+8.0h.'}
                </span>
              </div>
              <div style={{ fontWeight: 700, color: isBranchFaultActive ? 'var(--status-failure)' : 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                {isBranchFaultActive ? '⚠ DECISION ACTION WINDOW: 6.2 HOURS' : 'MONITORING NOMINAL'}
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   DSL SCENARIO PRESETS & INTERACTIVE STUDIO
   ═══════════════════════════════════════════════════════ */

interface DslPreset {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  category: string;
  summary: string;
  targetKind: string;
  eventFilename: string;
  sceneFilename: string;
  targetSelector: string;
  at: number;
  duration: number; // or Infinity
  eventCode: string;
  sceneCode: string;
  metricLabel: string;
  metricUnit: string;
  baseVal: number;
  activeVal: number;
  baseStateDesc: string;
  activeStateDesc: string;
  unwoundDesc: string;
}

const DSL_PRESETS: DslPreset[] = [
  {
    id: 'generator',
    title: 'Generator Thermal Runaway',
    badge: 'Finite Event · LIFO Unwinding',
    badgeColor: 'var(--accent-primary)',
    category: 'Component Fault Injection',
    summary: 'Finite duration (for=2.0h). Pushes an overheat fault onto the LIFO stack. When duration expires, the stack pops and unwinds back to nominal 65.0°C.',
    targetKind: '@component.type | @component.name',
    eventFilename: 'generator_overheat.event',
    sceneFilename: 'emergency_drill.scene',
    targetSelector: '@Generator1',
    at: 1.0,
    duration: 2.0,
    eventCode: `# generator_overheat.event
target @component.type | @component.name
where type = "generator"
& is_backup = false
set {
    status = failure               # Fixed: cannot be overridden
    values.temperature             # Required: scene must provide
    ?values.rpm                    # Optional: scene can omit
}`,
    sceneCode: `# emergency_drill.scene
# Binds to Generator1 from hierarchy.twin
# Starts at 1.0h, active for 2.0h, then pops off LIFO stack
event:generator_overheat @Generator1 at=1.0 for=2.0 set {
    values.temperature = 142.5
    values.rpm = 3600
}`,
    metricLabel: 'Core Temperature',
    metricUnit: '°C',
    baseVal: 65.0,
    activeVal: 142.5,
    baseStateDesc: 'Status: ACTIVE | Temp: 65.0°C | RPM: 1800',
    activeStateDesc: 'Status: FAILURE | Temp: 142.5°C | RPM: 3600',
    unwoundDesc: 'Status: ACTIVE | Temp: 65.0°C | Restored Nominal Base',
  },
  {
    id: 'blizzard',
    title: 'Polar Blizzard Deep Freeze',
    badge: 'Infinite Event · Baseline Override',
    badgeColor: 'var(--accent-cyan)',
    category: 'Environmental Shift',
    summary: 'Targets @external.weather without needing a selector in the scene. Uses for=inf to permanently mutate the climate baseline without popping.',
    targetKind: '@external.weather',
    eventFilename: 'polar_blizzard.event',
    sceneFilename: 'winter_storm.scene',
    targetSelector: '(Synthesized: @weather)',
    at: 1.5,
    duration: Infinity,
    eventCode: `# polar_blizzard.event
# Targets climate subsystem (no selector needed in scene)
target @external.weather
set {
    temperature = -58.0           # Extreme subzero drop
    wind_speed = 42.0             # Gale force polar winds
    irradiance = 0.0              # Solar array blackout
    visibility = 150.0            # Whiteout conditions
}`,
    sceneCode: `# winter_storm.scene
# 'for=inf' overrides the baseline permanently without popping
event:polar_blizzard at=1.5 for=inf`,
    metricLabel: 'Ambient Temperature',
    metricUnit: '°C',
    baseVal: -28.0,
    activeVal: -58.0,
    baseStateDesc: 'Temp: -28.0°C | Wind: 12 m/s | Irradiance: 650 W/m²',
    activeStateDesc: 'Temp: -58.0°C | Wind: 42 m/s | Irradiance: 0 W/m²',
    unwoundDesc: 'Permanent Base State Override (Never Unwinds)',
  },
  {
    id: 'telemetry',
    title: 'SCADA Telemetry Severance',
    badge: 'Connection Wildcard · Topo Filter',
    badgeColor: 'var(--accent-purple)',
    category: 'Network Partition',
    summary: 'Uses partial connection wildcard @(|data|) to simultaneously sever every data connection leading to a sensor across the station topology graph.',
    targetKind: '@connection',
    eventFilename: 'sever_links.event',
    sceneFilename: 'telemetry_blackout.scene',
    targetSelector: '@(|data|)',
    at: 0.8,
    duration: 1.8,
    eventCode: `# sever_data_links.event
# Evaluates target component type across connection graph
target @connection
where @component(target).type = "sensor"
set status = failure`,
    sceneCode: `# telemetry_blackout.scene
# Wildcard selector targets ALL sensor data links simultaneously
event:sever_data_links @(|data|) at=0.8 for=1.8`,
    metricLabel: 'Online Sensor Channels',
    metricUnit: '/ 48 Ch',
    baseVal: 48,
    activeVal: 0,
    baseStateDesc: 'Link: ACTIVE | 48/48 Ch Online | Drop Rate: 0.0%',
    activeStateDesc: 'Link: SEVERED | 0/48 Ch Online | Drop Rate: 100%',
    unwoundDesc: 'Link: ACTIVE | 48/48 Ch Online | Reconnected Nominal',
  },
  {
    id: 'battery',
    title: 'Battery Low-Charge Shedding',
    badge: 'Relational AST · Graph Condition',
    badgeColor: 'var(--accent-amber)',
    category: 'Smart Protection Drill',
    summary: 'Demonstrates runtime AST condition evaluation: where type="battery" & state.charge < 20 isolates power buses only when depleted.',
    targetKind: '@component.type',
    eventFilename: 'load_shed.event',
    sceneFilename: 'emergency_shed.scene',
    targetSelector: '@battery',
    at: 2.0,
    duration: 1.2,
    eventCode: `# load_shed.event
# Evaluates dynamic telemetry conditions before injecting
target @component.type
where type = "battery"
& status = "active"
& state.charge < 20.0
set {
    status = inactive             # Safe isolation
    output.voltage
}`,
    sceneCode: `# emergency_shed.scene
# Evaluated against all battery units in hierarchy.twin
event:load_shed @battery at=2.0 for=1.2 set {
    output.voltage = 0.0
}`,
    metricLabel: 'Battery Bus Output',
    metricUnit: 'V',
    baseVal: 48.0,
    activeVal: 0.0,
    baseStateDesc: 'Status: ACTIVE | Bus: 48.0V | Charge: 82%',
    activeStateDesc: 'Status: INACTIVE (SHED) | Bus: 0.0V | Charge: 18%',
    unwoundDesc: 'Status: ACTIVE | Bus: 48.0V | Nominal Resumed',
  },
];

/* ── DSL Target Taxonomy Specification (10 Valid Forms) ── */
interface TargetFormItem {
  id: number;
  target: string;
  scope: string;
  category: 'Component' | 'Connection' | 'External';
  categoryColor: string;
  categoryBg: string;
  categoryBorder: string;
  desc: string;
  example: string;
}

const TARGET_FORMS: TargetFormItem[] = [
  {
    id: 1,
    target: 'target @component.name',
    scope: 'Exact Component',
    category: 'Component',
    categoryColor: '#50dbc0',
    categoryBg: 'rgba(80, 219, 192, 0.12)',
    categoryBorder: 'rgba(80, 219, 192, 0.3)',
    desc: 'Binds mutation to a single unique component declared by name in hierarchy.twin.',
    example: 'event:fail @Generator1 at=1.0 for=2.0',
  },
  {
    id: 2,
    target: 'target @component.type',
    scope: 'All Components of Type',
    category: 'Component',
    categoryColor: '#38d9f5',
    categoryBg: 'rgba(56, 217, 245, 0.12)',
    categoryBorder: 'rgba(56, 217, 245, 0.3)',
    desc: 'Broadcasts mutation to every component across the facility sharing the type class.',
    example: 'event:disable_pumps @pump at=0.0 for=inf',
  },
  {
    id: 3,
    target: 'target @component.type | @component.name',
    scope: 'Combined Fallback',
    category: 'Component',
    categoryColor: '#50dbc0',
    categoryBg: 'rgba(80, 219, 192, 0.12)',
    categoryBorder: 'rgba(80, 219, 192, 0.3)',
    desc: 'Matches exact component name first; falls back to matching by type if not found.',
    example: 'event:overheat @Generator1 at=1.0 for=2.0',
  },
  {
    id: 4,
    target: 'target @connection',
    scope: 'Full 3-Part Tuple',
    category: 'Connection',
    categoryColor: '#a78bfa',
    categoryBg: 'rgba(167, 139, 250, 0.12)',
    categoryBorder: 'rgba(167, 139, 250, 0.3)',
    desc: 'Requires @(source|type|target) 3-part selector in the invoking scene.',
    example: 'event:cut @(Gen1|power|BusA) at=0.5 for=1.0',
  },
  {
    id: 5,
    target: 'target @connection.source',
    scope: 'Origin Filter',
    category: 'Connection',
    categoryColor: '#a78bfa',
    categoryBg: 'rgba(167, 139, 250, 0.12)',
    categoryBorder: 'rgba(167, 139, 250, 0.3)',
    desc: 'Filters network connections originating from the specified source node.',
    example: 'event:isolate @Generator1 at=0.0 for=1.0',
  },
  {
    id: 6,
    target: 'target @connection.target',
    scope: 'Destination Filter',
    category: 'Connection',
    categoryColor: '#a78bfa',
    categoryBg: 'rgba(167, 139, 250, 0.12)',
    categoryBorder: 'rgba(167, 139, 250, 0.3)',
    desc: 'Filters network connections terminating at the specified destination node.',
    example: 'event:trip @MainSwitchboard at=0.0 for=1.0',
  },
  {
    id: 7,
    target: 'target @connection.type',
    scope: 'Medium Filter',
    category: 'Connection',
    categoryColor: '#a78bfa',
    categoryBg: 'rgba(167, 139, 250, 0.12)',
    categoryBorder: 'rgba(167, 139, 250, 0.3)',
    desc: 'Filters connection links by medium (power, fluid, data, or signal).',
    example: 'event:sever @data at=1.0 for=2.0',
  },
  {
    id: 8,
    target: 'target @connection.(source & target)',
    scope: 'Multi-Field Connection',
    category: 'Connection',
    categoryColor: '#a78bfa',
    categoryBg: 'rgba(167, 139, 250, 0.12)',
    categoryBorder: 'rgba(167, 139, 250, 0.3)',
    desc: 'Enforces exactly two distinct fields from source, target, and medium type.',
    example: 'event:cut @(Gen1||BusA) at=1.0 for=1.0',
  },
  {
    id: 9,
    target: 'target @connection [Wildcard]',
    scope: 'Partial Wildcard Selector',
    category: 'Connection',
    categoryColor: '#a78bfa',
    categoryBg: 'rgba(167, 139, 250, 0.12)',
    categoryBorder: 'rgba(167, 139, 250, 0.3)',
    desc: 'The @(|data|) syntax matches all data links across the entire station topology.',
    example: 'event:drop_comms @(|data|) at=0.0 for=1.0',
  },
  {
    id: 10,
    target: 'target @external[.weather|.network|.supplies]',
    scope: 'Environmental Subsystems',
    category: 'External',
    categoryColor: '#f8d57e',
    categoryBg: 'rgba(248, 213, 126, 0.12)',
    categoryBorder: 'rgba(248, 213, 126, 0.3)',
    desc: 'Directly targets station environment. No scene selector needed (compiler synthesizes).',
    example: 'event:blizzard at=0.0 for=inf',
  },
];

/* ── DSL Monaco-Fidelity Syntax Tokenizer ─────────────────────── */
function renderDslLine(line: string, isLight: boolean): React.ReactNode {
  if (!line) return <span> </span>;
  if (line.trim().startsWith('#')) {
    return (
      <span style={{ color: isLight ? '#94a3b8' : '#64748b', fontStyle: 'italic' }}>
        {line}
      </span>
    );
  }

  // Token regex matching in exact DSLEditor Monaco order:
  // 1: comment (#[^\r\n]*)
  // 2: string ("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')
  // 3: selector (@[A-Za-z0-9_.]*(?:(?:\.[A-Za-z0-9_.]*)|(?:\([^)]*\))|(?:\[[^\]]*\]))*)
  // 4: keyword (event:|\b(?:event|target|where|set|fields|at|for|inf)\b)
  // 5: operator (<=|>=|!=|==|[|&])
  // 6: delimiter ([={}:])
  // 7: number (\b\d+(?:\.\d+)?\b)
  const regex = /(#[^\r\n]*)|("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|(@[A-Za-z0-9_.]*(?:(?:\.[A-Za-z0-9_.]*)|(?:\([^)]*\))|(?:\[[^\]]*\]))*)|(event:|\b(?:event|target|where|set|fields|at|for|inf)\b)|(<=|>=|!=|==|[|&])|([={}:])|(\b\d+(?:\.\d+)?\b)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const text = line.substring(lastIndex, match.index);
      elements.push(
        <span key={`txt-${lastIndex}`} style={{ color: isLight ? '#182230' : '#dce5f0' }}>
          {text}
        </span>
      );
    }

    const [, comment, str, selector, keyword, operator, delimiter, number] = match;

    if (comment) {
      elements.push(
        <span key={`c-${match.index}`} style={{ color: isLight ? '#94a3b8' : '#64748b', fontStyle: 'italic' }}>
          {comment}
        </span>
      );
    } else if (str) {
      elements.push(
        <span key={`s-${match.index}`} style={{ color: isLight ? '#059669' : '#34d399' }}>
          {str}
        </span>
      );
    } else if (selector) {
      elements.push(
        <span key={`sel-${match.index}`} style={{ color: isLight ? '#0ea5e9' : '#63dbbc', fontWeight: 600 }}>
          {selector}
        </span>
      );
    } else if (keyword) {
      elements.push(
        <span key={`kw-${match.index}`} style={{ color: isLight ? '#0284c7' : '#b566ff', fontWeight: 700 }}>
          {keyword}
        </span>
      );
    } else if (operator) {
      elements.push(
        <span key={`op-${match.index}`} style={{ color: isLight ? '#475569' : '#0ea5e9', fontWeight: 600 }}>
          {operator}
        </span>
      );
    } else if (delimiter) {
      elements.push(
        <span key={`del-${match.index}`} style={{ color: isLight ? '#475569' : '#0ea5e9', fontWeight: 600 }}>
          {delimiter}
        </span>
      );
    } else if (number) {
      elements.push(
        <span key={`num-${match.index}`} style={{ color: isLight ? '#d97706' : '#fbbf24' }}>
          {number}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    elements.push(
      <span key={`txt-end`} style={{ color: isLight ? '#182230' : '#dce5f0' }}>
        {line.substring(lastIndex)}
      </span>
    );
  }

  return elements;
}

/* ── DSL Monaco-Style Code Block Component ────────────────────── */
function DslCodeViewer({
  code,
  isLight,
  showLineNumbers = false,
  filename,
  fileType,
  copyable = false,
  isCopied = false,
  onCopy,
  maxHeight,
  style,
  inline = false,
}: {
  code: string;
  isLight: boolean;
  showLineNumbers?: boolean;
  filename?: string;
  fileType?: 'event' | 'scene' | 'target';
  copyable?: boolean;
  isCopied?: boolean;
  onCopy?: () => void;
  maxHeight?: string | number;
  style?: React.CSSProperties;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <span style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 13,
        ...style,
      }}>
        {renderDslLine(code, isLight)}
      </span>
    );
  }

  const lines = code.trim().split(/\r?\n/);
  const editorBg = isLight ? '#f0f4f8' : '#060812';
  const editorBorder = isLight ? '1px solid #d5dee8' : '1px solid rgba(255, 255, 255, 0.08)';
  const gutterColor = isLight ? '#94a3b8' : '#475569';
  const gutterBorder = isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)';

  return (
    <div style={{
      background: editorBg,
      border: editorBorder,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.03)' : '0 4px 20px rgba(0,0,0,0.4)',
      ...style,
    }}>
      {(filename || copyable) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: isLight ? '#e8edf3' : '#0b101c',
          borderBottom: editorBorder,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', opacity: 0.85 }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', opacity: 0.85 }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', opacity: 0.85 }} />
            </span>
            {filename && (
              <span style={{
                color: isLight ? '#334155' : '#cbd5e1',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 4,
                fontSize: 12.5,
              }}>
                <FileCode size={14} style={{ color: fileType === 'event' ? (isLight ? '#0284c7' : 'var(--accent-primary)') : (isLight ? '#7c3aed' : 'var(--accent-purple)') }} />
                {filename}
              </span>
            )}
          </div>
          {copyable && (
            <button
              onClick={onCopy}
              style={{
                background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
                color: isCopied ? 'var(--status-active)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
                transition: 'all 0.15s ease',
              }}
              title="Copy code"
            >
              {isCopied ? <Check size={12} style={{ color: 'var(--status-active)' }} /> : <Copy size={12} />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      )}

      <div
        className="dsl-code-container"
        style={{
          padding: showLineNumbers ? '12px 0' : '12px 16px',
          overflowX: 'auto',
          maxHeight,
          background: editorBg,
          flex: 1,
        }}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} style={{ lineHeight: 1.65 }}>
                {showLineNumbers && (
                  <td style={{
                    width: 38,
                    minWidth: 38,
                    padding: '0 12px 0 10px',
                    textAlign: 'right',
                    color: gutterColor,
                    fontSize: 11.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    userSelect: 'none',
                    borderRight: gutterBorder,
                    verticalAlign: 'top',
                  }}>
                    {idx + 1}
                  </td>
                )}
                <td style={{
                  padding: showLineNumbers ? '0 16px' : '0',
                  whiteSpace: 'pre',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  fontSize: 13,
                  verticalAlign: 'top',
                }}>
                  {renderDslLine(line, isLight)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DslInteractiveStudio({ isLight }: { isLight: boolean }) {
  const [activePresetId, setActivePresetId] = useState('generator');
  const [currentTime, setCurrentTime] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'taxonomy' | 'where' | 'set' | 'compiler'>('taxonomy');
  const [targetFilter, setTargetFilter] = useState<'all' | 'Component' | 'Connection' | 'External'>('all');

  const preset = DSL_PRESETS.find(p => p.id === activePresetId) || DSL_PRESETS[0];

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = +(prev + 0.05).toFixed(2);
        if (next > 4.0) return 0.0;
        return next;
      });
    }, 70);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // State evaluation
  const isInfinite = preset.duration === Infinity;
  const isStarted = currentTime >= preset.at;
  const isExpired = !isInfinite && currentTime >= (preset.at + preset.duration);
  const isActive = isStarted && !isExpired;

  const currentMetric = isActive ? preset.activeVal : preset.baseVal;
  const remainingTime = isInfinite
    ? 'Infinite (Persistent Override)'
    : isActive
      ? `${(preset.at + preset.duration - currentTime).toFixed(2)}h remaining`
      : isExpired
        ? 'Expired (Popped)'
        : `Starts at ${preset.at.toFixed(1)}h`;

  return (
    <section style={{
      padding: '100px 24px',
      background: 'var(--bg-main)',
      position: 'relative',
      borderTop: '1px solid var(--border-color)',
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* ── Section Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 2, width: 44, background: 'linear-gradient(to right, transparent, var(--accent-cyan))', borderRadius: 2 }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
              Deterministic Engine · DSL Architecture
            </span>
            <div style={{ height: 2, width: 44, background: 'linear-gradient(to left, transparent, var(--accent-cyan))', borderRadius: 2 }} />
          </div>
          <h2 style={{ fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 16px 0', letterSpacing: '-0.03em' }}>
            Interactive Scenario & Event Studio
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16.5px', margin: '0 auto', maxWidth: 740, lineHeight: 1.65 }}>
            PolarTwin uses a dual-DSL architecture: <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>*.event</code> files define typed, reusable fault contracts, while <code style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>*.scene</code> files schedule them along a global timeline evaluated by a deterministic LIFO state stack.
          </p>

          {/* Preset Selector Chips */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 36 }}>
            {DSL_PRESETS.map(p => {
              const selected = p.id === activePresetId;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePresetId(p.id);
                    setCurrentTime(0.0);
                    setIsPlaying(false);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 18px',
                    borderRadius: 'var(--radius-full)',
                    background: selected
                      ? (isLight ? '#0284c7' : 'var(--accent-primary)')
                      : (isLight ? '#ffffff' : 'rgba(255,255,255,0.06)'),
                    color: selected
                      ? (isLight ? '#ffffff' : '#030A0F')
                      : 'var(--text-primary)',
                    border: selected
                      ? 'none'
                      : (isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.15)'),
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: selected ? (isLight ? '0 4px 14px rgba(2, 132, 199, 0.35)' : '0 0 18px rgba(80, 219, 192, 0.35)') : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Sparkles size={15} style={{ opacity: selected ? 1 : 0.6 }} />
                  {p.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3-Column Synchronized Interactive Playground ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 24,
          alignItems: 'stretch',
        }}>

          {/* Panel 1: *.event Contract Definition */}
          <div className="glass-panel" style={{
            gridColumn: 'span 4',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--radius-xl)',
            padding: 24,
            background: isLight ? '#ffffff' : 'var(--bg-panel)',
            border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(80, 219, 192, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}>
                  <FileCode size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary)' }}>1. Contract</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{preset.eventFilename}</div>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(preset.eventCode, 'event')}
                title="Copy event definition"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12,
                }}
              >
                {copiedKey === 'event' ? <Check size={16} style={{ color: 'var(--status-active)' }} /> : <Copy size={16} />}
              </button>
            </div>

            <div style={{
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: 16,
              background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.25)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--accent-primary)',
            }}>
              <strong>Definition:</strong> Declares the target scope, filtering criteria, and mutation schema (fixed vs required vs optional fields).
            </div>

            <DslCodeViewer
              code={preset.eventCode}
              isLight={isLight}
              showLineNumbers
              filename={preset.eventFilename}
              fileType="event"
              copyable
              isCopied={copiedKey === 'event'}
              onCopy={() => copyToClipboard(preset.eventCode, 'event')}
              style={{ flex: 1, minHeight: 220 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>target:</span> <code>{preset.targetKind}</code>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>rule:</span> Required fields must be provided by invoking scene.
              </div>
            </div>
          </div>

          {/* Panel 2: *.scene Temporal Orchestration */}
          <div className="glass-panel" style={{
            gridColumn: 'span 4',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--radius-xl)',
            padding: 24,
            background: isLight ? '#ffffff' : 'var(--bg-panel)',
            border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(56, 217, 245, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                }}>
                  <Clock size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)' }}>2. Orchestration</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{preset.sceneFilename}</div>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(preset.sceneCode, 'scene')}
                title="Copy scene code"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12,
                }}
              >
                {copiedKey === 'scene' ? <Check size={16} style={{ color: 'var(--status-active)' }} /> : <Copy size={16} />}
              </button>
            </div>

            <div style={{
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: 16,
              background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.25)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--accent-cyan)',
            }}>
              <strong>Invocation:</strong> Binds the event by name, specifies the target selector, sets the start time (<code style={{ color: 'var(--accent-cyan)' }}>at</code>), duration (<code style={{ color: 'var(--accent-cyan)' }}>for</code>), and runtime parameters.
            </div>

            <DslCodeViewer
              code={preset.sceneCode}
              isLight={isLight}
              showLineNumbers
              filename={preset.sceneFilename}
              fileType="scene"
              copyable
              isCopied={copiedKey === 'scene'}
              onCopy={() => copyToClipboard(preset.sceneCode, 'scene')}
              style={{ flex: 1, minHeight: 220 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>timeline:</span> Starts at <strong>T = {preset.at.toFixed(1)}h</strong> · Duration: <strong>{isInfinite ? 'inf (permanent)' : `${preset.duration.toFixed(1)}h`}</strong>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>target:</span> <code>{preset.targetSelector}</code>
              </div>
            </div>
          </div>

          {/* Panel 3: Live LIFO Stack & Timeline Execution Simulator */}
          <div className="glass-panel" style={{
            gridColumn: 'span 4',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--radius-xl)',
            padding: 24,
            background: isLight ? '#ffffff' : 'var(--bg-panel)',
            border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
            boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.04)' : 'var(--shadow-md)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(167, 139, 250, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-purple)',
                }}>
                  <Cpu size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-purple)' }}>3. LIFO Execution</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Live Stack & Unwinding</div>
                </div>
              </div>
              <div style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
                fontWeight: 800,
                background: isActive
                  ? 'rgba(248, 113, 113, 0.15)'
                  : isExpired
                    ? 'rgba(74, 222, 128, 0.15)'
                    : 'rgba(100, 116, 139, 0.15)',
                color: isActive
                  ? 'var(--status-failure)'
                  : isExpired
                    ? 'var(--status-success)'
                    : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'rgba(248, 113, 113, 0.3)' : isExpired ? 'rgba(74, 222, 128, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
              }}>
                {isActive ? '● ACTIVE FAULT' : isExpired ? '✓ UNWOUND' : '○ STANDBY'}
              </div>
            </div>

            {/* Time Scrubber Controls */}
            <div style={{
              background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.25)',
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Timeline Clock</span>
                <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
                  T + {currentTime.toFixed(2)}h
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="4.0"
                step="0.05"
                value={currentTime}
                onChange={e => {
                  setCurrentTime(parseFloat(e.target.value));
                  setIsPlaying(false);
                }}
                className="dsl-slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{
                      background: isLight ? '#0284c7' : 'var(--accent-primary)',
                      color: isLight ? '#fff' : '#030A0F',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    onClick={() => { setCurrentTime(0.0); setIsPlaying(false); }}
                    style={{
                      background: 'transparent',
                      border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text-secondary)',
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{remainingTime}</span>
              </div>
            </div>

            {/* Dynamic Telemetry Metric Readout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: isActive
                ? (isLight ? '#fef2f2' : 'rgba(248, 113, 113, 0.08)')
                : (isLight ? '#f0fdf4' : 'rgba(74, 222, 128, 0.08)'),
              border: isActive ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid rgba(74, 222, 128, 0.3)',
              marginBottom: 16,
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {preset.metricLabel}
                </span>
                <div style={{
                  fontSize: 22,
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  color: isActive ? 'var(--status-failure)' : 'var(--status-success)',
                }}>
                  {currentMetric} {preset.metricUnit}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Effective State</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isActive ? 'FAULT OVERRIDE' : isExpired ? 'NOMINAL RESTORED' : 'NOMINAL BASE'}
                </div>
              </div>
            </div>

            {/* Live Visual LIFO Stack */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                Simulation State Stack (LIFO)
              </div>

              {/* Active Temporary Layer (Pushed) */}
              {isActive && (
                <div
                  className="stack-active-pulse"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: isLight ? '#fee2e2' : 'rgba(248, 113, 113, 0.15)',
                    border: '1.5px solid var(--accent-red)',
                    color: isLight ? '#991b1b' : '#fca5a5',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 14px rgba(248, 113, 113, 0.25)',
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} />
                    <span>[Top] {preset.title} Layer</span>
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'monospace' }}>Expires {isInfinite ? 'never' : `T+${(preset.at + preset.duration).toFixed(1)}h`}</span>
                </div>
              )}

              {/* Unwound Notification when popped */}
              {isExpired && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isLight ? '#dcfce7' : 'rgba(74, 222, 128, 0.12)',
                  border: '1px solid var(--status-success)',
                  color: isLight ? '#166534' : '#86efac',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'unwoundFlash 0.6s ease',
                }}>
                  <ShieldCheck size={16} />
                  <span>Layer Popped: Simulation automatically unwound to baseline underneath.</span>
                </div>
              )}

              {/* Base State Layer (Always present at the bottom) */}
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
                color: isLight ? '#334155' : '#cbd5e1',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span>[Base Layer] Station Digital Twin (spec.twin)</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Baseline</span>
              </div>
            </div>

          </div>

        </div>

        {/* ── Deep-Dive Technical Reference Explorer (Interactive Tabs) ── */}
        <div style={{ marginTop: 72 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-purple)' }}>
              Specification Deep Dive
            </span>
            <h3 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 0 0' }}>
              Full DSL Language Reference
            </h3>
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 32,
          }}>
            {[
              { id: 'taxonomy', label: '1. Target Taxonomy (All 10 Forms)', icon: Box },
              { id: 'where', label: '2. Where Relational AST Engine', icon: Filter },
              { id: 'set', label: '3. Set Block Mutation Schema', icon: Code2 },
              { id: 'compiler', label: '4. Compiler Validation Pipeline', icon: Database },
            ].map(({ id, label, icon: TabIcon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-lg)',
                    background: active
                      ? (isLight ? '#ffffff' : 'rgba(167,139,250,0.15)')
                      : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
                    border: active
                      ? (isLight ? '2px solid #7c3aed' : '2px solid var(--accent-purple)')
                      : (isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)'),
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    boxShadow: active ? (isLight ? '0 4px 12px rgba(124, 58, 237, 0.15)' : '0 0 16px rgba(167, 139, 250, 0.2)') : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <TabIcon size={16} style={{ color: active ? 'var(--accent-purple)' : 'var(--text-tertiary)' }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab Content 1: Target Taxonomy */}
          {activeTab === 'taxonomy' && (() => {
            const filteredTargets = targetFilter === 'all'
              ? TARGET_FORMS
              : TARGET_FORMS.filter(t => t.category === targetFilter);

            return (
              <div className="glass-panel" style={{
                borderRadius: 'var(--radius-xl)',
                padding: '32px 28px',
                background: isLight ? '#ffffff' : 'var(--bg-panel)',
                border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: 21, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Box size={22} /> Target Clause Taxonomy (Spec §9)
                    </h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.6 }}>
                      The <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>target</code> clause governs the structural scope of an event. Bare <code style={{ color: 'var(--accent-red)' }}>@component</code> is illegal. All 10 valid targets are strictly validated by the compiler:
                    </p>
                  </div>

                  {/* Compiler Guarantee Pill */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-full)',
                    background: isLight ? 'rgba(80, 219, 192, 0.1)' : 'rgba(80, 219, 192, 0.08)',
                    border: '1px solid rgba(80, 219, 192, 0.25)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: isLight ? '#0f766e' : 'var(--accent-primary)',
                  }}>
                    <ShieldCheck size={16} />
                    <span>10 Valid Compiler Forms · Zero Ambiguity Invariant</span>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  margin: '22px 0 24px 0',
                  paddingBottom: 16,
                  borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  {[
                    { id: 'all', label: 'All 10 Forms', count: 10, color: isLight ? '#0284c7' : 'var(--accent-primary)' },
                    { id: 'Component', label: 'Component Scopes', count: 3, color: '#50dbc0' },
                    { id: 'Connection', label: 'Connection Topologies', count: 6, color: '#a78bfa' },
                    { id: 'External', label: 'Environmental Subsystems', count: 1, color: '#f8d57e' },
                  ].map(f => {
                    const active = targetFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setTargetFilter(f.id as any)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 16px',
                          borderRadius: 'var(--radius-full)',
                          background: active
                            ? (isLight ? '#f0fdfa' : 'rgba(80, 219, 192, 0.12)')
                            : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
                          border: active
                            ? `1.5px solid ${f.color}`
                            : (isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)'),
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: 12.5,
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: active ? `0 2px 10px ${f.color}25` : 'none',
                        }}
                      >
                        <span>{f.label}</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '1px 7px',
                          borderRadius: 10,
                          background: active ? f.color : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'),
                          color: active ? '#030A0F' : 'var(--text-tertiary)',
                        }}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 10 Target Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
                  {filteredTargets.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: 20,
                        borderRadius: 'var(--radius-lg)',
                        background: isLight ? '#ffffff' : 'rgba(12, 16, 27, 0.65)',
                        border: isLight ? '1px solid #dbe2ea' : '1px solid rgba(255,255,255,0.07)',
                        boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.03)' : '0 4px 20px rgba(0,0,0,0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Top Meta Bar: Number, Category, Scope Badge */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 800,
                            fontSize: 11.5,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: item.categoryBg,
                            color: item.categoryColor,
                            border: `1px solid ${item.categoryBorder}`,
                            flexShrink: 0,
                          }}>
                            #{String(item.id).padStart(2, '0')}
                          </span>
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            color: item.categoryColor,
                            whiteSpace: 'nowrap',
                          }}>
                            {item.category}
                          </span>
                        </div>

                        {/* Scope Pill Badge: Insulated with fixed alignment and zero overflow */}
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                            border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
                            fontSize: 11,
                            fontWeight: 700,
                            color: isLight ? '#334155' : 'var(--text-secondary)',
                            letterSpacing: '0.02em',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                          title={item.scope}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.categoryColor, flexShrink: 0 }} />
                          <span>{item.scope}</span>
                        </div>
                      </div>

                      {/* Target Syntax Banner (Dedicated full-width row) */}
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isLight ? '#f0f4f8' : '#060812',
                        border: isLight ? '1px solid #d5dee8' : '1px solid rgba(255, 255, 255, 0.08)',
                        marginBottom: 12,
                        overflowX: 'auto',
                      }}>
                        <DslCodeViewer code={item.target} isLight={isLight} inline />
                      </div>

                      {/* Description */}
                      <p style={{
                        margin: '0 0 14px 0',
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.55,
                        minHeight: 40,
                      }}>
                        {item.desc}
                      </p>

                      {/* Scene Usage Box */}
                      <div style={{
                        marginTop: 'auto',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: isLight ? '1px solid #d5dee8' : '1px solid rgba(255,255,255,0.08)',
                        background: isLight ? '#f0f4f8' : '#060812',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 10px',
                          background: isLight ? '#e8edf3' : '#0b101c',
                          borderBottom: isLight ? '1px solid #d5dee8' : '1px solid rgba(255,255,255,0.06)',
                          fontSize: 10.5,
                          color: 'var(--text-tertiary)',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <FileCode size={12} style={{ color: item.categoryColor }} />
                            <span>*.scene invocation</span>
                          </span>
                          <button
                            onClick={() => copyToClipboard(item.example, `target-${item.id}`)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedKey === `target-${item.id}` ? 'var(--status-active)' : 'var(--text-tertiary)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10.5,
                              fontWeight: 600,
                            }}
                            title="Copy snippet"
                          >
                            {copiedKey === `target-${item.id}` ? <Check size={12} style={{ color: 'var(--status-active)' }} /> : <Copy size={12} />}
                            <span>{copiedKey === `target-${item.id}` ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div style={{ padding: '8px 12px', overflowX: 'auto' }}>
                          <DslCodeViewer code={item.example} isLight={isLight} inline />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Tab Content 2: Where Condition AST */}
          {activeTab === 'where' && (
            <div className="glass-panel" style={{
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              background: isLight ? '#ffffff' : 'var(--bg-panel)',
              border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 20, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={20} /> Where Condition Engine & AST Graph Traversal (Spec §10)
              </h4>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
                The <code style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>where</code> clause evaluates a recursive Abstract Syntax Tree at runtime before mutating nodes. Conditions chain across lines with <code style={{ color: 'var(--accent-purple)' }}>&</code>:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
                <div style={{
                  padding: 20,
                  borderRadius: 'var(--radius-lg)',
                  background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--text-primary)' }}>1. Relational AST Operators</h5>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                    Evaluates numbers, strings, and booleans against live telemetry or static spec ratings:
                  </p>
                  <DslCodeViewer
                    code={`where type = "battery"
& status = "active"
& value.charge < 20.0
& is_backup = false`}
                    isLight={isLight}
                  />
                  <ul style={{ margin: '12px 0 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <li>Supports: <code>=</code>, <code>!=</code>, <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code>, <code>&gt;=</code></li>
                    <li>Evaluates nested paths: <code>value.voltage.output &gt; 120</code></li>
                  </ul>
                </div>

                <div style={{
                  padding: 20,
                  borderRadius: 'var(--radius-lg)',
                  background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: 16, color: 'var(--text-primary)' }}>2. Contextual Graph Lookups</h5>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                    Inspects connected neighbors and network topology from the perspective of <code style={{ color: 'var(--accent-primary)' }}>@node</code>:
                  </p>
                  <DslCodeViewer
                    code={`# Check outgoing data connection
where @connection(@node|data|)

# Check incoming control signal
& @connection(MainController||@node)

# Check target component type
& @component(target).type = "sensor"`}
                    isLight={isLight}
                  />
                  <ul style={{ margin: '12px 0 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <li><code>@node</code> dynamically binds to the candidate component.</li>
                    <li><code>@component(source)</code> evaluates connection endpoints.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Set Block Schema */}
          {activeTab === 'set' && (
            <div className="glass-panel" style={{
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              background: isLight ? '#ffffff' : 'var(--bg-panel)',
              border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 20, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Code2 size={20} /> Set Block Schema & Mutation Strictness (Spec §11)
              </h4>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
                The <code style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>set</code> block defines the parameter contract between <code style={{ color: 'var(--accent-primary)' }}>*.event</code> and <code style={{ color: 'var(--accent-cyan)' }}>*.scene</code>:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--status-failure)', marginBottom: 8 }}>Fixed Fields</div>
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: isLight ? '#f0f4f8' : '#060812', border: isLight ? '1px solid #d5dee8' : '1px solid rgba(255,255,255,0.08)' }}>
                    <DslCodeViewer code="status = failure" isLight={isLight} inline />
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    Hardcoded values enforced by the event. Scenes <strong>cannot</strong> override this; attempting to do so triggers a compilation error.
                  </p>
                </div>

                <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: 8 }}>Required Fields</div>
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: isLight ? '#f0f4f8' : '#060812', border: isLight ? '1px solid #d5dee8' : '1px solid rgba(255,255,255,0.08)' }}>
                    <DslCodeViewer code="values.temperature" isLight={isLight} inline />
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    The invoking scene <strong>must</strong> provide a value in its payload. If omitted, the compiler throws: <code>Missing required field</code>.
                  </p>
                </div>

                <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-amber)', marginBottom: 8 }}>Optional Fields (?)</div>
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: isLight ? '#f0f4f8' : '#060812', border: isLight ? '1px solid #d5dee8' : '1px solid rgba(255,255,255,0.08)' }}>
                    <DslCodeViewer code="?values.rpm" isLight={isLight} inline />
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    Prefixed with <code>?</code>. Scenes can safely omit this field without throwing validation errors.
                  </p>
                </div>

                <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 8 }}>Wildcard (fields)</div>
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: isLight ? '#f0f4f8' : '#060812', border: isLight ? '1px solid #d5dee8' : '1px solid rgba(255,255,255,0.08)' }}>
                    <DslCodeViewer code="fields" isLight={isLight} inline />
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    Relaxes strict schema checking, permitting the scene to pass arbitrary custom attributes without validation rejection.
                  </p>
                </div>
              </div>

              <div style={{
                marginTop: 20,
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                background: isLight ? '#fffbeb' : 'rgba(248, 213, 126, 0.08)',
                border: '1px solid rgba(248, 213, 126, 0.3)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <AlertTriangle size={20} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: isLight ? '#92400e' : '#fde68a', lineHeight: 1.5 }}>
                  <strong>Immutability Invariant:</strong> The structural metadata field <code style={{ fontWeight: 700 }}>is_backup</code> cannot be modified by any event or scene. Attempting to assign <code style={{ fontWeight: 700 }}>is_backup</code> raises an immediate compiler error.
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 4: Compiler & Twin Validation */}
          {activeTab === 'compiler' && (
            <div className="glass-panel" style={{
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              background: isLight ? '#ffffff' : 'var(--bg-panel)',
              border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 20, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={20} /> Compiler & Digital Twin Integration Pipeline
              </h4>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
                Every scenario script is cross-validated against the station's compiled <code style={{ color: 'var(--accent-primary)' }}>hierarchy.json</code>, <code style={{ color: 'var(--accent-cyan)' }}>spec.json</code>, and <code style={{ color: 'var(--accent-purple)' }}>connection.json</code> before simulation execution:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div style={{ padding: 18, borderRadius: 'var(--radius-lg)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--accent-primary)' }}>
                    <ShieldCheck size={18} />
                    <strong style={{ fontSize: 14 }}>1. Target Verification</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Resolves selectors against hierarchy.twin. If targeting a non-existent component or topological dead-end, raises a line-numbered target error.
                  </p>
                </div>

                <div style={{ padding: 18, borderRadius: 'var(--radius-lg)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--accent-cyan)' }}>
                    <Sliders size={18} />
                    <strong style={{ fontSize: 14 }}>2. Scope Disambiguation</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Spec ratings are scoped into <code>state</code>, <code>input</code>, and <code>output</code>. If <code>temperature</code> exists in multiple scopes, the compiler catches the collision and demands <code>state.temperature</code>.
                  </p>
                </div>

                <div style={{ padding: 18, borderRadius: 'var(--radius-lg)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--accent-purple)' }}>
                    <Cpu size={18} />
                    <strong style={{ fontSize: 14 }}>3. Type & Value Conformance</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Ensures numeric limits adhere to unit conversions (e.g. °C, L/s, W), booleans remain booleans, and <code>status</code> only equals <code>active</code>, <code>inactive</code>, or <code>failure</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
}

/* ── Main LandingPage ─────────────────────────────────── */
export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [stations, setStations] = useState<StationManifest[]>([]);
  const [loading, setLoading] = useState(true);
  // We removed scrollY state to improve performance and use CSS variables instead
  const isLight = theme === 'light';

  useEffect(() => {
    api.getStations()
      .then(data => { setStations(data); setLoading(false); })
      .catch(err => { console.error('Failed to fetch stations:', err); setLoading(false); });
  }, []);

  const heroRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;

    // Phase 1: Move up to the top center (over the first 300px of scroll)
    let pUp = y / 300;
    if (pUp > 1) pUp = 1;
    if (pUp < 0) pUp = 0;
    const easeUp = 1 - Math.pow(1 - pUp, 3);

    // Phase 2: Shrink and move left as we leave the hero section
    const vh = window.innerHeight;
    const heroBottom = vh;
    // Start moving left 400px before the hero section ends
    const startLeft = Math.max(300, heroBottom - 400);
    const endLeft = heroBottom;

    let pLeft = 0;
    if (y >= startLeft) {
      pLeft = (y - startLeft) / (endLeft - startLeft);
      if (pLeft > 1) pLeft = 1;
    }
    const easeLeft = 1 - Math.pow(1 - pLeft, 3);

    let rawP = y / 400;
    if (rawP > 1) rawP = 1;
    if (rawP < 0) rawP = 0;

    if (heroRef.current) {
      heroRef.current.style.setProperty('--p-up', easeUp.toString());
      heroRef.current.style.setProperty('--p-left', easeLeft.toString());
      heroRef.current.style.setProperty('--p', easeLeft.toString()); // For safety
      heroRef.current.style.setProperty('--raw-p', rawP.toString());
    }
  };

  return (
    <div
      ref={heroRef}
      onScroll={handleScroll}
      className="landing-scroll-container"
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-main)',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        // Initialize CSS variables so the calc() animations don't break before scrolling
        '--p-up': '0',
        '--p-left': '0',
        '--p': '0',
        '--raw-p': '0',
      } as React.CSSProperties}
    >

      {/* ─ Animated Fixed Overlay (No Navbar Background) ─ */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}>

        {/* Animated Icon has been moved to standard DOM flow */}
        {/* Animated Title */}
        <h1 style={{
          position: 'absolute',
          transition: 'all 0.15s ease-out',
          left: 'calc( 50vw * (1 - var(--p-left, 0)) + 32px * var(--p-left, 0) )',
          top: 'calc( clamp(220px, 30vh, 340px) * (1 - var(--p-up, 0)) + 36px * var(--p-up, 0) )',
          transform: 'translateX(calc( -50% * (1 - var(--p-left, 0)) ))',
          margin: 0,
          fontSize: 'calc( clamp(48px, 8vw, 84px) * (1 - var(--p-left)) + 32px * var(--p-left) )',
          fontWeight: 900,
          letterSpacing: 'calc( -0.04em * (1 - var(--p-left)) - 0.02em * var(--p-left) )',
          lineHeight: 1.05,
          color: isLight ? '#09111e' : '#fff',
          textShadow: isLight
            ? '0 0 28px rgba(255,255,255,0.98), 0 2px 10px rgba(255,255,255,0.9)'
            : '0 4px 20px rgba(0,0,0,calc(0.3 * (1 - var(--p-left))))',
          pointerEvents: 'auto',
          zIndex: 101,
          whiteSpace: 'nowrap',
        }}>
          Polar<span style={{
            color: isLight ? '#0284c7' : 'var(--accent-primary)',
            textShadow: isLight
              ? '0 0 24px #ffffff, 0 0 100px #ffffff, 0 1px 15px rgba(2, 132, 199, 0.4)'
              : '0 0 25px rgba(80, 219, 192, 0.45)',
          }}>Twin</span>
        </h1>

        {/* Animated Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn-icon card-hover"
          style={{
            position: 'absolute',
            transition: 'all 0.15s ease-out',
            top: 'calc( 24px * (1 - var(--p-up)) + 18px * var(--p-up) )',
            right: 'calc( 24px * (1 - var(--p-left)) + 32px * var(--p-left) )',
            background: isLight
              ? 'rgba(255,255,255,calc(0.7 * (1 - var(--p-left)) + 0.04 * var(--p-left)))'
              : 'rgba(255,255,255,calc(0.12 * (1 - var(--p-left)) + 0.1 * var(--p-left)))',
            border: isLight
              ? '1px solid rgba(0,0,0,calc(0.4 * (1 - var(--p-left)) + 0.08 * var(--p-left)))'
              : '1px solid rgba(255,255,255,calc(0.18 * (1 - var(--p-left)) + 0.15 * var(--p-left)))',
            color: isLight ? '#0f172a' : '#fff',
            borderRadius: 'var(--radius-full)',
            padding: 'calc( 12px * (1 - var(--p-left)) + 10px * var(--p-left) )',
            backdropFilter: 'blur(12px)',
            boxShadow: isLight ? '0 4px 12px rgba(0,0,0,calc(0.05 * (1 - var(--p-left))))' : 'none',
            pointerEvents: 'auto',
            zIndex: 101,
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {isLight ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      {/* ─ Hero Section ─ */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        overflow: 'hidden',
      }}>
        {/* Background image */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/hero.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: isLight ? 'brightness(1.04) contrast(0.90) saturate(1.05)' : 'brightness(0.4) saturate(1.1)',
          zIndex: 0,
          transition: 'filter 0.5s ease',
        }} />

        {/* Light Mode Overlay Gradient for top picture clarity and smooth bottom blend */}
        {isLight && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(243,246,250,0.5) 25%, rgba(243,246,250,0.82) 65%, rgba(243,246,250,1) 100%)',
            zIndex: 1,
            transition: 'opacity 0.5s ease',
            pointerEvents: 'none',
          }} />
        )}

        {/* Dynamic Canvas (Aurora or Snow) */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          <AuroraCanvas theme={theme} />
        </div>

        {/* Bottom gradient blend for Dark Mode */}
        {!isLight && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '40%',
            background: 'linear-gradient(to bottom, transparent 0%, var(--bg-main) 100%)',
            zIndex: 3,
            pointerEvents: 'none',
          }} />
        )}

        {/* Soft Contrast Backdrop for Light Mode Text Legibility */}
        {isLight && (
          <div style={{
            position: 'absolute',
            top: '44%',
            left: '50%',
            transform: 'translate(-50%, -44%)',
            width: 'min(1180px, 96vw)',
            height: '560px',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 2,
            filter: 'blur(30px)',
          }} />
        )}

        {/* Soft Contrast Backdrop for Dark Mode Text Legibility */}
        {!isLight && (
          <div style={{
            position: 'absolute',
            top: '44%',
            left: '50%',
            transform: 'translate(-50%, -44%)',
            width: 'min(1100px, 96vw)',
            height: '520px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(8, 11, 19, 0.78) 0%, rgba(8, 11, 19, 0.48) 55%, transparent 75%)',
            pointerEvents: 'none',
            zIndex: 2,
            filter: 'blur(35px)',
          }} />
        )}

        {/* Hero content (Fading out parts) */}
        <div style={{
          position: 'relative', zIndex: 5,
          textAlign: 'center',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          padding: 'calc( clamp(220px, 30vh, 340px) - 124px ) 24px 80px',
          animation: 'fadeInScale 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          maxWidth: 1240,
          margin: '0 auto',
          width: '100%',
        }}>

          {/* Hero Icon with Idle Hovering Animation */}
          <div
            className="hero-icon-wrapper"
            style={{
              opacity: 'calc(1 - var(--raw-p, 0))',
              marginBottom: '36px',
            }}
          >
            {/* Ambient Backdrop Glow */}
            <div className="hero-icon-backdrop" />

            {/* Translucent Glass Icon Container */}
            <div
              className="hero-icon-container"
              style={{
                borderRadius: '28px',
                background: isLight
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.65) 0%, rgba(224, 242, 254, 0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(80, 219, 192, 0.08) 100%)',
                border: isLight ? '1.5px solid rgba(2, 132, 199, 0.3)' : '1.5px solid rgba(80, 219, 192, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isLight ? '#0284c7' : 'var(--accent-primary)',
                backdropFilter: 'blur(20px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                cursor: 'pointer',
              }}
            >
              <Snowflake
                className="hero-snowflake-icon"
                style={{
                  width: '44px',
                  height: '44px',
                  strokeWidth: isLight ? 2.4 : 2.2,
                  filter: isLight
                    ? 'drop-shadow(0 2px 4px rgba(2, 132, 199, 0.35))'
                    : 'drop-shadow(0 0 10px rgba(80, 219, 192, 0.5))'
                }}
              />
            </div>
          </div>

          {/* Title Placeholder to preserve exact height/layout for fixed title */}
          <h1 style={{
            fontSize: 'clamp(48px, 8vw, 84px)',
            margin: 0, lineHeight: 1.05, opacity: 0, pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            PolarTwin
          </h1>

          {/* Subtitle & Mission Framing */}
          <div style={{
            opacity: 'calc(1 - var(--raw-p, 0))',
            marginTop: '38px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Mission Badge with Frosted Glass Pill */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isLight ? '#0369a1' : 'var(--accent-primary)',
              padding: '8px 22px',
              borderRadius: 'var(--radius-full)',
              background: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(12, 16, 27, 0.85)',
              border: isLight ? '1.5px solid rgba(2, 132, 199, 0.38)' : '1px solid rgba(80, 219, 192, 0.3)',
              backdropFilter: 'blur(16px)',
              boxShadow: isLight
                ? '0 4px 18px rgba(2, 132, 199, 0.12), 0 2px 6px rgba(15, 23, 42, 0.05)'
                : '0 0 16px rgba(80, 219, 192, 0.12)',
              marginBottom: 22,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isLight ? '#0284c7' : '#4ade80',
                boxShadow: isLight ? '0 0 8px #0284c7' : '0 0 8px #4ade80',
                display: 'inline-block'
              }} />
              <span>Remote Facility Management · Indian Antarctic Program</span>
            </div>

            <p style={{
              fontSize: 'clamp(16.5px, 1.8vw, 20px)',
              color: isLight ? '#09111e' : '#f8fafc',
              fontWeight: isLight ? 650 : 450,
              maxWidth: 760,
              margin: '0 auto',
              lineHeight: 1.75,
              letterSpacing: '-0.01em',
              textShadow: isLight
                ? '0 0 16px rgba(255,255,255,0.98), 0 1px 3px rgba(255,255,255,0.95)'
                : '0 2px 14px rgba(0,0,0,0.85), 0 0 35px rgba(0,0,0,0.9)',
            }}>
              Deterministic Digital Twin & Multi-Physics Simulation Platform for Antarctic research stations.
              Safeguard mission-critical power, thermal envelopes, and fluid loops under 8 months of polar isolation and -60°C katabatic blizzards.
            </p>

            {/* Stats pills */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 38 }}>
              {[
                { icon: Globe, label: '10Hz Live SCADA Telemetry' },
                { icon: Cpu, label: 'Deterministic 15s/Tick Solver' },
                { icon: Network, label: '4-Domain Topology Routing' },
                { icon: MonitorPlay, label: 'Reversible LIFO Scenario Drills' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '11px 22px',
                  background: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(12, 16, 27, 0.75)',
                  border: isLight ? '1.5px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 13.5, fontWeight: 750,
                  color: isLight ? '#09111e' : '#ffffff',
                  backdropFilter: 'blur(16px)',
                  boxShadow: isLight
                    ? '0 4px 18px rgba(2, 132, 199, 0.12), 0 2px 6px rgba(15, 23, 42, 0.05)'
                    : '0 4px 16px rgba(0,0,0,0.25)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  cursor: 'default',
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = isLight ? 'rgba(2, 132, 199, 0.6)' : 'var(--accent-primary)';
                    e.currentTarget.style.boxShadow = isLight ? '0 8px 24px rgba(2, 132, 199, 0.2), 0 4px 10px rgba(0,0,0,0.08)' : '0 6px 20px rgba(0,0,0,0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = isLight ? 'rgba(2, 132, 199, 0.3)' : 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.boxShadow = isLight ? '0 4px 18px rgba(2, 132, 199, 0.12), 0 2px 6px rgba(15, 23, 42, 0.05)' : '0 4px 16px rgba(0,0,0,0.25)';
                  }}
                >
                  <Icon size={16} strokeWidth={2.4} style={{ color: isLight ? '#0284c7' : 'var(--accent-primary)', flexShrink: 0 }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sleek Scroll Indicator at bottom of the full-screen hero */}
        <div
          onClick={() => {
            const el = document.getElementById('interactive-3d-hologram');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            zIndex: 10,
            opacity: 'calc(1 - var(--raw-p, 0))',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) translateY(2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) translateY(0)';
          }}
        >
          <span style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: isLight ? '#1e293b' : 'rgba(255, 255, 255, 0.6)',
            textShadow: isLight ? '0 0 10px #ffffff' : 'none',
          }}>
            Explore Station Hologram
          </span>
          <ChevronDown
            size={18}
            className="float-y"
            style={{
              color: 'var(--accent-primary)',
              filter: isLight ? 'drop-shadow(0 1px 2px rgba(2,132,199,0.3))' : 'drop-shadow(0 0 6px rgba(80,219,192,0.5))',
            }}
          />
        </div>
      </section>

      {/* ─ 3D Spatial Digital Twin Holographic Centerpiece ─ */}
      <section
        id="interactive-3d-hologram"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          width: '100%',
          padding: '40px 24px 60px',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              <Box size={14} />
              <span>Interactive Spatial Architecture</span>
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 0 0', letterSpacing: '-0.02em' }}>
              Antarctic Research Base Hologram
            </h2>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13.5, maxWidth: 480 }}>
            Inspect modular stilt habitats, communications radomes, katabatic wind turbines, and power hubs. Toggle blizzard stress or generator faults to preview telemetry cascades.
          </p>
        </div>

        {/* The 3D Canvas */}
        <StationHologram3D isLight={isLight} />
      </section>

      {/* ─ Stations Section ─ */}
      <section style={{
        padding: '70px 24px',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{ marginBottom: '40px', textAlign: 'center', animation: 'fadeIn 0.6s 0.2s ease both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              height: 2, width: 40,
              background: 'linear-gradient(to right, transparent, var(--accent-primary))',
              borderRadius: 2,
            }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
              Active Deployments
            </span>
            <div style={{
              height: 2, width: 40,
              background: 'linear-gradient(to left, transparent, var(--accent-primary))',
              borderRadius: 2,
            }} />
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 14px 0', letterSpacing: '-0.03em' }}>
            Select Station Deployment
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0, maxWidth: 580, marginInline: 'auto', lineHeight: 1.6 }}>
            Connect to live operational digital twins. View compiled component topologies, telemetry records, and inject deterministic scenarios.
          </p>
        </div>

        {loading ? (
          <div className="loading-container" style={{ padding: '80px 0' }}>
            <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>Connecting to telemetry...</span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '32px',
          }}>
            {stations.map((station, i) => (
              <div key={station.station_id} className="fade-in" style={{ animationDelay: `${i * 0.1}s`, flex: '1 1 340px', maxWidth: '440px', width: '100%' }}>
                <StationCard station={station} />
              </div>
            ))}
            <div className="fade-in" style={{ animationDelay: `${stations.length * 0.1}s`, flex: '1 1 340px', maxWidth: '440px', width: '100%' }}>
              <MockStationCard />
            </div>
          </div>
        )}
      </section>

      {/* ─ Mission Operations Suite (6 Dedicated Workspaces) ─ */}
      <CommandCenterTour
        stationId={stations[0]?.station_id || 'Maitri'}
        isLight={isLight}
      />

      {/* ─ Platform Capabilities & Engine Suite (Bento Architecture) ─ */}
      <PlatformCapabilitiesSection isLight={isLight} />

      {/* ─ Scripting Section: Interactive DSL Studio & Technical Reference ─ */}
      <DslInteractiveStudio isLight={isLight} />


      {/* ─ Footer ─ */}
      <Footer variant="landing" />
    </div>
  );
}
