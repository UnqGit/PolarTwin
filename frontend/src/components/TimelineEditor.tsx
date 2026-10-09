import React, { useRef, useState, useEffect } from 'react';
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
  onSelectEvent: (event: SceneEventData | null, isCtrlKey?: boolean) => void;
  selectedEvent: SceneEventData | null;
  onAppendEvent?: (eventRef: string, at: number) => void;
  onUpdateEventLocation?: (event: SceneEventData, newAt: number, newDuration: number | null) => void;
  onDeleteEvent?: (event: SceneEventData) => void;
  onSeek?: (time: number) => void;
  zoom?: number;
}

const AURORA_COLORS = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

export const TimelineEditor: React.FC<TimelineEditorProps> = ({ events, simTime, onSelectEvent, selectedEvent, onAppendEvent, onUpdateEventLocation, onDeleteEvent, onSeek, zoom = 100 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef<'left' | 'right' | null>(null);
  const syncTimeout = useRef<any>(null);
  const bottomShadowRef = useRef<HTMLDivElement>(null);
  const rightShadowRef = useRef<HTMLDivElement>(null);
  const topShadowRef = useRef<HTMLDivElement>(null);
  const leftShadowRef = useRef<HTMLDivElement>(null);
  const latestClientX = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const checkScrollState = () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    
    // Check top overflow
    if (topShadowRef.current) {
      const isTopOverflowing = el.scrollTop > 2;
      topShadowRef.current.style.opacity = isTopOverflowing ? '1' : '0';
    }

    // Check bottom overflow
    if (bottomShadowRef.current) {
      const isBottomOverflowing = el.scrollHeight - Math.ceil(el.scrollTop) - el.clientHeight > 2;
      bottomShadowRef.current.style.opacity = isBottomOverflowing ? '1' : '0';
    }
    
    // Check left overflow
    if (leftShadowRef.current) {
      const isLeftOverflowing = el.scrollLeft > 2;
      leftShadowRef.current.style.opacity = isLeftOverflowing ? '1' : '0';
    }

    // Check right overflow
    if (rightShadowRef.current) {
      const isRightOverflowing = el.scrollWidth - Math.ceil(el.scrollLeft) - el.clientWidth > 2;
      rightShadowRef.current.style.opacity = isRightOverflowing ? '1' : '0';
    }
  };
  
  const basePixelsPerUnit = containerWidth > 0 ? containerWidth / 24 : 40;
  const pixelsPerUnit = basePixelsPerUnit * (zoom / 100);

  const SIDEBAR_WIDTH = 150;
  const ROW_HEIGHT = 32;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
      checkScrollState();
    });
    observer.observe(containerRef.current);
    
    // Initial check
    setTimeout(checkScrollState, 100);
    
    return () => observer.disconnect();
  }, []);

  const [dragState, setDragState] = useState<{ event: SceneEventData, type: 'move' | 'resize', initialX: number, initialScrollLeft: number, initialAt: number, initialDur: number | null, currentAt: number, currentDur: number | null } | null>(null);

  const maxTime = Math.max(
    24, // Default length to 24h
    simTime + 5,
    dragState ? dragState.currentAt + (dragState.currentDur || 5) : 0,
    events.reduce((max, e) => {
      const isInf = e.duration === Infinity || e.duration === null || e.duration === undefined;
      const dur = isInf ? 5 : Number(e.duration);
      return Math.max(max, e.at + dur);
    }, 24)
  );

  const width = Math.max(containerWidth, maxTime * pixelsPerUnit);

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
      const at = Math.max(0, x / pixelsPerUnit);
      onAppendEvent(eventRef, parseFloat(at.toFixed(1)));
    }
  };

  useEffect(() => {
    if (!dragState) {
      latestClientX.current = null;
      return;
    }

    const initialX = dragState.initialX;
    const initialScrollLeft = dragState.initialScrollLeft;
    const initialAt = dragState.initialAt;
    const initialDur = dragState.initialDur;
    const type = dragState.type;

    let interval: ReturnType<typeof setInterval> | null = null;

    const doAutoScroll = () => {
      if (latestClientX.current === null || !containerRef.current) return;
      const clientX = latestClientX.current;
      
      const rect = containerRef.current.getBoundingClientRect();
      const rightDist = rect.right - clientX;
      const leftDist = clientX - (rect.left + SIDEBAR_WIDTH);
      
      let scrolled = false;
      if (rightDist < 50) {
        containerRef.current.scrollLeft += 15;
        scrolled = true;
      } else if (leftDist < 50) {
        containerRef.current.scrollLeft -= 15;
        scrolled = true;
      }

      if (scrolled) {
        const scrollOffset = (containerRef.current.scrollLeft || 0) - initialScrollLeft;
        const dx = (clientX - initialX + scrollOffset) / pixelsPerUnit;
        
        if (type === 'move') {
          const newAt = Math.max(0, initialAt + dx);
          setDragState(prev => prev ? { ...prev, currentAt: parseFloat(newAt.toFixed(1)) } : null);
        } else if (type === 'resize') {
          const newDur = Math.max(0.1, (initialDur || 5) + dx);
          setDragState(prev => prev ? { ...prev, currentDur: parseFloat(newDur.toFixed(1)) } : null);
        }
      }
    };

    interval = setInterval(doAutoScroll, 32);

    const handleMove = (e: PointerEvent) => {
      latestClientX.current = e.clientX;
      const scrollOffset = (containerRef.current?.scrollLeft || 0) - initialScrollLeft;
      const dx = (e.clientX - initialX + scrollOffset) / pixelsPerUnit;
      
      if (type === 'move') {
        const newAt = Math.max(0, initialAt + dx);
        setDragState(prev => prev ? { ...prev, currentAt: parseFloat(newAt.toFixed(1)) } : null);
      } else if (type === 'resize') {
        const newDur = Math.max(0.1, (initialDur || 5) + dx);
        setDragState(prev => prev ? { ...prev, currentDur: parseFloat(newDur.toFixed(1)) } : null);
      }
    };

    const handleUp = () => {
      if (interval) clearInterval(interval);
      setDragState(currentDragState => {
        if (currentDragState && onUpdateEventLocation) {
          if (currentDragState.currentAt !== currentDragState.initialAt || currentDragState.currentDur !== currentDragState.initialDur) {
            onUpdateEventLocation(currentDragState.event, currentDragState.currentAt, currentDragState.currentDur);
          }
        }
        return null;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState?.initialX, dragState?.initialScrollLeft, dragState?.initialAt, dragState?.initialDur, dragState?.type, pixelsPerUnit, onUpdateEventLocation]);

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'row', backgroundColor: 'var(--bg-main)', overflow: 'hidden', position: 'relative' }}
      onClick={() => { if (selectedEvent) onSelectEvent(null); }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      {/* Scroll Shadow Overlays */}
      <div 
        ref={topShadowRef} 
        style={{ position: 'absolute', top: 30, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, var(--bg-main), transparent)', pointerEvents: 'none', zIndex: 100, opacity: 0, transition: 'opacity 0.2s' }} 
      />
      <div 
        ref={bottomShadowRef} 
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to top, var(--bg-main), transparent)', pointerEvents: 'none', zIndex: 100, opacity: 0, transition: 'opacity 0.2s' }} 
      />
      <div 
        ref={leftShadowRef} 
        style={{ position: 'absolute', top: 0, bottom: 0, left: SIDEBAR_WIDTH, width: 40, background: 'linear-gradient(to right, var(--bg-main), transparent)', pointerEvents: 'none', zIndex: 100, opacity: 0, transition: 'opacity 0.2s' }} 
      />
      <div 
        ref={rightShadowRef} 
        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 40, background: 'linear-gradient(to left, var(--bg-main), transparent)', pointerEvents: 'none', zIndex: 100, opacity: 0, transition: 'opacity 0.2s' }} 
      />
      {/* Sidebar for layers */}
      <div style={{ width: SIDEBAR_WIDTH, flexShrink: 0, borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel-secondary)', zIndex: 20, display: 'flex', flexDirection: 'column' }}>
        <div
          ref={sidebarRef}
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
          className="no-scrollbar"
          onScroll={(e) => {
            if (isSyncing.current === 'right') return;
            if (containerRef.current) {
              isSyncing.current = 'left';
              containerRef.current.scrollTop = e.currentTarget.scrollTop;
              clearTimeout(syncTimeout.current);
              syncTimeout.current = setTimeout(() => isSyncing.current = null, 50);
              checkScrollState();
            }
          }}
        >
          <div style={{ position: 'relative', minHeight: `max(100%, ${Math.max(120, events.length * ROW_HEIGHT + 30)}px)` }}>
            {/* Header Axis */}
            <div style={{ position: 'sticky', top: 0, height: 30, backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 'bold', zIndex: 10 }}>
              EVENTS
            </div>
            {/* Events */}
            <div style={{ position: 'absolute', top: 30, left: 0, right: 0 }}>
              {events.map((ev, i) => (
                <div 
                  key={i} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(ev);
                    if (containerRef.current) {
                      const targetX = ev.at * pixelsPerUnit;
                      const centerOffset = containerWidth / 2;
                      containerRef.current.scrollTo({ left: Math.max(0, targetX - centerOffset), behavior: 'smooth' });
                    }
                  }}
                  style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid var(--border-color)', color: selectedEvent === ev ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', backgroundColor: selectedEvent === ev ? 'rgba(99,219,188,0.08)' : 'transparent', cursor: 'pointer' }}
                >
                  {ev.event_ref}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline track container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Actual timeline container */}
        <div
          ref={containerRef}
          className="no-scrollbar"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onScroll={(e) => {
            e.currentTarget.style.transform = 'translateZ(0)';
            checkScrollState();
            if (isSyncing.current === 'left') return;
            if (sidebarRef.current) {
              isSyncing.current = 'right';
              sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
              clearTimeout(syncTimeout.current);
              syncTimeout.current = setTimeout(() => isSyncing.current = null, 50);
            }
          }}
          style={{ flex: 1, position: 'relative', overflowX: 'auto', overflowY: 'auto' }}
        >
          <div style={{ position: 'relative', width: width, minHeight: `max(100%, ${Math.max(120, events.length * ROW_HEIGHT + 30)}px)` }}>
            {/* Header Axis */}
            <div
              style={{ position: 'sticky', top: 0, height: 30, backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)', zIndex: 10, cursor: 'crosshair', width: '100%' }}
              onClick={(e) => {
                if (onSeek) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  onSeek(Math.max(0, x / pixelsPerUnit));
                }
              }}
            >
              {Array.from({ length: Math.ceil(Math.max(containerWidth, maxTime * pixelsPerUnit) / pixelsPerUnit) + 1 }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: i * pixelsPerUnit, top: 8, fontSize: 10, color: 'var(--text-tertiary)', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                  {i}h
                </div>
              ))}
            </div>

            {/* Grid lines */}
            <div style={{ position: 'absolute', top: 30, bottom: 0, left: 0, right: 0, width: '100%', backgroundImage: 'linear-gradient(to right, var(--border-color) 1px, transparent 1px)', backgroundSize: `${pixelsPerUnit}px 100%`, zIndex: 0 }} />

            {/* Playhead */}
            <div style={{ position: 'absolute', top: 30, bottom: 0, width: '2px', backgroundColor: 'var(--accent-primary)', zIndex: 10, boxShadow: '0 0 8px rgba(99,219,188,0.8)', left: `${simTime * pixelsPerUnit}px`, transition: 'left 0.1s linear' }}>
              <div style={{ position: 'absolute', top: '-24px', transform: 'translateX(-50%)', backgroundColor: 'var(--accent-primary)', color: '#030a0f', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                {formatTime(simTime || 0)}
              </div>
            </div>

            {/* Events */}
            <div style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0 }}>
              {events.map((ev, i) => {
                const isSelected = selectedEvent === ev;
                const isInfinite = ev.duration === Infinity || ev.duration === null || ev.duration === undefined;
                const isDragged = dragState?.event === ev && (dragState.currentAt !== dragState.initialAt || dragState.currentDur !== dragState.initialDur);

                const baseColor = AURORA_COLORS[i % AURORA_COLORS.length];

                const renderEventBar = (at: number, dur: number | null, isGhost: boolean) => {
                  const w = (dur === null || dur === Infinity) ? pixelsPerUnit * 2 : Number(dur) * pixelsPerUnit;
                  return (
                    <div
                      key={isGhost ? 'ghost' : 'real'}
                      onPointerDown={isGhost ? undefined : (e) => {
                        e.stopPropagation();
                        if (dragState) return; // Prevent multi-grab
                        if (!isSelected || e.ctrlKey) onSelectEvent(ev, e.ctrlKey);
                        setDragState({ event: ev, type: 'move', initialX: e.clientX, initialScrollLeft: containerRef.current?.scrollLeft || 0, initialAt: ev.at, initialDur: isInfinite ? null : ev.duration, currentAt: ev.at, currentDur: isInfinite ? null : ev.duration });
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      style={{
                        position: 'absolute',
                        left: at * pixelsPerUnit,
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
                            setDragState({ event: ev, type: 'resize', initialX: e.clientX, initialScrollLeft: containerRef.current?.scrollLeft || 0, initialAt: ev.at, initialDur: ev.duration, currentAt: ev.at, currentDur: ev.duration });
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
