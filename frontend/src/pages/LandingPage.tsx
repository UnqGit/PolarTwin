import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, type StationManifest } from '../lib/api';
import {
  Snowflake, Activity, Box, MapPin, Radio,
  MonitorPlay, Zap, Sun, Moon, ArrowRight,
  Globe, Cpu
} from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

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

/* ── Station Card ─────────────────────────────────────── */
function StationCard({ station }: { station: StationManifest }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

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
          border: isLight ? '1px solid rgba(2, 132, 199, 0.1)' : '1px solid var(--border-color)',
        }}
      >
        {/* Accent glow corner */}
        <div style={{
          position: 'absolute',
          top: -40, right: -40,
          width: 140, height: 140,
          borderRadius: '50%',
          background: isLight 
            ? 'radial-gradient(circle, rgba(2,132,199,0.08) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99,219,188,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 'var(--radius-md)',
            background: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(99,219,188,0.1)',
            border: isLight ? '1px solid rgba(2, 132, 199, 0.15)' : '1px solid rgba(99,219,188,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-primary)',
            flexShrink: 0,
            boxShadow: isLight ? 'none' : 'var(--shadow-glow)',
          }}>
            <MapPin size={24} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: '19px', fontWeight: 800,
              color: 'var(--text-primary)', letterSpacing: '-0.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {station.station_id}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--status-active)',
                boxShadow: isLight ? '0 0 8px rgba(22, 163, 74, 0.4)' : '0 0 8px var(--status-active)',
                animation: 'pulseDot 2.5s infinite'
              }} />
              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Active Deployment
              </span>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        </div>

        <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.06)' : 'var(--border-color)' }} />

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            <Box size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span><strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{station.component_count}</strong> Components</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            <Activity size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span><strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{station.connection_count}</strong> Connections</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Mock (locked) Station Card ───────────────────────── */
function MockStationCard() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div
      style={{ display: 'block', opacity: isLight ? 0.8 : 0.6, cursor: 'not-allowed' }}
      title="Compilation pending / Invalid twin format"
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
          background: isLight ? 'rgba(255,255,255,0.6)' : 'var(--bg-panel)',
          border: isLight ? '1px dashed rgba(0,0,0,0.1)' : '1px solid var(--border-color)',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 12, right: 16,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          background: isLight ? 'rgba(217, 119, 6, 0.1)' : 'rgba(248,213,126,0.1)',
          color: 'var(--accent-amber)',
          border: isLight ? '1px solid rgba(217, 119, 6, 0.2)' : '1px solid rgba(248,213,126,0.25)',
          padding: '3px 10px',
          borderRadius: 'var(--radius-full)',
        }}>
          PENDING
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 'var(--radius-md)',
            background: isLight ? 'rgba(0,0,0,0.03)' : 'var(--bg-input)',
            border: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)',
            flexShrink: 0,
          }}>
            <MapPin size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Bharati
            </h3>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Mock Deployment</span>
          </div>
        </div>

        <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.06)' : 'var(--border-color)' }} />

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '13.5px' }}>
            <Box size={16} /> <span>278 Components</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '13.5px' }}>
            <Activity size={16} /> <span>433 Connections</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Feature Card ─────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, color, glowColor }: { icon: any; title: string; desc: string; color: string, glowColor: string }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div
      className="glass-panel card-hover"
      style={{
        flex: '1 1 280px', maxWidth: 340,
        padding: '36px 32px',
        borderRadius: 'var(--radius-xl)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden',
        background: isLight 
          ? 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.8) 100%)' 
          : 'var(--bg-panel)',
        border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)',
        boxShadow: isLight ? '0 12px 32px -12px rgba(0,0,0,0.06)' : 'var(--shadow-md)',
      }}
    >
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 150, height: 150, borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        pointerEvents: 'none',
        opacity: isLight ? 0.5 : 1,
      }} />
      <div style={{
        width: 56, height: 56,
        borderRadius: 'var(--radius-lg)',
        background: isLight ? `${color}15` : `${color}14`,
        border: isLight ? `1px solid ${color}25` : `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
        boxShadow: isLight ? `0 8px 24px -8px ${color}60` : `0 0 20px ${color}18`,
      }}>
        <Icon size={28} strokeWidth={2.2} />
      </div>
      <div>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: 1.65 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

/* ── Main LandingPage ─────────────────────────────────── */
export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [stations, setStations] = useState<StationManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const isLight = theme === 'light';

  useEffect(() => {
    api.getStations()
      .then(data => { setStations(data); setLoading(false); })
      .catch(err => { console.error('Failed to fetch stations:', err); setLoading(false); });
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>

      {/* ─ Hero Section ─ */}
      <section style={{
        position: 'relative',
        minHeight: '76vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Background image */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/hero.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: isLight ? 'brightness(0.95) contrast(1.05) saturate(1.1)' : 'brightness(0.4) saturate(1.1)',
          zIndex: 0,
          transition: 'filter 0.5s ease',
        }} />

        {/* Light Mode Overlay Gradient for better text readability */}
        {isLight && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.6) 0%, rgba(243,246,250,1) 100%)',
            zIndex: 1,
            transition: 'opacity 0.5s ease',
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
            height: '50%',
            background: 'linear-gradient(to bottom, transparent 0%, var(--bg-main) 100%)',
            zIndex: 3,
          }} />
        )}

        {/* Theme toggle */}
        <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
          <button
            onClick={toggleTheme}
            className="btn-icon card-hover"
            style={{
              background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.12)',
              border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.18)',
              color: isLight ? '#0f172a' : '#fff',
              borderRadius: 'var(--radius-full)',
              backdropFilter: 'blur(12px)',
              padding: 12,
              boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {isLight ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        {/* Hero content */}
        <div style={{
          position: 'relative', zIndex: 5,
          textAlign: 'center',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '24px',
          padding: '0 24px',
          animation: 'fadeInScale 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}>
          {/* Icon */}
          <div style={{
            width: 88, height: 88,
            borderRadius: 28,
            background: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(99,219,188,0.15)',
            border: isLight ? '1px solid rgba(2, 132, 199, 0.2)' : '1px solid rgba(99,219,188,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-primary)',
            backdropFilter: 'blur(16px)',
            boxShadow: isLight 
              ? '0 20px 40px -10px rgba(2,132,199,0.15), 0 0 0 1px rgba(255,255,255,0.5) inset' 
              : '0 0 40px rgba(99,219,188,0.2), 0 8px 32px rgba(0,0,0,0.3)',
          }}
            className="float-y"
          >
            <Snowflake size={42} strokeWidth={2} />
          </div>

          {/* Title */}
          <div>
            <h1 style={{
              fontSize: 'clamp(48px, 8vw, 84px)',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              margin: 0,
              lineHeight: 1.05,
              color: isLight ? '#0f172a' : '#fff',
              textShadow: isLight ? '0 4px 24px rgba(255,255,255,0.8)' : '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              Polar<span style={{ color: 'var(--accent-primary)' }}>Twin</span>
            </h1>
            <p style={{
              fontSize: 'clamp(16px, 2vw, 19px)',
              color: isLight ? '#334155' : 'rgba(255,255,255,0.8)',
              fontWeight: 500,
              maxWidth: 640,
              margin: '20px auto 0',
              lineHeight: 1.7,
              textShadow: isLight ? '0 2px 10px rgba(255,255,255,0.8)' : 'none',
            }}>
              Advanced digital twin simulation platform for Antarctic research stations.
              Monitor, simulate, and analyze infrastructure in the harshest environments on Earth.
            </p>
          </div>

          {/* Stats pills */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
            {[
              { icon: Globe, label: 'Live Telemetry' },
              { icon: Cpu, label: 'Real-time Digital Twin' },
              { icon: MonitorPlay, label: 'Scenario Simulation' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px',
                background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.3)',
                borderRadius: 'var(--radius-full)',
                fontSize: 13.5, fontWeight: 700, 
                color: isLight ? '#1e293b' : '#ffffff',
                backdropFilter: 'blur(12px)',
                boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.03)' : '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = isLight ? '0 6px 16px rgba(0,0,0,0.06)' : '0 6px 16px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isLight ? '0 4px 12px rgba(0,0,0,0.03)' : '0 4px 12px rgba(0,0,0,0.1)';
              }}
              >
                <Icon size={16} strokeWidth={2.5} style={{ color: 'var(--accent-primary)' }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─ Stations Section ─ */}
      <section style={{
        padding: '80px 24px',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{ marginBottom: '48px', textAlign: 'center', animation: 'fadeIn 0.6s 0.2s ease both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              height: 2, width: 40,
              background: 'linear-gradient(to right, transparent, var(--accent-primary))',
              borderRadius: 2,
            }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
              Deployments
            </span>
            <div style={{
              height: 2, width: 40,
              background: 'linear-gradient(to left, transparent, var(--accent-primary))',
              borderRadius: 2,
            }} />
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 16px 0', letterSpacing: '-0.03em' }}>
            Select a Station
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0, maxWidth: 540, marginInline: 'auto', lineHeight: 1.6 }}>
            Choose an active deployment to access its digital twin, component hierarchy, and scenario simulations.
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

      {/* ─ Features Section ─ */}
      <section style={{
        padding: '100px 24px',
        background: isLight ? '#FFFFFF' : 'var(--bg-panel-secondary)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: isLight ? '0 -10px 40px rgba(0,0,0,0.02)' : 'none',
        position: 'relative',
      }}>
        {/* Subtle mesh background for light mode capabilities section */}
        {isLight && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 20% 0%, rgba(2, 132, 199, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 100%, rgba(124, 58, 237, 0.03) 0%, transparent 50%)',
            pointerEvents: 'none',
          }} />
        )}
        
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ height: 2, width: 40, background: 'linear-gradient(to right, transparent, var(--accent-purple))', borderRadius: 2 }} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-purple)' }}>
                Capabilities
              </span>
              <div style={{ height: 2, width: 40, background: 'linear-gradient(to left, transparent, var(--accent-purple))', borderRadius: 2 }} />
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 16px 0', letterSpacing: '-0.03em' }}>
              Platform Capabilities
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: '0 auto', maxWidth: 560, lineHeight: 1.6 }}>
              Everything you need to monitor, simulate, and optimize remote research infrastructure with absolute precision.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'center' }}>
            <FeatureCard
              icon={Radio}
              title="Real-time Telemetry"
              desc="Stream live sensor data from physical components directly into the digital twin for instant health monitoring and diagnostics."
              color="var(--accent-primary)"
              glowColor="rgba(99,219,188,0.15)"
            />
            <FeatureCard
              icon={MonitorPlay}
              title="Scenario Simulation"
              desc="Design custom timeline events—like extreme weather or power failures—and watch the station components react dynamically."
              color="var(--accent-purple)"
              glowColor="rgba(167,139,250,0.15)"
            />
            <FeatureCard
              icon={Zap}
              title="3D Visualization"
              desc="Explore an immersive representation of the station hierarchy, enabling rapid spatial awareness and component localization."
              color="var(--accent-cyan)"
              glowColor="rgba(56,217,245,0.15)"
            />
          </div>
        </div>
      </section>

      {/* ─ Footer ─ */}
      <footer style={{
        padding: '32px 40px',
        borderTop: isLight ? 'none' : '1px solid var(--border-color)',
        background: isLight ? '#F8FAFC' : 'var(--bg-panel)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--accent-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-primary)'
          }}>
            <Snowflake size={16} strokeWidth={2.5} />
          </div>
          <span>© 2026 PolarTwin. All rights reserved.</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['About', 'Privacy Policy', 'Terms of Service'].map(label => (
            <a
              key={label}
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              {label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
