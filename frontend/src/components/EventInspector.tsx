import React, { useState, useEffect } from 'react';
import type { SceneEventData } from './TimelineEditor';

interface EventInspectorProps {
  event: SceneEventData | null;
  eventDef: any;
  onUpdateEvent?: (newSourceSnippet: string) => void;
}

export const EventInspector: React.FC<EventInspectorProps> = ({ event, eventDef, onUpdateEvent }) => {
  const [editSelector, setEditSelector] = useState('');
  const [editAt, setEditAt] = useState('');
  const [editFor, setEditFor] = useState('');
  const [editPayload, setEditPayload] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (event) {
      setEditSelector(event.selector || '');
      setEditAt(event.at.toString());
      setEditFor(event.duration === Infinity || event.duration === null ? 'inf' : event.duration.toString());
      
      if (event.payload && Object.keys(event.payload).length > 0) {
        // Simple serialization of payload for editing
        const pairs = Object.entries(event.payload).map(([k, v]) => `${k}=${v}`);
        setEditPayload(pairs.join('\n'));
      } else {
        setEditPayload('');
      }
      setIsEditing(false);
    }
  }, [event]);

  if (!event) {
    return (
      <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 13 }}>
        Select an event in the timeline to inspect its properties.
      </div>
    );
  }

  const handleSave = () => {
    if (!onUpdateEvent) return;
    
    // Construct DSL string
    let snippet = `event:${event.event_ref}`;
    if (editSelector.trim()) {
      snippet += ` ${editSelector.trim()}`;
    }
    snippet += ` at=${editAt.trim()} for=${editFor.trim()}`;
    
    if (editPayload.trim()) {
      snippet += ` {\n`;
      const lines = editPayload.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          snippet += `    ${line.trim()}\n`;
        }
      }
      snippet += `}`;
    }
    
    onUpdateEvent(snippet);
    setIsEditing(false);
  };

  return (
    <div style={{ padding: 16, color: 'var(--text-primary)', fontSize: 13, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent-blue)', margin: 0 }}>{event.event_ref}</h3>
        {onUpdateEvent && (
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            style={{ 
              padding: '4px 8px', 
              backgroundColor: isEditing ? 'var(--accent-green)' : 'var(--bg-input)', 
              color: isEditing ? '#fff' : 'var(--text-primary)', 
              fontSize: '12px', 
              borderRadius: '4px', 
              border: '1px solid var(--border-color)', 
              cursor: 'pointer' 
            }}
          >
            {isEditing ? 'Save' : 'Edit'}
          </button>
        )}
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 11, textTransform: 'uppercase' }}>Target Selector</div>
        {isEditing ? (
          <input 
            value={editSelector}
            onChange={(e) => setEditSelector(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
          />
        ) : (
          <div style={{ padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
            {event.selector || '(none)'}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 11, textTransform: 'uppercase' }}>Start (at)</div>
          {isEditing ? (
            <input 
              value={editAt}
              onChange={(e) => setEditAt(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
            />
          ) : (
            <div style={{ padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
              {event.at} h
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 11, textTransform: 'uppercase' }}>Duration (for)</div>
          {isEditing ? (
            <input 
              value={editFor}
              onChange={(e) => setEditFor(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
            />
          ) : (
            <div style={{ padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
              {event.duration === Infinity || event.duration === null ? 'inf' : `${event.duration} h`}
            </div>
          )}
        </div>
      </div>
      
      {(isEditing || (event.payload && Object.keys(event.payload).length > 0)) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 11, textTransform: 'uppercase' }}>Set Payload</div>
          {isEditing ? (
            <textarea
              value={editPayload}
              onChange={(e) => setEditPayload(e.target.value)}
              placeholder="key=value (one per line)"
              rows={4}
              style={{ width: '100%', padding: '8px', background: 'var(--bg-input)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'monospace', fontSize: 11, border: '1px solid var(--border-color)', resize: 'vertical', boxSizing: 'border-box' }}
            />
          ) : (
            <pre style={{ padding: '8px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'monospace', fontSize: 11, margin: 0, border: '1px solid var(--border-color)' }}>
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          )}
        </div>
      )}

      {eventDef && (
        <div style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 11, textTransform: 'uppercase' }}>Definition Source</div>
          <pre style={{ padding: '8px', background: 'var(--bg-panel-secondary)', borderRadius: 4, fontFamily: 'monospace', fontSize: 11, margin: 0, color: 'var(--text-tertiary)', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
            {eventDef.source}
          </pre>
        </div>
      )}
    </div>
  );
};
