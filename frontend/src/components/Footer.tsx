import React, { useState, useEffect } from 'react';
import { Snowflake, ShieldCheck, FileCode, Globe, X } from 'lucide-react';
import { useTheme } from './ThemeContext';

export type FooterTab = 'about' | 'privacy' | 'terms';

export interface FooterProps {
  variant?: 'landing' | 'app';
  style?: React.CSSProperties;
}

export function FooterModal({
  activeTab,
  onClose,
  onChangeTab,
  isLight,
}: {
  activeTab: FooterTab;
  onClose: () => void;
  onChangeTab: (tab: FooterTab) => void;
  isLight: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(3, 7, 18, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.2s ease forwards',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: isLight ? '#ffffff' : '#0d131f',
          border: isLight ? '1px solid rgba(2, 132, 199, 0.2)' : '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: isLight
            ? '0 25px 50px -12px rgba(2, 132, 199, 0.15), 0 10px 25px rgba(0, 0, 0, 0.1)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(80, 219, 192, 0.12)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '22px 28px 18px',
          borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(80, 219, 192, 0.12)',
              border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(80, 219, 192, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}>
              {activeTab === 'about' && <Snowflake size={20} />}
              {activeTab === 'privacy' && <ShieldCheck size={20} />}
              {activeTab === 'terms' && <FileCode size={20} />}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent-primary)' }}>
                PolarTwin Operational Suite
              </div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                {activeTab === 'about' && 'About PolarTwin Platform'}
                {activeTab === 'privacy' && 'Tactical Privacy & Security Standard'}
                {activeTab === 'terms' && 'Operational Simulation Terms'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-icon card-hover"
            style={{
              padding: 8,
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '12px 28px',
          background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.2)',
          borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)',
        }}>
          {[
            { id: 'about', label: 'About Platform' },
            { id: 'privacy', label: 'Privacy & Security' },
            { id: 'terms', label: 'Terms of Operations' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id as FooterTab)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                fontSize: 12.5,
                fontWeight: 750,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
                background: activeTab === tab.id
                  ? 'var(--accent-primary)'
                  : 'transparent',
                color: activeTab === tab.id
                  ? (isLight ? '#ffffff' : '#030a0f')
                  : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div
          className="dsl-code-container"
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            maxHeight: 'calc(85vh - 160px)',
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-primary)' }}>
                  1. Mission & Scientific Context
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  PolarTwin is a state-of-the-art Digital Twin simulation and contingency drilling platform developed for the <strong>National Centre for Polar and Ocean Research (NCPOR)</strong> under the <strong>Indian Antarctic Programme</strong>. It models India’s polar research facilities—specifically <strong>Maitri Station</strong> (Schirmacher Oasis, 70°46′S, 11°44′E) and next-generation facility modernizations.
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  2. Extreme Environmental Challenge
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  During 8 months of winter polar night isolation, stations endure ambient temperatures as low as -60°C and katabatic blizzards exceeding 180 km/h with zero supply line resupply. Station life-support systems (cogeneration heating, diesel generation, waste water recovery, and satellite uplinks) must maintain uninterrupted 24/7 equilibrium to preserve expeditionary crew lives.
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-purple)' }}>
                  3. Multi-Physics Deterministic Solver
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  PolarTwin models physical stations across four coupled mathematical domains:
                </p>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li><strong>Power Distribution:</strong> 3-Phase 415V AC microgrid with automated generator synchronization, busbar load-shedding, and inverter battery banks.</li>
                  <li><strong>Thermal Envelopes:</strong> Multi-layer aerogel insulation conduction, engine exhaust heat exchanger cogeneration, and glycol radiator loops.</li>
                  <li><strong>Fluid Dynamics:</strong> High-pour-point Arctic diesel logistics, meltwater harvesting from glacial lakes, and greywater filtration.</li>
                  <li><strong>Domain-Specific Language (DSL):</strong> Declarative Python-compiled event language with deterministic tick-based execution and reversible LIFO stack unwinding.</li>
                </ul>
              </div>

              <div style={{
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)',
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <Globe size={22} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Engineered for air-gapped station LAN deployment, local deterministic execution, and zero-telemetry operational security.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-primary)' }}>
                  1. Air-Gapped Sovereign Computing
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  PolarTwin adheres strictly to defense-grade Operational Technology (OT) air-gap guidelines. The digital twin runtime, compiler, and SCADA telemetry ingest pipeline execute entirely on local compute nodes without transmitting station blueprints, component metrics, or telemetry logs to external third-party cloud servers.
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  2. Zero User PII Tracking
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  The application does not embed cookies, analytics beacons, marketing scripts, or third-party behavioral profiling trackers. Station operator session states and scenario drill configurations remain entirely ephemeral within the station’s secure local environment.
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-purple)' }}>
                  3. Scientific Data Integrity
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  All generated telemetry histories, stress drill results, and simulated cascade failure logs are saved into local, audit-verified SQLite databases. Checksums verify that physical station parameter baselines cannot be tampered with or modified without operator authorization.
                </p>
              </div>

              <div style={{
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                background: isLight ? 'rgba(74, 222, 128, 0.08)' : 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <ShieldCheck size={22} style={{ color: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: isLight ? '#15803d' : '#86efac', fontWeight: 600 }}>
                  Fully compliant with Antarctic Treaty data protection protocols and national polar research sovereignty standards.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-primary)' }}>
                  1. Scope of Simulation Use
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  PolarTwin is an engineering simulator and virtual commissioning workbench intended for research facility planning, contingency procedure verification, operator drill training, and component life-cycle prediction.
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  2. Virtual Fault Injection & Non-Destructive Protocols
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  Drill injections—including katabatic blizzard wind loads, generator busbar trips, glycol coolant pipe freezeups, and fuel starvation—are non-destructive digital calculations. While the solver models realistic cascading failures, automated recovery suggestions must be reconciled with physical on-site station operating procedures (SOPs).
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 800, color: 'var(--accent-purple)' }}>
                  3. Academic & Research Licensing
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  PolarTwin’s core architecture, 3D interactive models, station topologies, and DSL compiler are licensed for polar research station management, academic study, and innovation in extreme-environment digital twin technologies.
                </p>
              </div>

              <div style={{
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)',
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <FileCode size={22} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Deterministic LIFO stack unwinding guarantees that simulation branches can always be rolled back without corrupting station baseline manifests.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
            POLARTWIN · v2.4.0 · NCPOR SPEC
          </span>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-full)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function Footer({ variant = 'app', style }: FooterProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [modalTab, setModalTab] = useState<FooterTab | null>(null);

  const isLanding = variant === 'landing';

  return (
    <>
      <footer
        style={{
          padding: isLanding ? '32px 40px' : '18px 32px',
          borderTop: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)',
          background: isLight
            ? (isLanding ? '#F8FAFC' : '#ffffff')
            : (isLanding ? 'var(--bg-panel)' : 'rgba(12, 16, 27, 0.95)'),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          flexShrink: 0,
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontSize: isLanding ? '14px' : '12.5px',
            fontWeight: 600,
          }}>
            <div style={{
              width: isLanding ? 28 : 24,
              height: isLanding ? 28 : 24,
              borderRadius: 7,
              background: 'var(--accent-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              flexShrink: 0,
            }}>
              <Snowflake size={isLanding ? 16 : 14} strokeWidth={2.5} />
            </div>
            <span>© 2026 PolarTwin. All rights reserved.</span>
          </div>

          {!isLanding && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(80, 219, 192, 0.1)',
              color: 'var(--accent-primary)',
              border: isLight ? '1px solid rgba(2, 132, 199, 0.2)' : '1px solid rgba(80, 219, 192, 0.25)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              <span>Air-Gapped SCADA Node</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: isLanding ? '24px' : '20px', alignItems: 'center' }}>
          {[
            { id: 'about', label: 'About' },
            { id: 'privacy', label: 'Privacy Policy' },
            { id: 'terms', label: 'Terms of Service' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setModalTab(id as FooterTab)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: isLanding ? 14 : 12.5,
                fontWeight: 500,
                transition: 'color 0.2s ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              {label}
            </button>
          ))}
        </div>
      </footer>

      {/* Interactive Modal */}
      {modalTab && (
        <FooterModal
          activeTab={modalTab}
          onClose={() => setModalTab(null)}
          onChangeTab={(tab) => setModalTab(tab)}
          isLight={isLight}
        />
      )}
    </>
  );
}
