import React, { useState, useEffect } from 'react';
import type { SceneEventData } from './TimelineEditor';

interface EventInspectorProps {
  event: SceneEventData | null;
  eventDef: any;
  specs?: any[];
  onUpdateEvent?: (newSourceSnippet: string) => void;
  disabled?: boolean;
}

export const EventInspector: React.FC<EventInspectorProps> = ({ event, eventDef, specs, onUpdateEvent, disabled = false }) => {
  const [editSelector, setEditSelector] = useState('');
  const [editAt, setEditAt] = useState('');
  const [editFor, setEditFor] = useState('');
  const [editPayloadObj, setEditPayloadObj] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  const getSchemaForField = (key: string) => {
    if (!specs) return null;
    let parts = key.split('.');
    let base = parts.length > 1 ? parts[1] : parts[0];
    for (const spec of specs) {
      if (!spec.rating) continue;
      for (const scope of ['state', 'input', 'output']) {
         if (spec.rating[scope] && spec.rating[scope][base] !== undefined) {
             return spec.rating[scope][base];
         }
      }
    }
    return null;
  };

  const renderInput = (key: string, value: any, onChange: (v: string) => void) => {
    if (key === 'status') {
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '4px' }}>
          <option value="">-- select --</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="failure">failure</option>
        </select>
      );
    }
    const schema = getSchemaForField(key);
    if (!schema) {
      return <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="value" style={{ width: '100%', boxSizing: 'border-box' }} />;
    }
    
    if (typeof schema === 'boolean') {
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '4px' }}>
          <option value="">-- select --</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    } else if (typeof schema === 'string') {
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="string value" style={{ width: '100%', boxSizing: 'border-box' }} />;
    } else if (typeof schema === 'object' && (schema.min !== undefined || schema.max !== undefined || schema.unit !== undefined || schema.value !== undefined)) {
      return <input type="number" step="any" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="numeric value" style={{ width: '100%', boxSizing: 'border-box' }} />;
    }
    return <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="value" style={{ width: '100%', boxSizing: 'border-box' }} />;
  };

  const { declared, initiated } = React.useMemo(() => {
    const d: string[] = [];
    const i: { key: string, value: string }[] = [];
    if (eventDef && eventDef.source) {
      const lines = eventDef.source.split('\n');
      let inSetBlock = false;
      
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('//')) continue;
        
        if (inSetBlock) {
          if (line.includes('}')) {
            inSetBlock = false;
            line = line.substring(0, line.indexOf('}')).trim();
            if (!line) continue;
          }
          const eqIdx = line.indexOf('=');
          if (eqIdx === -1) {
            d.push(line);
          } else {
            i.push({ key: line.substring(0, eqIdx).trim(), value: line.substring(eqIdx + 1).trim() });
          }
        } else if (line.startsWith('set ') || line === 'set' || line.startsWith('set{')) {
          let remainder = '';
          if (line.startsWith('set ')) remainder = line.substring(4).trim();
          else if (line.startsWith('set{')) remainder = line.substring(3).trim();
          
          if (remainder.startsWith('fields {')) {
             remainder = remainder.substring(8).trim();
             inSetBlock = true;
          } else if (remainder.startsWith('{')) {
             remainder = remainder.substring(1).trim();
             inSetBlock = true;
          } else if (remainder === 'fields') {
             continue;
          } else if (line === 'set') {
             // Just 'set', next line might be '{'
             continue;
          }
          
          if (remainder) {
             if (remainder.includes('}')) {
                 inSetBlock = false;
                 remainder = remainder.substring(0, remainder.indexOf('}')).trim();
             }
             if (remainder) {
                 const eqIdx = remainder.indexOf('=');
                 if (eqIdx === -1) {
                    d.push(remainder);
                 } else {
                    i.push({ key: remainder.substring(0, eqIdx).trim(), value: remainder.substring(eqIdx + 1).trim() });
                 }
             }
          }
        } else if (line.startsWith('{') && !inSetBlock) {
          inSetBlock = true;
          let remainder = line.substring(1).trim();
          if (remainder) {
             if (remainder.includes('}')) {
                 inSetBlock = false;
                 remainder = remainder.substring(0, remainder.indexOf('}')).trim();
             }
             if (remainder) {
                 const eqIdx = remainder.indexOf('=');
                 if (eqIdx === -1) {
                    d.push(remainder);
                 } else {
                    i.push({ key: remainder.substring(0, eqIdx).trim(), value: remainder.substring(eqIdx + 1).trim() });
                 }
             }
          }
        }
      }
    }
    return { declared: d, initiated: i };
  }, [eventDef]);

  useEffect(() => {
    if (event) {
      setEditSelector(event.selector ? (event.selector.startsWith('@') ? event.selector.slice(1) : event.selector) : '');
      setEditAt(event.at.toString());
      setEditFor(event.duration === Infinity || event.duration === null ? 'inf' : event.duration.toString());
      
      if (event.payload && Object.keys(event.payload).length > 0) {
        const obj: Record<string, string> = {};
        Object.entries(event.payload).forEach(([k, v]) => {
          obj[k] = String(v);
        });
        setEditPayloadObj(obj);
      } else {
        setEditPayloadObj({});
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

  const validateField = (key: string, value: string | undefined): 'valid' | 'empty' | 'invalid' => {
    if (value === undefined || value === '') return 'empty';
    if (key === 'status') {
       if (!['active', 'inactive', 'failure'].includes(value)) return 'invalid';
       return 'valid';
    }
    const schema = getSchemaForField(key);
    if (!schema) return 'valid';
    if (typeof schema === 'boolean') {
      return (value === 'true' || value === 'false') ? 'valid' : 'invalid';
    }
    if (typeof schema === 'object' && (schema.min !== undefined || schema.max !== undefined || schema.unit !== undefined || schema.value !== undefined)) {
      return isNaN(Number(value)) ? 'invalid' : 'valid';
    }
    return 'valid';
  };

  const missingRequired = declared.filter(key => {
    const status = validateField(key, editPayloadObj[key]);
    return status === 'empty' || status === 'invalid';
  });

  const handleSave = () => {
    if (!onUpdateEvent) return;
    if (missingRequired.length > 0) return;
    
    // Construct DSL string
    let snippet = `event:${event.event_ref}`;
    if (editSelector.trim()) {
      let sel = editSelector.trim();
      if (!sel.startsWith('@') && !sel.startsWith('"') && !sel.startsWith("'") && sel !== 'all') {
        sel = '@' + sel;
      }
      snippet += ` ${sel}`;
    }
    snippet += ` at=${editAt.trim()} for=${editFor.trim()}`;
    
    if (Object.keys(editPayloadObj).length > 0) {
      const initiatedKeys = initiated.map(i => i.key);
      const keys = Object.keys(editPayloadObj).filter(k => 
        editPayloadObj[k] !== undefined && 
        editPayloadObj[k] !== '' &&
        !initiatedKeys.includes(k)
      );
      if (keys.length > 0) {
        snippet += ` set {\n`;
        keys.forEach(k => {
          snippet += `    ${k}=${editPayloadObj[k]}\n`;
        });
        snippet += `}`;
      }
    }
    
    onUpdateEvent(snippet);
    setIsEditing(false);
  };

  return (
    <div style={{ padding: 16, color: 'var(--text-primary)', fontSize: 13, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent-primary)', margin: 0 }}>{event.event_ref}</h3>
        {onUpdateEvent && (
          <button 
            onClick={() => {
              if (isEditing) {
                if (missingRequired.length > 0) return;
                handleSave();
              } else {
                setEditPayloadObj(prev => {
                  const next = { ...prev };
                  Object.keys(next).forEach(k => {
                    if (validateField(k, next[k]) === 'invalid') {
                       next[k] = '';
                    }
                  });
                  return next;
                });
                setIsEditing(true);
              }
            }}
            className={`btn btn-sm ${isEditing ? 'btn-primary' : 'btn-secondary'}`}
            disabled={disabled || (isEditing && missingRequired.length > 0)}
            title={isEditing && missingRequired.length > 0 ? "Fill required fields to save" : ""}
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
            style={{ width: '100%', boxSizing: 'border-box' }}
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
              style={{ width: '100%', boxSizing: 'border-box' }}
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
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          ) : (
            <div style={{ padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
              {event.duration === Infinity || event.duration === null ? 'inf' : `${event.duration} h`}
            </div>
          )}
        </div>
      </div>
      
      {(isEditing || declared.length > 0 || initiated.length > 0 || (event.payload && Object.keys(event.payload).length > 0)) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 11, textTransform: 'uppercase' }}>Set Payload</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {declared.map(key => {
              const validationStatus = validateField(key, editPayloadObj[key]);
              const isMissing = validationStatus === 'empty';
              const isInvalid = validationStatus === 'invalid';
              const showAsterisk = (isMissing && isEditing) || isInvalid;
              const asteriskColor = isMissing ? '#ef4444' : '#f59e0b';
              const helperText = isMissing ? '* this is a required field' : '* invalid data type';

              return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 120, fontFamily: 'monospace', fontSize: 12, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                    {key}
                  </div>
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      renderInput(key, editPayloadObj[key], v => setEditPayloadObj(prev => ({ ...prev, [key]: v })))
                    ) : (
                      <div style={{ padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, border: '1px solid var(--border-color)', minHeight: 24, display: 'flex', alignItems: 'center' }}>
                        {event.payload && event.payload[key] !== undefined ? String(event.payload[key]) : <span style={{ color: '#ef4444', fontStyle: 'italic' }}>(not set)</span>}
                      </div>
                    )}
                  </div>
                </div>
                {showAsterisk && (
                  <div style={{ paddingLeft: 120, color: asteriskColor, fontSize: 11, marginTop: 4 }}>{helperText}</div>
                )}
              </div>
            )})}
            {Object.keys(editPayloadObj).filter(k => !declared.includes(k) && !initiated.find(i => i.key === k)).map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 120, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{key}</div>
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    renderInput(key, editPayloadObj[key], v => setEditPayloadObj(prev => ({ ...prev, [key]: v })))
                  ) : (
                    <div style={{ padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, border: '1px solid var(--border-color)', minHeight: 24, display: 'flex', alignItems: 'center' }}>
                      {editPayloadObj[key]}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {initiated.map(({ key, value }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                <div style={{ width: 120, fontFamily: 'monospace', fontSize: 12 }}>{key}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ padding: '4px 8px', background: 'transparent', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, border: '1px solid var(--border-color)', minHeight: 24, display: 'flex', alignItems: 'center' }} title="Initiated by event definition (read-only)">
                    {value}
                  </div>
                </div>
              </div>
            ))}
            {declared.length === 0 && initiated.length === 0 && Object.keys(editPayloadObj).length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>No payload fields</div>
            )}
          </div>
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
