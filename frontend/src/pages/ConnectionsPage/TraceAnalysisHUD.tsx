import React from 'react';
import {
  GitFork, ArrowUpRight, ArrowDownRight, AlertTriangle, X, Check,
  Activity, ShieldAlert, Cpu, Zap, Radio
} from 'lucide-react';
import type { TraceMode, TraceResult } from './types';

interface TraceAnalysisHUDProps {
  selectedName: string | null;
  traceResult: TraceResult | null;
  onStartTrace: (mode: 'upstream' | 'downstream' | 'blast_radius') => void;
  onClearTrace: () => void;
  isLight: boolean;
  onSelectNode?: (name: string) => void;
}

export const TraceAnalysisHUD: React.FC<TraceAnalysisHUDProps> = ({
  selectedName,
  traceResult,
  onStartTrace,
  onClearTrace,
  isLight,
  onSelectNode
}) => {
  if (!selectedName && !traceResult) return null;

  const isTracing = !!traceResult;
  const isBlastRadius = traceResult?.mode === 'blast_radius';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        borderRadius: 'var(--radius-xl)',
        background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 21, 37, 0.92)',
        border: isBlastRadius
          ? '1px solid rgba(248, 113, 113, 0.6)'
          : isTracing
          ? '1px solid rgba(80, 219, 192, 0.5)'
          : isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
        boxShadow: isBlastRadius
          ? '0 8px 32px rgba(248, 113, 113, 0.25)'
          : '0 8px 32px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '90vw',
        flexWrap: 'wrap'
      }}
    >
      {/* Node Identity Chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: isBlastRadius
              ? 'rgba(248, 113, 113, 0.2)'
              : 'rgba(80, 219, 192, 0.15)',
            color: isBlastRadius ? '#f87171' : 'var(--accent-primary)',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          {isBlastRadius ? <ShieldAlert size={14} /> : <GitFork size={14} />}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', fontWeight: 600 }}>
            {isBlastRadius ? 'Outage Simulation' : isTracing ? `Circuit Trace (${traceResult?.mode})` : 'Circuit Analysis'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedName || traceResult?.targetId}
          </span>
        </div>
      </div>

      <div style={{ width: 1, height: 26, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }} />

      {/* Tracing Controls / Outcome */}
      {!isTracing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onStartTrace('upstream')}
            title="Trace power, fluid, and signal inputs feeding into this node"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <ArrowUpRight size={14} color="#f8d57e" />
            <span>Trace Upstream Feeds</span>
          </button>

          <button
            onClick={() => onStartTrace('downstream')}
            title="Trace all downstream nodes and equipment dependent on this unit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <ArrowDownRight size={14} color="#38d9f5" />
            <span>Trace Downstream Load</span>
          </button>

          <button
            onClick={() => onStartTrace('blast_radius')}
            title="Simulate outage: calculate what goes offline if this node or line is lost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(248, 113, 113, 0.4)',
              background: 'rgba(248, 113, 113, 0.12)',
              color: '#f87171',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertTriangle size={14} />
            <span>Simulate Blast Radius</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Summary badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Connected Elements:</span>
            <span
              style={{
                fontWeight: 700,
                color: isBlastRadius ? '#f87171' : 'var(--accent-primary)',
                background: isBlastRadius ? 'rgba(248, 113, 113, 0.18)' : 'rgba(80, 219, 192, 0.15)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              {traceResult.nodeIds.size} nodes · {traceResult.edgeIds.size} lines
            </span>
          </div>

          {isBlastRadius && (
            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} />
              Cascade Outage Warning
            </span>
          )}

          {/* Reset / Clear Button */}
          <button
            onClick={onClearTrace}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
              background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={13} />
            <span>Clear Trace</span>
          </button>
        </div>
      )}
    </div>
  );
};
