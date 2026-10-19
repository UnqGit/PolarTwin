import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, type StationManifest } from '../lib/api';
import {
  Snowflake, Activity, Box, MapPin, Radio,
  MonitorPlay, Zap, Sun, Moon, ArrowRight,
  Globe, Cpu, FileCode, Clock, Layers
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
    const heroBottom = vh * 0.76;
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
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--bg-main)',
        overflowY: 'auto',
        overflowX: 'hidden',
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
          top: 'calc( (38vh - 53px) * (1 - var(--p-up, 0)) + 36px * var(--p-up, 0) )',
          transform: 'translateX(calc( -50% * (1 - var(--p-left, 0)) ))',
          margin: 0,
          fontSize: 'calc( clamp(48px, 8vw, 84px) * (1 - var(--p-left)) + 32px * var(--p-left) )',
          fontWeight: 900,
          letterSpacing: 'calc( -0.04em * (1 - var(--p-left)) - 0.02em * var(--p-left) )',
          lineHeight: 1.05,
          color: isLight ? '#0f172a' : '#fff',
          textShadow: isLight
            ? '0 4px 24px rgba(255,255,255,calc(0.3 * (1 - var(--p-left))))'
            : '0 4px 20px rgba(0,0,0,calc(0.3 * (1 - var(--p-left))))',
          pointerEvents: 'auto',
          zIndex: 101,
          whiteSpace: 'nowrap',
        }}>
          Polar<span style={{ color: 'var(--accent-primary)' }}>Twin</span>
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
        minHeight: '76vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
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

        {/* Light Mode Overlay Gradient for top picture clarity and smooth bottom blend */}
        {isLight && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.05) 10%, rgba(243,246,250,0.4) 25%, rgba(243,246,250,0.85) 80%, rgba(243,246,250,1) 100%)',
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

        {/* Hero content (Fading out parts) */}
        <div style={{
          position: 'relative', zIndex: 5,
          textAlign: 'center',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '24px',
          padding: 'calc( 38vh - 165px ) 24px 60px',
          animation: 'fadeInScale 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}>

          {/* Hero Icon with Idle Hovering Animation */}
          <div
            className="hero-icon-wrapper"
            style={{
              opacity: 'calc(1 - var(--raw-p, 0))',
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
            margin: 0, lineHeight: 1.05, opacity: 0, pointerEvents: 'none'
          }}>
            PolarTwin
          </h1>

          {/* Subtitle & Stats (Fades out slower and scrolls up naturally) */}
          <div style={{
            opacity: 'calc(1 - var(--raw-p, 0))',
          }}>
            <p style={{
              fontSize: 'clamp(16px, 2vw, 19px)',
              color: isLight ? '#0f172a' : 'rgba(255,255,255,0.8)',
              fontWeight: isLight ? 600 : 500,
              maxWidth: 640,
              margin: '20px auto 0',
              lineHeight: 1.7,
              textShadow: isLight ? '0 2px 14px rgba(240,250,255,0.8), 0 0 4px rgba(255,255,255,0.8)' : 'none',
            }}>
              Advanced digital twin simulation platform for Antarctic research stations.
              Monitor, simulate, and analyze infrastructure in the harshest environments on Earth.
            </p>

            {/* Stats pills */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 36 }}>
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

      {/* ─ Scripting Section ─ */}
      <section style={{
        padding: '100px 24px',
        background: 'var(--bg-main)',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ height: 2, width: 40, background: 'linear-gradient(to right, transparent, var(--accent-cyan))', borderRadius: 2 }} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                Deterministic Engine
              </span>
              <div style={{ height: 2, width: 40, background: 'linear-gradient(to left, transparent, var(--accent-cyan))', borderRadius: 2 }} />
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 16px 0', letterSpacing: '-0.03em' }}>
              Scenario Scripting DSL
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: '0 auto', maxWidth: 640, lineHeight: 1.6 }}>
              Control runtime behavior and inject faults with absolute precision using our custom Domain-Specific Language. Scripts compile into an AST and execute deterministically on the simulation engine.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '32px' }}>

            {/* --- EVENT FILES SECTION --- */}
            <div style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <FileCode size={28} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Event Definitions (*.event)</h3>
              </div>
              <p style={{ margin: '16px 0 0 0', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.6 }}>
                Event files act as reusable, typed functions that encapsulate fault injections or state overrides. They consist of three primary blocks: <strong>Target</strong>, <strong>Where</strong>, and <strong>Set</strong>.
              </p>
            </div>

            {/* Event: Target Card */}
            <div className="glass-panel" style={{ gridColumn: 'span 4', borderRadius: 'var(--radius-xl)', padding: '24px', background: isLight ? '#fff' : 'var(--bg-panel)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Box size={18} /> Target Mechanism</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Defines the scope of the event. Supports components, connections, and external systems.</p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li><code>@component.name</code> / <code>@component.type</code></li>
                <li>Combined: <code>@component.type | @component.name</code></li>
                <li>Connections: <code>@connection.source</code></li>
                <li>Multi-field: <code>@connection.(source & target)</code></li>
                <li>External: <code>@external.weather</code></li>
              </ul>
            </div>

            {/* Event: Where Card */}
            <div className="glass-panel" style={{ gridColumn: 'span 4', borderRadius: 'var(--radius-xl)', padding: '24px', background: isLight ? '#fff' : 'var(--bg-panel)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} /> Where Filters</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Filters the target scope based on runtime or static attributes. Complex queries can be chained.</p>
              <div style={{ background: isLight ? '#f1f5f9' : '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: 13, color: isLight ? '#334155' : '#cbd5e1' }}>
                <span style={{ color: '#c678dd' }}>where</span> type=<span style={{ color: '#98c379' }}>"battery"</span><br />
                <span style={{ color: '#c678dd' }}>&</span> status=<span style={{ color: '#98c379' }}>"online"</span><br />
                <span style={{ color: '#c678dd' }}>&</span> charge &lt; <span style={{ color: '#d19a66' }}>20</span>
              </div>
            </div>

            {/* Event: Set Card */}
            <div className="glass-panel" style={{ gridColumn: 'span 4', borderRadius: 'var(--radius-xl)', padding: '24px', background: isLight ? '#fff' : 'var(--bg-panel)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><FileCode size={18} /> Set Declarations</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Declares the payload schema that scenes can override.</p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li><strong>Fixed:</strong> <code>status=failure</code> (hardcoded)</li>
                <li><strong>Required:</strong> <code>values.temp</code> (scene must provide)</li>
                <li><strong>Optional:</strong> <code>?values.voltage</code> (scene can omit)</li>
                <li><strong>Open:</strong> <code>fields</code> keyword allows arbitrary keys</li>
              </ul>
            </div>

            {/* --- SCENE FILES SECTION --- */}
            <div style={{ gridColumn: '1 / -1', marginTop: '32px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <Clock size={28} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Timeline Sequencing (*.scene)</h3>
              </div>
              <p style={{ margin: '16px 0 0 0', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.6 }}>
                Scene files orchestrate the simulation. They invoke events like functions, passing arguments and scheduling them on a global timeline.
              </p>
            </div>

            {/* Scene: Invocation Card */}
            <div className="glass-panel" style={{ gridColumn: 'span 6', borderRadius: 'var(--radius-xl)', padding: '24px', background: isLight ? '#fff' : 'var(--bg-panel)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--accent-cyan)' }}>Invokable Events & Selectors</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Events are invoked via <code>event:&lt;name&gt;</code>. Selectors (e.g. <code>@Generator1</code>) resolve against the event's <code>where</code> filters to target specific components or connections.
              </p>
              <div style={{ background: isLight ? '#0f172a' : '#020617', padding: '16px', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0', overflowX: 'auto', whiteSpace: 'pre' }}>
                <span style={{ color: '#5c6370', fontStyle: 'italic' }}># Target component by name</span>{'\n'}
                <span style={{ color: '#c678dd' }}>event:</span><span style={{ color: '#e5c07b' }}>fail</span> <span style={{ color: '#61afef' }}>@Generator1</span> <span style={{ color: '#c678dd' }}>at=</span><span style={{ color: '#d19a66' }}>0.0</span> <span style={{ color: '#c678dd' }}>for=</span><span style={{ color: '#d19a66' }}>2.5</span>{'\n\n'}
                <span style={{ color: '#5c6370', fontStyle: 'italic' }}># Target connection by name</span>{'\n'}
                <span style={{ color: '#c678dd' }}>event:</span><span style={{ color: '#e5c07b' }}>cut_power</span> <span style={{ color: '#61afef' }}>@Gen1_to_Grid</span> <span style={{ color: '#c678dd' }}>at=</span><span style={{ color: '#d19a66' }}>1.0</span> <span style={{ color: '#c678dd' }}>for=</span><span style={{ color: '#d19a66' }}>inf</span>
              </div>
            </div>

            {/* Scene: Set & Inf Card */}
            <div className="glass-panel" style={{ gridColumn: 'span 6', borderRadius: 'var(--radius-xl)', padding: '24px', background: isLight ? '#fff' : 'var(--bg-panel)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--accent-cyan)' }}>Overrides & Duration</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Use a <code>set {'{ ... }'}</code> block to satisfy required fields defined in the event. The <code>inf</code> keyword creates a permanent baseline override.
              </p>
              <div style={{ background: isLight ? '#0f172a' : '#020617', padding: '16px', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0', overflowX: 'auto', whiteSpace: 'pre' }}>
                <span style={{ color: '#5c6370', fontStyle: 'italic' }}># 'inf' duration permanently overrides</span>{'\n'}
                <span style={{ color: '#c678dd' }}>event:</span><span style={{ color: '#e5c07b' }}>set_comp</span> <span style={{ color: '#61afef' }}>@Heater</span> <span style={{ color: '#c678dd' }}>at=</span><span style={{ color: '#d19a66' }}>2.0</span> <span style={{ color: '#c678dd' }}>for=</span><span style={{ color: '#d19a66' }}>inf</span> <span style={{ color: '#c678dd' }}>set</span> {'{'}{'\n'}
                {'    '}values.temperature=<span style={{ color: '#d19a66' }}>-40.5</span>{'\n'}
                {'    '}custom_prop=<span style={{ color: '#98c379' }}>"allowed via 'fields'"</span>{'\n'}
                {'}'}
              </div>
            </div>

            {/* --- EXECUTION SECTION --- */}
            <div style={{ gridColumn: '1 / -1', marginTop: '32px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <Cpu size={28} style={{ color: 'var(--accent-purple)' }} />
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Execution & The Inspector</h3>
              </div>
            </div>

            {/* Execution: LIFO */}
            <div className="glass-panel" style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-xl)', padding: '32px', background: isLight ? '#fff' : 'var(--bg-panel)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 20, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 10 }}><Layers size={22} /> LIFO Unwinding</h4>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
                The engine utilizes a strict <strong>Last-In-First-Out (LIFO)</strong> state stack. When an event fires for a set duration (e.g., <code>for=1.5h</code>), it pushes to the top of the stack. When the duration expires, the stack automatically pops, <strong>unwinding</strong> the simulation back to the state directly underneath it, seamlessly restoring nominal operations. Infinite events never pop.
              </p>

              <div style={{ background: isLight ? 'rgba(167,139,250,0.05)' : 'rgba(167,139,250,0.1)', padding: '24px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isLight ? '1px solid rgba(167,139,250,0.2)' : '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
                  <div style={{ background: 'var(--accent-purple)', padding: '12px 20px', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center', boxShadow: '0 4px 12px rgba(167,139,250,0.3)', transform: 'translateY(10px)', zIndex: 3, position: 'relative' }}>
                    [Active] Temporary Event (Popping in 1h)
                  </div>
                  <div style={{ background: isLight ? '#e2e8f0' : '#334155', padding: '12px 20px', borderRadius: 'var(--radius-md)', color: isLight ? '#475569' : '#cbd5e1', fontSize: 13, fontWeight: 600, textAlign: 'center', opacity: 0.8, transform: 'scale(0.95)', zIndex: 2, position: 'relative' }}>
                    [Hidden] Infinite Event (Override)
                  </div>
                  <div style={{ background: isLight ? '#cbd5e1' : '#1e293b', padding: '12px 20px', borderRadius: 'var(--radius-md)', color: isLight ? '#64748b' : '#94a3b8', fontSize: 13, fontWeight: 600, textAlign: 'center', opacity: 0.5, transform: 'scale(0.9) translateY(-10px)', zIndex: 1, position: 'relative' }}>
                    Baseline Initial State
                  </div>
                </div>
              </div>
            </div>

            {/* Execution: Inspector */}
            <div className="glass-panel" style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-xl)', padding: '32px', background: isLight ? '#fff' : 'var(--bg-panel)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--border-color)', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'var(--shadow-md)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 20, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 10 }}><Radio size={22} /> Ad-hoc Inspector</h4>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
                You aren't limited to writing DSL text files. The <strong>UI Inspector</strong> integrates directly with the engine's LIFO stack in real-time.
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <li>Pause the simulation at any timeline frame.</li>
                <li>Manually inject an event or override component parameters.</li>
                <li>The engine instantly parses the injection as an AST payload.</li>
                <li>The ad-hoc event is pushed to the LIFO stack and evaluates dynamically, allowing interactive disaster testing.</li>
              </ul>
            </div>

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
