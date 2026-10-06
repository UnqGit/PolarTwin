import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, type StationManifest } from '../lib/api';
import {
  Snowflake, Activity, Box, MapPin, Radio,
  MonitorPlay, Zap, Sun, Moon, ArrowRight,
  Globe, Cpu
} from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

/* ── Aurora particle canvas ───────────────────────────── */
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
      // Light theme: Snow particles
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2 + 0.8,
          speed: Math.random() * 1.2 + 0.4,
          speedX: Math.random() * 0.8 - 0.4,
          alpha: Math.random() * 0.6 + 0.2,
          color: '#ffffff',
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
          p.x += p.speedX + Math.sin(frame * 2 + idx * 0.1) * 0.4;
          if (p.y > h + 5) { p.y = -5; p.x = Math.random() * w; }
          if (p.x > w + 5) { p.x = -5; }
          if (p.x < -5) { p.x = w + 5; }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        if (isDark) {
          ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, '0');
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        }
        ctx.fill();
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
        }}
      >
        {/* Accent glow corner */}
        <div style={{
          position: 'absolute',
          top: -30, right: -30,
          width: 120, height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,219,188,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99,219,188,0.1)',
            border: '1px solid rgba(99,219,188,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-primary)',
            flexShrink: 0,
            boxShadow: 'var(--shadow-glow)',
          }}>
            <MapPin size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: '18px', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {station.station_id}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--status-active)',
                boxShadow: '0 0 5px var(--status-active)',
                animation: 'pulseDot 2.5s infinite'
              }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Active Deployment
              </span>
            </div>
          </div>
          <ArrowRight size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        </div>

        <div style={{ height: 1, background: 'var(--border-color)' }} />

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <Box size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{station.component_count}</strong> Components</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <Activity size={14} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{station.connection_count}</strong> Connections</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Mock (locked) Station Card ───────────────────────── */
function MockStationCard() {
  return (
    <div
      style={{ display: 'block', opacity: 0.6, cursor: 'not-allowed' }}
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
        }}
      >
        <div style={{
          position: 'absolute',
          top: 8, right: 12,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          background: 'rgba(248,213,126,0.1)',
          color: 'var(--accent-amber)',
          border: '1px solid rgba(248,213,126,0.25)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
        }}>
          PENDING
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)',
            flexShrink: 0,
          }}>
            <MapPin size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Bharati
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Mock Deployment</span>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-color)' }} />

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            <Box size={14} /> <span>278 Components</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            <Activity size={14} /> <span>433 Connections</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Feature Card ─────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, color }: { icon: any; title: string; desc: string; color: string }) {
  return (
    <div
      className="glass-panel card-hover"
      style={{
        flex: '1 1 280px', maxWidth: 340,
        padding: '32px 28px',
        borderRadius: 'var(--radius-xl)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 120, height: 120, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        width: 52, height: 52,
        borderRadius: 'var(--radius-lg)',
        background: `${color}14`,
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
        boxShadow: `0 0 20px ${color}18`,
      }}>
        <Icon size={26} />
      </div>
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.65 }}>
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
        minHeight: '72vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Background image */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/hero.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: theme === 'light' ? 'brightness(0.55) saturate(0.8)' : 'brightness(0.4) saturate(1.1)',
          zIndex: 0,
          transition: 'filter 0.4s ease',
        }} />

        {/* Dynamic Canvas (Aurora or Snow) */}
        <AuroraCanvas theme={theme} />

        {/* Bottom gradient blend */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '50%',
          background: 'linear-gradient(to bottom, transparent 0%, var(--bg-main) 100%)',
          zIndex: 1,
        }} />

        {/* Theme toggle */}
        <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
          <button
            onClick={toggleTheme}
            className="btn-icon"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              borderRadius: 'var(--radius-full)',
              backdropFilter: 'blur(8px)',
              padding: 10,
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Hero content */}
        <div style={{
          position: 'relative', zIndex: 2,
          textAlign: 'center',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '20px',
          padding: '0 24px',
          animation: 'fadeIn 0.8s ease forwards',
        }}>
          {/* Icon */}
          <div style={{
            width: 80, height: 80,
            borderRadius: 24,
            background: 'rgba(99,219,188,0.15)',
            border: '1px solid rgba(99,219,188,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-primary)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 40px rgba(99,219,188,0.2), 0 8px 32px rgba(0,0,0,0.3)',
          }}
            className="float-y"
          >
            <Snowflake size={38} />
          </div>

          {/* Title */}
          <div>
            <h1 style={{
              fontSize: 'clamp(40px, 7vw, 72px)',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              margin: 0,
              lineHeight: 1.05,
              color: '#fff',
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              Polar<span style={{ color: 'var(--accent-primary)' }}>Twin</span>
            </h1>
            <p style={{
              fontSize: 'clamp(15px, 2vw, 18px)',
              color: 'rgba(255,255,255,0.75)',
              maxWidth: 580,
              margin: '16px auto 0',
              lineHeight: 1.7,
            }}>
              Advanced digital twin simulation platform for Antarctic research stations.
              Monitor, simulate, and analyze infrastructure in the harshest environments on Earth.
            </p>
          </div>

          {/* Stats pills */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            {[
              { icon: Globe, label: 'Live Telemetry' },
              { icon: Cpu, label: 'Real-time Digital Twin' },
              { icon: MonitorPlay, label: 'Scenario Simulation' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 'var(--radius-full)',
                fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
              }}>
                <Icon size={14} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─ Stations Section ─ */}
      <section style={{
        padding: '60px 24px',
        maxWidth: 1100,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ marginBottom: '40px', textAlign: 'center', animation: 'fadeIn 0.6s 0.1s ease both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              height: 1, width: 32,
              background: 'linear-gradient(to right, transparent, var(--accent-primary))',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
              Deployments
            </span>
            <div style={{
              height: 1, width: 32,
              background: 'linear-gradient(to left, transparent, var(--accent-primary))',
            }} />
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>
            Select a Station
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, maxWidth: 500, marginInline: 'auto' }}>
            Choose an active deployment to access its digital twin, component hierarchy, and scenario simulations.
          </p>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <span>Loading stations...</span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '24px',
          }}>
            {stations.map((station, i) => (
              <div key={station.station_id} className="fade-in" style={{ animationDelay: `${i * 0.08}s`, flex: '1 1 320px', maxWidth: '420px', width: '100%' }}>
                <StationCard station={station} />
              </div>
            ))}
            <div className="fade-in" style={{ animationDelay: `${stations.length * 0.08}s`, flex: '1 1 320px', maxWidth: '420px', width: '100%' }}>
              <MockStationCard />
            </div>
          </div>
        )}
      </section>

      {/* ─ Features Section ─ */}
      <section style={{
        padding: '80px 24px',
        background: 'var(--bg-panel-secondary)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ height: 1, width: 32, background: 'linear-gradient(to right, transparent, var(--accent-purple))' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-purple)' }}>
                Capabilities
              </span>
              <div style={{ height: 1, width: 32, background: 'linear-gradient(to left, transparent, var(--accent-purple))' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>
              Platform Capabilities
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 auto', maxWidth: 520 }}>
              Everything you need to monitor, simulate, and optimize remote research infrastructure.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>
            <FeatureCard
              icon={Radio}
              title="Real-time Telemetry"
              desc="Stream live sensor data from physical components directly into the digital twin for instant health monitoring and diagnostics."
              color="var(--accent-primary)"
            />
            <FeatureCard
              icon={MonitorPlay}
              title="Scenario Simulation"
              desc="Design custom timeline events—like extreme weather or power failures—and watch the station components react dynamically."
              color="var(--accent-purple)"
            />
            <FeatureCard
              icon={Zap}
              title="3D Visualization"
              desc="Explore an immersive representation of the station hierarchy, enabling rapid spatial awareness and component localization."
              color="var(--accent-cyan)"
            />
          </div>
        </div>
      </section>

      {/* ─ Footer ─ */}
      <footer style={{
        padding: '28px 32px',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-panel)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          <Snowflake size={15} style={{ color: 'var(--accent-primary)' }} />
          <span>© 2026 PolarTwin. All rights reserved.</span>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          {['About', 'Privacy Policy', 'Terms of Service'].map(label => (
            <a
              key={label}
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                fontSize: 13,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
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
