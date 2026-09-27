import React, { useRef, useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

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
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({ events, simTime, onSelectEvent, selectedEvent, onAppendEvent, onUpdateEventLocation, onDeleteEvent }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const PIXELS_PER_UNIT = 40; // 40px per simulation hour

  const maxTime = Math.max(
    simTime + 5,
    events.reduce((max, e) => {
      const isInf = e.duration === Infinity || e.duration === null || e.duration === undefined;
      const dur = isInf ? 5 : Number(e.duration);
      return Math.max(max, e.at + dur);
    }, 10)
  );
  
  const width = Math.max(800, maxTime * PIXELS_PER_UNIT);

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
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      const at = Math.max(0, x / PIXELS_PER_UNIT);
      onAppendEvent(eventRef, parseFloat(at.toFixed(1)));
    }
  };

  const [dragState, setDragState] = useState<{event: SceneEventData, type: 'move' | 'resize', initialX: number, initialAt: number, initialDur: number | null} | null>(null);

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: PointerEvent) => {
      if (!containerRef.current || !onUpdateEventLocation) return;
      const dx = (e.clientX - dragState.initialX) / PIXELS_PER_UNIT;
      if (dragState.type === 'move') {
        const newAt = Math.max(0, dragState.initialAt + dx);
        onUpdateEventLocation(dragState.event, parseFloat(newAt.toFixed(1)), dragState.initialDur);
      } else if (dragState.type === 'resize') {
        const newDur = Math.max(0.1, (dragState.initialDur || 5) + dx);
        onUpdateEventLocation(dragState.event, dragState.initialAt, parseFloat(newDur.toFixed(1)));
      }
    };
    const handleUp = () => setDragState(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState, onUpdateEventLocation]);

  return (
    <div 
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ flex: 1, position: 'relative', overflowX: 'auto', overflowY: 'auto', padding: '16px 0', backgroundColor: 'var(--bg-main)' }}
    >
      <div style={{ position: 'relative', width: width, height: '100%', minHeight: 120 }}>
        {/* Grid lines */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: `${PIXELS_PER_UNIT}px 100%` }} />
        
        {/* Axis labels */}
        {Array.from({ length: Math.ceil(width / PIXELS_PER_UNIT) }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: i * PIXELS_PER_UNIT, top: 0, fontSize: 10, color: 'var(--text-tertiary)', transform: 'translateX(-50%)' }}>
            {i}h
          </div>
        ))}
        
        {/* Playhead */}
        <div style={{ position: 'absolute', top: 16, bottom: 0, width: '2px', backgroundColor: '#ef4444', zIndex: 10, boxShadow: '0 0 8px rgba(239,68,68,0.8)', left: `${simTime * PIXELS_PER_UNIT}px`, transition: 'left 0.1s linear' }}>
          <div style={{ position: 'absolute', top: '-12px', transform: 'translateX(-50%)', backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', padding: '0 4px', borderRadius: '2px' }}>
            {(simTime || 0).toFixed(1)}
          </div>
        </div>

        {/* Events */}
        <div style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: '0' }}>
          {events.map((ev, i) => {
            const isSelected = selectedEvent === ev;
            const isInfinite = ev.duration === Infinity || ev.duration === null || ev.duration === undefined;
            const eventWidth = isInfinite ? PIXELS_PER_UNIT * 2 : Number(ev.duration) * PIXELS_PER_UNIT; 
            
            return (
              <div 
                key={i}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectEvent(isSelected ? null : ev);
                  setDragState({ event: ev, type: 'move', initialX: e.clientX, initialAt: ev.at, initialDur: isInfinite ? null : ev.duration });
                }}
                style={{
                  position: 'absolute',
                  left: ev.at * PIXELS_PER_UNIT,
                  top: i * 28,
                  height: 24,
                  width: Math.max(10, eventWidth),
                  background: isInfinite ? 'linear-gradient(to right, var(--accent-blue), transparent)' : 'var(--accent-blue)',
                  border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: isInfinite ? '4px 0 0 4px' : '4px',
                  opacity: 0.8,
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 8px',
                  fontSize: 11,
                  color: '#fff',
                  boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.5)' : 'none',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  userSelect: 'none'
                }}
                title={`${ev.event_ref} at ${ev.at} for ${isInfinite ? 'inf' : ev.duration}`}
              >
                <span>{ev.event_ref} {ev.selector} {isInfinite ? '→' : ''}</span>
                {isSelected && (
                  <button 
                    onPointerDown={(e) => e.stopPropagation()} 
                    onClick={(e) => { e.stopPropagation(); onDeleteEvent?.(ev); }}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, zIndex: 20 }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                {!isInfinite && (
                  <div 
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDragState({ event: ev, type: 'resize', initialX: e.clientX, initialAt: ev.at, initialDur: ev.duration });
                    }}
                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 10, background: 'rgba(255,255,255,0.2)' }} 
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
