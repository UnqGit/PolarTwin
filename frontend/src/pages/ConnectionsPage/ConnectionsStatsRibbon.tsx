import React from 'react';
import {
  Network, Zap, Radio, Droplets, Activity,
  Layers, GitFork, Grid3X3, Search, X, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { normalizeMedium, MEDIUM_CONFIGS } from './types';
import type { ViewMode } from './types';
import type { ConnectionLayout } from '../../lib/layout';

interface ConnectionsStatsRibbonProps {
  connections: ConnectionLayout[];
  activeView: ViewMode;
  onChangeView: (mode: ViewMode) => void;
  selectedMedium: string;
  onSelectMedium: (med: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLight: boolean;
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
}

export const ConnectionsStatsRibbon: React.FC<ConnectionsStatsRibbonProps> = ({
  connections,
  activeView,
  onChangeView,
  selectedMedium,
  onSelectMedium,
  searchQuery,
  onSearchChange,
  isLight,
  liveStateRef
}) => {
  // Compute counts
  const totalCount = connections.length;

  const mediumCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: totalCount,
      power: 0,
      data: 0,
      fluid: 0,
      signal: 0,
    };
    connections.forEach(c => {
      const m = normalizeMedium(c.connectionType);
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }, [connections, totalCount]);

  // Compute live active / degraded links
  const { activeCount, degradedCount, totalWatts } = React.useMemo(() => {
    let act = 0;
    let deg = 0;
    let watts = 0;
    const live = liveStateRef?.current || {};

    connections.forEach(c => {
      const state = (live as any)[c.id];
      if (state && (state.status === 'fault' || state.status === 'failure' || state.status === 'offline')) {
        deg++;
      } else {
        act++;
      }
    });

    // Check component wattages for power summary
    Object.values(live).forEach((val: any) => {
      if (val && typeof val.power_w === 'number') {
        watts += val.power_w;
      }
    });

    return { activeCount: act, degradedCount: deg, totalWatts: watts };
  }, [connections, liveStateRef]);

  const formatKw = (w: any) => {
    const num = typeof w === 'number' && !isNaN(w) ? w : (Number(w) || 0);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)} MW`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)} kW`;
    return `${num.toFixed(0)} W`;
  };

  return (
    <div
      style={{
        background: isLight ? '#ffffff' : 'rgba(12, 16, 27, 0.94)',
        borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)',
        padding: '10px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : '0 4px 16px rgba(0,0,0,0.3)',
        zIndex: 20,
        position: 'relative',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Left: View Mode Switcher & Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Perspectives Switcher */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: 2,
            background: isLight ? '#f1f5f9' : 'rgba(0, 0, 0, 0.4)',
            borderRadius: 'var(--radius-md)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => onChangeView('schematic')}
            title="Interactive Component Schematic Wiring Diagram"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'schematic' ? 'var(--accent-primary)' : 'transparent',
              color: activeView === 'schematic' ? '#030A0F' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            <GitFork size={14} />
            <span>Schematic Topology</span>
          </button>

          <button
            onClick={() => onChangeView('bus_architecture')}
            title="Subsystem Macro Bus Interconnect Architecture"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'bus_architecture' ? 'var(--accent-primary)' : 'transparent',
              color: activeView === 'bus_architecture' ? '#030A0F' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={14} />
            <span>Subsystem Bus Architecture</span>
          </button>

          <button
            onClick={() => onChangeView('matrix')}
            title="Cross-System Coupling & Dependency Matrix"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'matrix' ? 'var(--accent-primary)' : 'transparent',
              color: activeView === 'matrix' ? '#030A0F' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            <Grid3X3 size={14} />
            <span>Dependency Matrix</span>
          </button>
        </div>

        {/* Medium Layer Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectMedium('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              fontWeight: selectedMedium === 'all' ? 700 : 500,
              border: selectedMedium === 'all'
                ? '1px solid var(--accent-primary)'
                : isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
              background: selectedMedium === 'all'
                ? 'rgba(80, 219, 192, 0.16)'
                : isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              color: selectedMedium === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Network size={12} />
            <span>All Networks ({totalCount})</span>
          </button>

          {/* Power */}
          <button
            onClick={() => onSelectMedium(selectedMedium === 'power' ? 'all' : 'power')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              fontWeight: selectedMedium === 'power' ? 700 : 500,
              border: selectedMedium === 'power'
                ? `1px solid ${MEDIUM_CONFIGS.power.color}`
                : isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
              background: selectedMedium === 'power'
                ? 'rgba(248, 213, 126, 0.18)'
                : isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              color: selectedMedium === 'power' ? (isLight ? MEDIUM_CONFIGS.power.lightColor : MEDIUM_CONFIGS.power.color) : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Zap size={12} color={MEDIUM_CONFIGS.power.color} />
            <span>Power Grid ({mediumCounts.power || 0})</span>
          </button>

          {/* Data */}
          <button
            onClick={() => onSelectMedium(selectedMedium === 'data' ? 'all' : 'data')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              fontWeight: selectedMedium === 'data' ? 700 : 500,
              border: selectedMedium === 'data'
                ? `1px solid ${MEDIUM_CONFIGS.data.color}`
                : isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
              background: selectedMedium === 'data'
                ? 'rgba(167, 139, 250, 0.18)'
                : isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              color: selectedMedium === 'data' ? (isLight ? MEDIUM_CONFIGS.data.lightColor : MEDIUM_CONFIGS.data.color) : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Radio size={12} color={MEDIUM_CONFIGS.data.color} />
            <span>SCADA & Comms ({mediumCounts.data || 0})</span>
          </button>

          {/* Fluid */}
          <button
            onClick={() => onSelectMedium(selectedMedium === 'fluid' ? 'all' : 'fluid')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              fontWeight: selectedMedium === 'fluid' ? 700 : 500,
              border: selectedMedium === 'fluid'
                ? `1px solid ${MEDIUM_CONFIGS.fluid.color}`
                : isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
              background: selectedMedium === 'fluid'
                ? 'rgba(56, 217, 245, 0.18)'
                : isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              color: selectedMedium === 'fluid' ? (isLight ? MEDIUM_CONFIGS.fluid.lightColor : MEDIUM_CONFIGS.fluid.color) : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Droplets size={12} color={MEDIUM_CONFIGS.fluid.color} />
            <span>Hydronics & Fluid ({mediumCounts.fluid || 0})</span>
          </button>

          {/* Signal */}
          <button
            onClick={() => onSelectMedium(selectedMedium === 'signal' ? 'all' : 'signal')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              fontWeight: selectedMedium === 'signal' ? 700 : 500,
              border: selectedMedium === 'signal'
                ? `1px solid ${MEDIUM_CONFIGS.signal.color}`
                : isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
              background: selectedMedium === 'signal'
                ? 'rgba(80, 219, 192, 0.18)'
                : isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              color: selectedMedium === 'signal' ? (isLight ? MEDIUM_CONFIGS.signal.lightColor : MEDIUM_CONFIGS.signal.color) : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Activity size={12} color={MEDIUM_CONFIGS.signal.color} />
            <span>Signals & Sensors ({mediumCounts.signal || 0})</span>
          </button>
        </div>
      </div>

      {/* Right: Telemetry KPI Badges & Quick Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Real-time Health Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '4px 12px',
            borderRadius: 'var(--radius-md)',
            background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.3)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 6px rgba(74, 222, 128, 0.8)'
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
            <span style={{ fontWeight: 700, color: '#4ade80' }}>
              {degradedCount > 0 ? `${activeCount}/${totalCount} NOMINAL` : '100% ONLINE'}
            </span>
          </div>

          {totalWatts > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={11} color="#f8d57e" />
              <span style={{ color: 'var(--text-secondary)' }}>Grid Load:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatKw(totalWatts)}
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            minWidth: 180,
            maxWidth: 240,
          }}
        >
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 9,
              color: 'var(--text-tertiary)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search circuits, nodes..."
            style={{
              width: '100%',
              padding: '5px 28px 5px 28px',
              fontSize: 12,
              background: isLight ? '#f1f5f9' : 'rgba(0, 0, 0, 0.35)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: 6,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 2
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
