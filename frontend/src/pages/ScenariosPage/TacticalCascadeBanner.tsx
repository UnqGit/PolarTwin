import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Zap,
  Activity,
  ShieldAlert,
  ArrowRight,
  Eye,
  CheckCircle,
  Clock
} from 'lucide-react';
import { formatTime } from '../../utils';

interface TacticalCascadeBannerProps {
  simState: any;
  simTime: number;
  simStatus: string;
  onFocusComponent?: (name: string) => void;
}

export const TacticalCascadeBanner: React.FC<TacticalCascadeBannerProps> = ({
  simState,
  simTime,
  simStatus,
  onFocusComponent,
}) => {
  const isRunning = (simStatus || '').toUpperCase() === 'RUNNING';

  // Analyze active faults or failures
  const activeIncident = useMemo(() => {
    if (!simState) return null;

    const components = Array.isArray(simState.components) ? simState.components : [];
    const failedComponents = components.filter(
      (c: any) => {
        const s = (c?.status || '').toLowerCase();
        return s === 'failure' || s === 'failed' || s === 'critical';
      }
    );

    if (failedComponents.length > 0) {
      const primaryFail = failedComponents[0];
      const rawName = primaryFail.component_id || primaryFail.name || 'Component';
      const name = String(rawName).replace(/^component:/, '').replace(/^@/, '');
      
      let cascadeDesc = 'Degradation ripple propagating through connected downstream bus';
      if (/generator|turbine|power/i.test(name)) {
        cascadeDesc = 'Power generation failure — Secondary reserve battery discharging, HVAC load shedding imminent';
      } else if (/ac|hvac|heat/i.test(name)) {
        cascadeDesc = 'Life support thermal envelope degradation — Living module temperature decreasing';
      } else if (/water|pump|tank/i.test(name)) {
        cascadeDesc = 'Fluid network flow stoppage — Glycol loop freeze risk active';
      }

      return {
        level: 'CRITICAL',
        target: name,
        description: cascadeDesc,
        count: failedComponents.length,
      };
    }

    const activeEvents = Array.isArray(simState.active_events) ? simState.active_events : [];
    if (activeEvents.length > 0) {
      const ev = activeEvents[0];
      // Support both backend EventLayer schema (node_key, event_id, start_time) and DSL schema (selector, event_ref, at)
      const rawTarget = ev.node_key || ev.selector || ev.event_ref || 'Environment';
      const cleanTarget = String(rawTarget).replace(/^component:/, '').replace(/^@/, '');
      const eventName = ev.event_id || ev.event_ref || 'Fault';
      const timeVal = typeof ev.start_time === 'number' ? ev.start_time : typeof ev.at === 'number' ? ev.at : simTime;
      const detail = ev.field_path ? ` (${ev.field_path} \u2192 ${typeof ev.value === 'object' ? JSON.stringify(ev.value) : ev.value})` : '';

      return {
        level: 'INJECTION',
        target: cleanTarget,
        description: `Active scenario event [${eventName}] on @${cleanTarget}${detail} at T=${formatTime(typeof timeVal === 'number' ? timeVal : 0)}`,
        count: activeEvents.length,
      };
    }

    return null;
  }, [simState, simTime]);

  if (!isRunning && !activeIncident) {
    return null;
  }

  if (activeIncident && activeIncident.level === 'CRITICAL') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 18px',
          borderRadius: '999px',
          backgroundColor: 'rgba(239, 68, 68, 0.18)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3), 0 0 12px rgba(239, 68, 68, 0.2)',
          color: '#fff',
          fontSize: '12.5px',
          fontWeight: 500,
          animation: 'slideDown 0.2s ease-out',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 10px #ef4444',
              animation: 'pulse 0.8s infinite',
            }}
          />
          <span style={{ color: '#ef4444', fontWeight: 800, letterSpacing: '0.06em' }}>
            CASCADE INCIDENT [{activeIncident.count}]
          </span>
        </div>

        <div style={{ width: 1, height: 14, backgroundColor: 'rgba(239, 68, 68, 0.4)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#f8d57e', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
            @{activeIncident.target}
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>— {activeIncident.description}</span>
        </div>

        {onFocusComponent && activeIncident.target && (
          <button
            onClick={() => onFocusComponent(String(activeIncident.target || '').replace(/^@/, ''))}
            style={{
              background: 'rgba(239, 68, 68, 0.3)',
              border: '1px solid rgba(239, 68, 68, 0.6)',
              color: '#fff',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '4px',
            }}
            title="Focus Component in 3D View"
          >
            <Eye size={12} />
            <span>Focus</span>
          </button>
        )}
      </div>
    );
  }

  if (activeIncident && activeIncident.level === 'INJECTION') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 16px',
          borderRadius: '999px',
          backgroundColor: 'rgba(249, 115, 22, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(249, 115, 22, 0.4)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          color: '#fff',
          fontSize: '12px',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: '#f97316',
            boxShadow: '0 0 8px #f97316',
          }}
        />
        <span style={{ color: '#f97316', fontWeight: 700, letterSpacing: '0.05em' }}>EVENT INJECTION:</span>
        <span style={{ color: 'var(--text-primary, #f1f5f9)' }}>{activeIncident.description}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '5px 14px',
        borderRadius: '999px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(56, 217, 245, 0.2)',
        color: 'var(--text-secondary, #94a3b8)',
        fontSize: '11.5px',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: '#10b981',
          boxShadow: '0 0 6px #10b981',
        }}
      />
      <span style={{ color: '#38d9f5', fontWeight: 600 }}>STATION NOMINAL</span>
      <span>//</span>
      <span>DETERMINISTIC SIMULATION ACTIVE (20 Hz)</span>
    </div>
  );
};
