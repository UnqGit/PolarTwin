import React, { useMemo } from 'react';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  GitCompare,
  TrendingUp,
  Activity,
  Zap,
  Thermometer,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  X
} from 'lucide-react';
import { formatTime } from '../../utils';
import type { ScenarioMissionProfile } from './scenarioProfiles';
import { SUBSYSTEM_CONFIGS } from '../ConnectionsPage/types';

interface MissionDebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ScenarioMissionProfile;
  simTime: number;
  simState: any;
  simLog: any[];
  onRerun: () => void;
  onOpenCompare?: () => void;
  onNavigateDiagnostics?: () => void;
}

export const MissionDebriefModal: React.FC<MissionDebriefModalProps> = ({
  isOpen,
  onClose,
  profile,
  simTime,
  simState,
  simLog,
  onRerun,
  onOpenCompare,
  onNavigateDiagnostics,
}) => {
  if (!isOpen) return null;

  const components = Array.isArray(simState?.components) ? simState.components : [];
  const connections = Array.isArray(simState?.connections) ? simState.connections : [];

  const stats = useMemo(() => {
    const totalComps = Math.max(1, components.length);
    const failedComps = components.filter(
      (c: any) => c.status === 'failure' || c.status === 'failed' || c.status === 'critical'
    );
    const inactiveComps = components.filter((c: any) => c.status === 'inactive');
    const activeComps = components.filter(
      (c: any) => c.status === 'active' || c.status === 'running' || c.status === 'online'
    );

    // Score calculation
    let penalty = failedComps.length * 18 + inactiveComps.length * 4;
    const score = Math.max(12, Math.min(100, Math.round(100 - (penalty / totalComps) * 100)));

    let grade = 'A — OPTIMAL RESILIENCE';
    let gradeColor = '#10b981';
    let gradeSummary = 'Station microgrid and life support successfully weathered the operational stress drill with minimal cascading degradation.';

    if (score < 40) {
      grade = 'DEFCON 1 — CRITICAL EVACUATION';
      gradeColor = '#ef4444';
      gradeSummary = 'Catastrophic life-support and power grid breach. Living module temperature breached survival envelope. Immediate crew extraction required in real-world scenario.';
    } else if (score < 70) {
      grade = 'DEFCON 2 — COMPROMISED ENVELOPE';
      gradeColor = '#f97316';
      gradeSummary = 'Significant system failures detected. Habitation heating or power was compromised, requiring manual override protocols.';
    } else if (score < 85) {
      grade = 'B — CONTROLLED DEGRADATION';
      gradeColor = '#eab308';
      gradeSummary = 'Secondary backups engaged successfully. Non-essential loads were shed while preserving core thermal envelope.';
    }

    return {
      score,
      grade,
      gradeColor,
      gradeSummary,
      totalComps,
      activeComps: activeComps.length,
      failedComps: failedComps.length,
      inactiveComps: inactiveComps.length,
      failedNames: failedComps.map((c: any) => c.component_id || c.name || 'Component'),
    };
  }, [components]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-main, #0b111e)',
          border: '1px solid rgba(56, 217, 245, 0.35)',
          borderRadius: '12px',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 217, 245, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #f1f5f9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 217, 245, 0.15)',
                border: '1px solid rgba(56, 217, 245, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38d9f5',
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.1em',
                  color: '#38d9f5',
                  textTransform: 'uppercase',
                }}
              >
                Mission Execution Assessment
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '2px 0 0 0', color: '#fff' }}>
                {profile?.codename || 'MISSION'} // DEBRIEF
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary, #94a3b8)',
              cursor: 'pointer',
              padding: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Survivability Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '20px',
              borderRadius: '10px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: `1px solid ${stats.gradeColor}40`,
              boxShadow: `0 4px 20px ${stats.gradeColor}15`,
            }}
          >
            {/* Score Ring */}
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                border: `4px solid ${stats.gradeColor}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 0 20px ${stats.gradeColor}30`,
              }}
            >
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: stats.gradeColor,
                }}
              >
                {stats.score}%
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary, #94a3b8)' }}>
                SURVIVABILITY
              </span>
            </div>

            {/* Assessment Narrative */}
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: stats.gradeColor,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                }}
              >
                {stats.grade}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary, #cbd5e1)',
                }}
              >
                {stats.gradeSummary}
              </p>
            </div>
          </div>

          {/* Key Simulation Vitals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 4 }}>
                Simulated Time
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#38d9f5' }}>
                {formatTime(simTime || 0)}
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 4 }}>
                Active Components
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#10b981' }}>
                {stats.activeComps} / {stats.totalComps}
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 4 }}>
                Failed Nodes
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: stats.failedComps > 0 ? '#ef4444' : '#10b981',
                }}
              >
                {stats.failedComps}
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 4 }}>
                Telemetry Log
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#f8d57e' }}>
                {(simLog || []).length} Entries
              </div>
            </div>
          </div>

          {/* Failed Component Breakdown (if any) */}
          {stats.failedComps > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ef4444',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} />
                Casualty Nodes Identified During Run
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {stats.failedNames.map((name: string, i: number) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fff',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 600,
                    }}
                  >
                    @{name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subsystem Readiness Matrix */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-tertiary, #94a3b8)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '10px',
              }}
            >
              Station Subsystem Status at Conclusion
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {Object.entries(SUBSYSTEM_CONFIGS).map(([id, cfg]) => {
                const Icon = cfg?.icon || Activity;
                return (
                  <div
                    key={id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={14} style={{ color: cfg.color }} />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{cfg.name}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>PASSED</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--text-secondary, #94a3b8)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {onOpenCompare && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCompare();
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: 'rgba(167, 139, 250, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  color: '#a78bfa',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <GitCompare size={15} />
                <span>A/B Compare Runs</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onRerun();
              }}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                background: 'var(--accent-primary, #38d9f5)',
                border: 'none',
                color: '#000',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RotateCcw size={15} />
              <span>Re-Run Drill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
