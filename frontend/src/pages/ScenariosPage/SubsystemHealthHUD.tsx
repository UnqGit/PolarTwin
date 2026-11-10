import React, { useMemo, useState, useRef } from 'react';
import {
  Zap,
  Thermometer,
  Radio,
  Droplets,
  Activity,
  AlertOctagon,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  RotateCcw
} from 'lucide-react';
import { SUBSYSTEM_CONFIGS } from '../ConnectionsPage/types';

interface SubsystemHealthHUDProps {
  simState: any;
  onSelectComponent?: (name: string) => void;
  selectedComponent?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  initialPosition?: { x: number; y: number };
}

export interface SubsystemStatus {
  id: string;
  name: string;
  title: string;
  icon: any;
  color: string;
  totalComponents: number;
  activeCount: number;
  failedCount: number;
  inactiveCount: number;
  healthPercent: number;
  status: 'nominal' | 'degraded' | 'critical';
}

export const SubsystemHealthHUD: React.FC<SubsystemHealthHUDProps> = ({
  simState,
  onSelectComponent,
  selectedComponent,
  collapsed = false,
  onToggleCollapse,
  initialPosition = { x: 20, y: 14 },
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (typeof (e.currentTarget as any)?.setPointerCapture === 'function') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Keep HUD strictly below navbar (y >= 10) and bounded within visible viewport
    const nextX = Math.max(10, Math.min(window.innerWidth - 290, dragRef.current.posX + dx));
    const nextY = Math.max(10, Math.min(window.innerHeight - 120, dragRef.current.posY + dy));
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      setIsDragging(false);
      if (typeof (e.currentTarget as any)?.releasePointerCapture === 'function') {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    }
  };

  const subsystemStatuses = useMemo(() => {
    const components = Array.isArray(simState?.components) ? simState.components : [];
    
    // Group components by subsystem block prefix or name
    const blocks: Record<string, { total: number; active: number; failed: number; inactive: number }> = {
      EnergyBlock: { total: 0, active: 0, failed: 0, inactive: 0 },
      HVACBlock: { total: 0, active: 0, failed: 0, inactive: 0 },
      ControlBlock: { total: 0, active: 0, failed: 0, inactive: 0 },
      WaterAndWasteBlock: { total: 0, active: 0, failed: 0, inactive: 0 },
      ResearchBlock: { total: 0, active: 0, failed: 0, inactive: 0 },
    };

    components.forEach((c: any) => {
      const name = String(c?.component_id || c?.name || '');
      let targetBlock = 'ControlBlock';

      if (/Energy|Generator|Turbine|Battery|Power|Solar|Wind|Electrical|Bus/i.test(name)) {
        targetBlock = 'EnergyBlock';
      } else if (/HVAC|AC|Heater|Vent|Thermal|Cooling|Climate|Exchanger/i.test(name)) {
        targetBlock = 'HVACBlock';
      } else if (/Water|Waste|Pump|Fluid|Tank|Melt|Greywater|Potable/i.test(name)) {
        targetBlock = 'WaterAndWasteBlock';
      } else if (/Research|Science|Lab|Spectro|Radar|Payload|Aurora/i.test(name)) {
        targetBlock = 'ResearchBlock';
      } else {
        targetBlock = 'ControlBlock';
      }

      if (blocks[targetBlock]) {
        blocks[targetBlock].total++;
        const s = (c?.status || '').toLowerCase();
        if (s === 'active' || s === 'running' || s === 'online') {
          blocks[targetBlock].active++;
        } else if (s === 'failure' || s === 'failed' || s === 'critical' || s === 'error') {
          blocks[targetBlock].failed++;
        } else {
          blocks[targetBlock].inactive++;
        }
      }
    });

    const result: SubsystemStatus[] = Object.entries(SUBSYSTEM_CONFIGS).map(([id, cfg]) => {
      const stats = blocks[id] || { total: 0, active: 0, failed: 0, inactive: 0 };
      const total = Math.max(1, stats.total);
      const healthPercent = stats.failed > 0 
        ? Math.max(15, Math.round(((stats.active) / total) * 100))
        : stats.inactive > 0 
        ? Math.max(60, Math.round(((stats.active) / total) * 100))
        : 100;

      let status: 'nominal' | 'degraded' | 'critical' = 'nominal';
      if (stats.failed > 0) status = 'critical';
      else if (stats.inactive > 0 || healthPercent < 90) status = 'degraded';

      return {
        id,
        name: cfg.name || id,
        title: cfg.title || cfg.name || id,
        icon: cfg.icon || Activity,
        color: cfg.color || '#38d9f5',
        totalComponents: stats.total,
        activeCount: stats.active,
        failedCount: stats.failed,
        inactiveCount: stats.inactive,
        healthPercent,
        status,
      };
    });

    return result;
  }, [simState]);

  const overallScore = useMemo(() => {
    if (subsystemStatuses.length === 0) return 100;
    const sum = subsystemStatuses.reduce((acc, s) => acc + s.healthPercent, 0);
    return Math.round(sum / subsystemStatuses.length);
  }, [subsystemStatuses]);

  return (
    <div
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 35,
        backgroundColor: 'rgba(11, 17, 30, 0.88)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(56, 217, 245, 0.28)',
        borderRadius: '10px',
        padding: '10px 12px',
        width: '270px',
        boxShadow: isDragging
          ? '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 217, 245, 0.25)'
          : '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 217, 245, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        userSelect: 'none',
        pointerEvents: 'auto',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      {/* Movable Drag Grip Bar */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(56, 217, 245, 0.12)',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        title="Click & drag anywhere below the navbar to reposition Command HUD"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GripHorizontal size={13} style={{ color: 'var(--text-tertiary, #94a3b8)', opacity: 0.8 }} />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-tertiary, #94a3b8)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            COMMAND HUD
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPosition({ x: 20, y: 14 });
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary, #94a3b8)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Reset HUD Position (Snap to Top-Left)"
          >
            <RotateCcw size={11} />
          </button>
          {onToggleCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary, #94a3b8)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title={collapsed ? 'Expand Subsystems' : 'Collapse Subsystems'}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Integrity Status Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '6px',
              backgroundColor: overallScore > 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${overallScore > 80 ? '#10b981' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: overallScore > 80 ? '#10b981' : '#ef4444',
            }}
          >
            {overallScore > 80 ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          </div>
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary, #94a3b8)',
                textTransform: 'uppercase',
              }}
            >
              Subsystem Integrity
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: overallScore > 80 ? '#10b981' : overallScore > 50 ? '#f97316' : '#ef4444',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {overallScore}% OPERATIONAL
            </div>
          </div>
        </div>
      </div>

      {/* Subsystem Breakdown List */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
          {subsystemStatuses.map((sub) => {
            const Icon = sub.icon || Activity;
            const isAlert = sub.status === 'critical';
            const isDegraded = sub.status === 'degraded';
            const titleClean = sub.title ? sub.title.split('&')[0].trim() : (sub.name || sub.id);

            return (
              <div
                key={sub.id}
                onClick={() => onSelectComponent && onSelectComponent(sub.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  backgroundColor: isAlert
                    ? 'rgba(239, 68, 68, 0.12)'
                    : isDegraded
                    ? 'rgba(249, 115, 22, 0.08)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${
                    isAlert
                      ? 'rgba(239, 68, 68, 0.35)'
                      : isDegraded
                      ? 'rgba(249, 115, 22, 0.25)'
                      : 'rgba(255, 255, 255, 0.06)'
                  }`,
                  cursor: onSelectComponent ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Icon size={14} style={{ color: sub.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-primary, #f1f5f9)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {titleClean}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {isAlert ? (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          animation: 'pulse 1s infinite',
                        }}
                      />
                      FAIL
                    </span>
                  ) : isDegraded ? (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.15)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      DEGRADED
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      NOMINAL
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-secondary, #94a3b8)',
                    }}
                  >
                    {sub.healthPercent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
