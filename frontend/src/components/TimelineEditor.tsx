import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { formatTime } from '../utils';

export interface SceneEventData {
  event_ref: string;
  selector: string;
  at: number;
  duration: number;
  payload: any;
  source_location?: number;
  source_order?: number;
}

interface TimelineEditorProps {
  events: SceneEventData[];
  simTime: number;
  onSelectEvent: (event: SceneEventData | null) => void;
  selectedEvent: SceneEventData | null;
  onAppendEvent?: (eventRef: string, at: number) => void;
  onUpdateEventLocation?: (event: SceneEventData, newAt: number, newDuration: number | null) => void;
  onDeleteEvent?: (event: SceneEventData) => void;
  onSeek?: (time: number) => void;
}

const AURORA_COLORS = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

export const TimelineEditor: React.FC<TimelineEditorProps> = ({ events, simTime, onSelectEvent, selectedEvent, onAppendEvent, onUpdateEventLocation, onDeleteEvent, onSeek }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [containerWidth, setContainerWidth] = useState(800);

  const PIXELS_PER_UNIT = 40; // 40px per simulation hour
  const SIDEBAR_WIDTH = 150;
  const ROW_HEIGHT = 32;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const maxTime = Math.max(
    simTime + 5,
    events.reduce((max, e) => {
      const isInf = e.duration === Infinity || e.duration === null || e.duration === undefined;
      const dur = isInf ? 5 : Number(e.duration);
      return Math.max(max, e.at + dur);
    }, 10)
  );

  const width = Math.max(containerWidth, maxTime * PIXELS_PER_UNIT);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.getData('application/x-event-def') !== 'true') return;
    const eventRef = e.dataTransfer.getData('text/plain');
    if (eventRef && onAppendEvent && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - SIDEBAR_WIDTH + containerRef.current.scrollLeft;
      const at = Math.max(0, x / PIXELS_PER_UNIT);
      onAppendEvent(eventRef, parseFloat(at.toFixed(1)));
    }
  };

  const [dragState, setDragState] = useState<{ event: SceneEventData, type: 'move' | 'resize', initialX: number, initialAt: number, initialDur: number | null, currentAt: number, currentDur: number | null } | null>(null);

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: PointerEvent) => {
      const dx = (e.clientX - dragState.initialX) / PIXELS_PER_UNIT;
      if (dragState.type === 'move') {
        const newAt = Math.max(0, dragState.initialAt + dx);
        setDragState(prev => prev ? { ...prev, currentAt: parseFloat(newAt.toFixed(1)) } : null);
      } else if (dragState.type === 'resize') {
        const newDur = Math.max(0.1, (dragState.initialDur || 5) + dx);
        setDragState(prev => prev ? { ...prev, currentDur: parseFloat(newDur.toFixed(1)) } : null);
      }
    };
    const handleUp = () => {
      if (dragState && onUpdateEventLocation) {
        if (dragState.currentAt !== dragState.initialAt || dragState.currentDur !== dragState.initialDur) {
          onUpdateEventLocation(dragState.event, dragState.currentAt, dragState.currentDur);
        }
      }
      setDragState(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState, onUpdateEventLocation]);

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'row', backgroundColor: 'var(--bg-main)', overflow: 'hidden' }}
    >
      {/* Sidebar for layers */}
      <div style={{ width: SIDEBAR_WIDTH, flexShrink: 0, borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel-secondary)', zIndex: 20, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 30, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 'bold' }}>
          TIMELINE
        </div>
        <div style={{ flex: 1, overflowY: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
            <div style={{ marginTop: containerRef.current ? -containerRef.current.scrollTop : 0 }}>
              {events.map((ev, i) => (
                <div key={i} style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', backgroundColor: selectedEvent === ev ? 'var(--bg-input)' : 'transparent' }}>
                  {ev.event_ref}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline track container with top scrollbar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top dummy scrollbar */}
        <div
          ref={topScrollRef}
          onScroll={(e) => {
            if (containerRef.current && Math.abs(containerRef.current.scrollLeft - e.currentTarget.scrollLeft) > 1) {
              containerRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
          style={{ overflowX: 'auto', overflowY: 'hidden', height: 16, flexShrink: 0, backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)' }}
        >
          <div style={{ width: width, height: 1 }}></div>
        </div>

        {/* Actual timeline container */}
        <div
          ref={containerRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onScroll={(e) => {
            e.currentTarget.style.transform = 'translateZ(0)';
            if (topScrollRef.current && Math.abs(topScrollRef.current.scrollLeft - e.currentTarget.scrollLeft) > 1) {
              topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
          style={{ flex: 1, position: 'relative', overflowX: 'auto', overflowY: 'auto' }}
        >
          <div style={{ position: 'relative', width: width, minHeight: Math.max(120, events.length * ROW_HEIGHT + 30) }}>
            {/* Header Axis */}
            <div
              style={{ position: 'sticky', top: 0, height: 30, backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)', zIndex: 10, cursor: 'crosshair', width: '100%' }}
              onClick={(e) => {
                if (onSeek) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  onSeek(Math.max(0, x / PIXELS_PER_UNIT));
                }
              }}
            >
              {Array.from({ length: Math.ceil(Math.max(containerWidth, maxTime * PIXELS_PER_UNIT) / PIXELS_PER_UNIT) }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: i * PIXELS_PER_UNIT, top: 8, fontSize: 10, color: 'var(--text-tertiary)', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                  {i}h
                </div>
              ))}
            </div>

            {/* Grid lines */}
            <div style={{ position: 'absolute', top: 30, bottom: 0, left: 0, right: 0, width: '100%', backgroundImage: 'linear-gradient(to right, var(--border-color) 1px, transparent 1px)', backgroundSize: `${PIXELS_PER_UNIT}px 100%`, zIndex: 0 }} />

            {/* Playhead */}
            <div style={{ position: 'absolute', top: 30, bottom: 0, width: '2px', backgroundColor: '#ef4444', zIndex: 10, boxShadow: '0 0 8px rgba(239,68,68,0.8)', left: `${simTime * PIXELS_PER_UNIT}px`, transition: 'left 0.1s linear' }}>
              <div style={{ position: 'absolute', top: '-24px', transform: 'translateX(-50%)', backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                {formatTime(simTime || 0)}
              </div>
            </div>

            {/* Events */}
            <div style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0 }}>
              {events.map((ev, i) => {
                const isSelected = selectedEvent === ev;
                const isInfinite = ev.duration === Infinity || ev.duration === null || ev.duration === undefined;
                const isDragged = dragState?.event === ev;

                const baseColor = AURORA_COLORS[i % AURORA_COLORS.length];

                const renderEventBar = (at: number, dur: number | null, isGhost: boolean) => {
                  const w = (dur === null || dur === Infinity) ? PIXELS_PER_UNIT * 2 : Number(dur) * PIXELS_PER_UNIT;
                  return (
                    <div
                      key={isGhost ? 'ghost' : 'real'}
                      onPointerDown={isGhost ? undefined : (e) => {
                        e.stopPropagation();
                        onSelectEvent(isSelected ? null : ev);
                        setDragState({ event: ev, type: 'move', initialX: e.clientX, initialAt: ev.at, initialDur: isInfinite ? null : ev.duration, currentAt: ev.at, currentDur: isInfinite ? null : ev.duration });
                      }}
                      style={{
                        position: 'absolute',
                        left: at * PIXELS_PER_UNIT,
                        top: i * ROW_HEIGHT + (ROW_HEIGHT - 24) / 2,
                        height: 24,
                        width: Math.max(10, w),
                        background: (dur === null || dur === Infinity) ? `linear-gradient(to right, ${baseColor}, transparent)` : baseColor,
                        border: isSelected && !isGhost ? '2px solid #fff' : `1px solid ${baseColor}`,
                        borderRadius: (dur === null || dur === Infinity) ? '4px 0 0 4px' : '4px',
                        opacity: isGhost ? 0.4 : (isDragged ? 0.5 : 0.9),
                        cursor: isGhost ? 'default' : 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 8px',
                        fontSize: 11,
                        color: '#fff',
                        boxShadow: isSelected && !isGhost ? '0 0 10px rgba(255,255,255,0.3)' : 'none',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        zIndex: isGhost ? 5 : 2
                      }}
                      title={`${ev.event_ref} at ${at} for ${(dur === null || dur === Infinity) ? 'inf' : dur}`}
                    >
                      <span>{ev.event_ref} {ev.selector} {(dur === null || dur === Infinity) ? '→' : ''}</span>
                      {isSelected && !isGhost && (
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); onDeleteEvent?.(ev); }}
                          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, zIndex: 20 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      {!(dur === null || dur === Infinity) && !isGhost && (
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setDragState({ event: ev, type: 'resize', initialX: e.clientX, initialAt: ev.at, initialDur: ev.duration, currentAt: ev.at, currentDur: ev.duration });
                          }}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 10, background: 'rgba(255,255,255,0.3)' }}
                        />
                      )}
                    </div>
                  );
                };

                return (
                  <React.Fragment key={i}>
                    {renderEventBar(ev.at, isInfinite ? null : ev.duration, false)}
                    {isDragged && renderEventBar(dragState.currentAt, dragState.currentDur, true)}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
