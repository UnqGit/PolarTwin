import React from 'react';
import {
  ShieldAlert,
  Flame,
  Wind,
  Radio,
  Clock,
  Compass,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  X,
  Layers,
  ThermometerSnowflake,
  Activity
} from 'lucide-react';
import type { ScenarioMissionProfile } from './scenarioProfiles';
import { SUBSYSTEM_CONFIGS } from '../ConnectionsPage/types';

interface MissionBriefingModalProps {
  profile: ScenarioMissionProfile;
  isOpen: boolean;
  onClose: () => void;
  onLaunchDrill: () => void;
  stationName?: string;
  isSimRunning?: boolean;
}

export const MissionBriefingModal: React.FC<MissionBriefingModalProps> = ({
  profile,
  isOpen,
  onClose,
  onLaunchDrill,
  stationName = 'Maitri Base',
  isSimRunning = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
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
          maxWidth: '780px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-main, #0b111e)',
          border: '1px solid rgba(56, 217, 245, 0.3)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 217, 245, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #f1f5f9)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Tactical Status Bar */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                backgroundColor: profile.threat.badgeBg,
                border: `1px solid ${profile.threat.borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: profile.threat.badgeColor,
                boxShadow: profile.threat.glow,
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.12em',
                  color: 'var(--accent-primary, #38d9f5)',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{stationName} OUTPOST // 70°45'57"S 11°44'09"E</span>
              </div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: '2px 0 0 0',
                  letterSpacing: '0.04em',
                  color: '#fff',
                }}
              >
                {profile.codename}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Threat Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '999px',
                backgroundColor: profile.threat.badgeBg,
                border: `1px solid ${profile.threat.borderColor}`,
                color: profile.threat.badgeColor,
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                boxShadow: profile.threat.glow,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: profile.threat.badgeColor,
                  boxShadow: `0 0 8px ${profile.threat.badgeColor}`,
                  animation: 'pulse 1.8s infinite',
                }}
              />
              {profile.threat.level}
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary, #94a3b8)',
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
                transition: 'color 0.15s ease',
              }}
              title="Close Briefing"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Summary / Scenario Narrative */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: 'var(--text-secondary, #cbd5e1)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary, #94a3b8)',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Mission Intelligence Brief
            </div>
            {profile.summary}
          </div>

          {/* Subsystems at Risk + Ambient Weather Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* Subsystems at Risk */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-tertiary, #94a3b8)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Layers size={13} style={{ color: 'var(--accent-primary, #38d9f5)' }} />
                Subsystems In Jeopardy
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {profile.subsystemsAtRisk.map((subId) => {
                  const cfg = SUBSYSTEM_CONFIGS[subId];
                  return (
                    <div
                      key={subId}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: cfg ? cfg.bgDark : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${cfg ? cfg.borderDark : 'rgba(255,255,255,0.15)'}`,
                        color: cfg ? cfg.color : '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {cfg && <cfg.icon size={13} />}
                      <span>{cfg ? cfg.title : subId}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Polar Environmental Conditions */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-tertiary, #94a3b8)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ThermometerSnowflake size={13} style={{ color: '#38d9f5' }} />
                Polar Atmospheric Envelope
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-tertiary, #94a3b8)' }}>Ambient Temp:</span>{' '}
                  <span style={{ fontWeight: 600, color: '#38d9f5' }}>{profile.ambientEnvelope.temperature}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary, #94a3b8)' }}>Wind Gale:</span>{' '}
                  <span style={{ fontWeight: 600, color: '#f8d57e' }}>{profile.ambientEnvelope.windSpeed}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary, #94a3b8)' }}>Visibility:</span>{' '}
                  <span style={{ fontWeight: 600 }}>{profile.ambientEnvelope.visibility}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary, #94a3b8)' }}>Satellite:</span>{' '}
                  <span style={{ fontWeight: 600, color: profile.ambientEnvelope.satelliteLink.includes('OFFLINE') ? '#ef4444' : '#10b981' }}>
                    {profile.ambientEnvelope.satelliteLink}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mission Directives / Objectives */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-tertiary, #94a3b8)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Compass size={13} style={{ color: '#50dbc0' }} />
              Primary Mission Objectives & Pass Criteria
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profile.missionDirectives.map((dir, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    color: 'var(--text-primary, #f1f5f9)',
                  }}
                >
                  <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                  <span>{dir}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Countermeasures */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-tertiary, #94a3b8)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Activity size={13} style={{ color: '#f97316' }} />
              Recommended Operator Directives
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {profile.recommendedCountermeasures.map((cm, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary, #cbd5e1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                  }}
                >
                  <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#f97316' }} />
                  <span>{cm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
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
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} />
            <span>Deterministic Tick Resolution: 20 Hz (High Fidelity)</span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Review Code First
            </button>
            <button
              onClick={() => {
                onClose();
                onLaunchDrill();
              }}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
              }}
            >
              <PlayCircle size={16} />
              <span>{isSimRunning ? 'View Active Simulation' : 'Execute Mission Drill'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
