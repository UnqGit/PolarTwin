import React, { useState, useEffect } from 'react';
import { Trash2, Activity, HardDrive, Cpu, Clock, Layers, Filter, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { useStation } from '../components/StationContext';

interface HistoryRecord {
  id: number;
  run_id: string;
  station_id: string;
  simulation_time: number;
  persistence_time: number;
  source: string;
  component_count: number;
  connection_count: number;
}

const STYLE_INJECTION = `
  .diag-row {
    transition: all 0.2s ease;
  }
  .diag-row:hover {
    background: var(--hover-overlay) !important;
    transform: translateX(4px);
  }
  .diag-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .diag-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: rgba(255,255,255,0.1);
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .animate-slide-in {
    animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  /* Custom scrollbars */
  .custom-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scroll::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.2);
    border-radius: 4px;
  }
  .custom-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(148, 163, 184, 0.4);
  }
`;

export function DiagnosticsPage() {
  const { selectedStation } = useStation();
  const [runs, setRuns] = useState<{run_id: string, station_id: string}[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [recordDetail, setRecordDetail] = useState<any>(null);

  useEffect(() => {
    api.getTelemetryRuns().then(r => setRuns(r)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedStation) return;
    const runIdParam = selectedRun ? selectedRun : undefined;
    api.getTelemetryHistory(selectedStation, runIdParam).then(data => {
      setHistory(data);
      if (data.length > 0 && !selectedRecordId) {
        setSelectedRecordId(data[data.length - 1].id);
      }
    }).catch(console.error);
  }, [selectedStation, selectedRun]);

  useEffect(() => {
    if (selectedRecordId) {
      api.getTelemetryRecord(selectedRecordId).then(data => {
        setRecordDetail(data);
      }).catch(console.error);
    } else {
      setRecordDetail(null);
    }
  }, [selectedRecordId]);

  if (!selectedStation) {
    return <div style={{ padding: 24, color: 'var(--text-primary)' }}>Please select a station first.</div>;
  }

  const filteredHistory = history.filter(r => sourceFilter === 'ALL' || r.source === sourceFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-main)' }}>
      <style>{STYLE_INJECTION}</style>
      
      {/* Header & Filters */}
      <div className="glass-panel" style={{ 
        display: 'flex', gap: 24, padding: '20px 32px', borderBottom: '1px solid var(--border-color)', 
        alignItems: 'center', margin: '24px 24px 0 24px', borderRadius: '16px 16px 0 0',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={24} color="var(--accent-cyan)" />
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Diagnostics</h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Telemetry history & state</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', alignItems: 'center', background: 'var(--bg-panel-secondary)', padding: '6px 16px', borderRadius: '12px', border: '1px solid var(--border-solid)' }}>
          <Filter size={16} color="var(--text-tertiary)" />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="source-filter" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>SOURCE</label>
            <select 
              id="source-filter"
              value={sourceFilter} 
              onChange={e => setSourceFilter(e.target.value)}
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none' }}
            >
              <option value="ALL">All</option>
              <option value="SIMULATION">Simulation</option>
              <option value="PHYSICAL">Physical</option>
            </select>
          </div>
          
          <div style={{ width: 1, height: 20, background: 'var(--border-solid)' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="run-filter" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>RUN</label>
            <select 
              id="run-filter"
              value={selectedRun} 
              onChange={e => setSelectedRun(e.target.value)}
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none' }}
            >
              <option value="">All Runs</option>
              {runs.filter(r => r.station_id === selectedStation).map(r => (
                <option key={r.run_id} value={r.run_id}>{r.run_id.substring(0, 8)}...</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ display: 'flex', flex: 1, overflow: 'hidden', margin: '0 24px 24px 24px', borderRadius: '0 0 16px 16px', borderTop: 'none' }}>
        
        {/* Timeline / Table */}
        <div style={{ width: '40%', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.4)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div style={{ width: 80 }}>Time (s)</div>
            <div style={{ width: 80 }}>Source</div>
            <div style={{ flex: 1 }}>Run ID</div>
            <div style={{ width: 60, textAlign: 'right' }}>Comps</div>
            <div style={{ width: 60, textAlign: 'right' }}>Conns</div>
            <div style={{ width: 40 }}></div>
          </div>
          
          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filteredHistory.map(r => {
              const isSelected = selectedRecordId === r.id;
              return (
                <div 
                  key={r.id} 
                  onClick={() => setSelectedRecordId(r.id)}
                  className="diag-row"
                  style={{ 
                    display: 'flex', 
                    padding: '12px 20px', 
                    cursor: 'pointer',
                    fontSize: 13,
                    backgroundColor: isSelected ? 'var(--bg-panel-secondary)' : 'transparent',
                    borderLeft: `3px solid ${isSelected ? 'var(--accent-blue)' : 'transparent'}`,
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ width: 80, fontFamily: 'monospace', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{r.simulation_time.toFixed(2)}</div>
                  <div style={{ width: 80 }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                      backgroundColor: r.source === 'SIMULATION' ? 'rgba(181, 102, 255, 0.15)' : 'rgba(0, 230, 118, 0.15)', 
                      color: r.source === 'SIMULATION' ? 'var(--accent-cyan)' : 'var(--accent-blue)' 
                    }}>
                      {r.source.substring(0, 3)}
                    </span>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: isSelected ? 1 : 0.7, fontFamily: 'monospace', fontSize: 12 }}>{r.run_id}</div>
                  <div style={{ width: 60, textAlign: 'right', opacity: isSelected ? 1 : 0.7, fontWeight: 600 }}>{r.component_count}</div>
                  <div style={{ width: 60, textAlign: 'right', opacity: isSelected ? 1 : 0.7, fontWeight: 600 }}>{r.connection_count}</div>
                  <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm('Delete this record?')) {
                          await api.deleteTelemetryRecord(r.id);
                          setHistory(h => h.filter(x => x.id !== r.id));
                          if (selectedRecordId === r.id) {
                            setRecordDetail(null);
                            setSelectedRecordId(null);
                          }
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                      className="hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredHistory.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <FileText size={48} style={{ margin: '0 auto', opacity: 0.2, marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>No telemetry records found</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Run a simulation to generate telemetry data.</div>
              </div>
            )}
          </div>
        </div>

        {/* Record Detail */}
        <div className="custom-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '32px 40px', backgroundColor: 'transparent' }}>
          {recordDetail ? (
            <div className="animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 850, margin: '0 auto', width: '100%' }}>
              
              <div className="diag-card glass-panel" style={{ padding: 24, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <HardDrive size={20} color="var(--accent-blue)" />
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Snapshot Summary</h3>
                  </div>
                  <button 
                    onClick={async () => {
                      if (confirm('Delete this record?')) {
                        await api.deleteTelemetryRecord(recordDetail.id);
                        setHistory(h => h.filter(x => x.id !== recordDetail.id));
                        setRecordDetail(null);
                        setSelectedRecordId(null);
                      }
                    }}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                    className="hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={12} /> Sim Time</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{recordDetail.time.toFixed(3)}s</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={12} /> Source</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: recordDetail.source === 'SIMULATION' ? 'var(--accent-cyan)' : 'var(--accent-blue)', marginTop: 4 }}>{recordDetail.source}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 12, border: '1px solid var(--border-color)', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Run ID</div>
                    <div style={{ fontSize: 14, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{recordDetail.run_id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>Persisted: {new Date(recordDetail.persistence_time * 1000).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* External Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Cpu size={18} color="var(--accent-cyan)" /> External Environment</h3>
                {recordDetail.external && Object.keys(recordDetail.external).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {Object.entries(recordDetail.external).map(([key, val]: [string, any]) => (
                      <div key={key} className="diag-card glass-panel" style={{ padding: '16px 20px', borderRadius: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>{key}</div>
                        {typeof val === 'object' && val !== null ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                            {Object.entries(val).map(([subKey, subVal]) => (
                              <div key={subKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{subKey}</span>
                                <span style={{ color: '#fff', fontWeight: 500 }}>{String(subVal)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{String(val)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-panel" style={{ padding: 24, fontSize: 14, color: 'var(--text-tertiary)', borderRadius: 12, textAlign: 'center' }}>No external environmental factors recorded.</div>
                )}
              </div>

              {/* Components */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Component States <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 500 }}>({recordDetail.components.length})</span></h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recordDetail.components.slice(0, 100).map((c: any, i: number) => (
                    <div key={i} className="diag-row glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderRadius: 10, border: '1px solid var(--border-solid)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, letterSpacing: '-0.3px' }}>{c.component_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--accent-amber)', marginTop: 4, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{c.type}</div>
                      </div>
                      <div style={{ width: 120, paddingRight: 24 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Status</div>
                        <div style={{ 
                          fontSize: 12, fontWeight: 700, display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                          backgroundColor: c.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : c.status === 'failure' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                          color: c.status === 'active' ? '#10b981' : c.status === 'failure' ? '#ef4444' : 'var(--text-secondary)' 
                        }}>
                          {c.status}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, flex: 2, paddingLeft: 16 }}>
                        {Object.entries(c.value_json || {}).map(([key, val]: [string, any]) => (
                          <div key={key} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', minWidth: 120 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontWeight: 600 }}>{key}</div>
                            {typeof val === 'object' && val !== null ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {Object.entries(val).map(([subKey, subVal]) => (
                                  <div key={subKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 2 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{subKey}</span>
                                    <span style={{ color: '#fff' }}>{String(subVal)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)' }}>{String(val)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {recordDetail.components.length > 100 && (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
                      ... and {recordDetail.components.length - 100} more components
                    </div>
                  )}
                </div>
              </div>

              {/* Connections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Connection States <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 500 }}>({recordDetail.connections.length})</span></h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recordDetail.connections.slice(0, 100).map((c: any, i: number) => (
                    <div key={i} className="diag-row glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderRadius: 10, border: '1px solid var(--border-solid)' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.source_name}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)', position: 'relative' }}>
                          <div style={{ position: 'absolute', right: -4, top: -4, color: 'var(--text-tertiary)' }}>→</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.target_name}</span>
                      </div>
                      <div style={{ width: 140, fontSize: 11, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, textAlign: 'center' }}>
                        {c.type}
                      </div>
                      <div style={{ 
                        width: 90, textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '4px 0', borderRadius: 20,
                        backgroundColor: c.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : c.status === 'failure' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                        color: c.status === 'active' ? '#10b981' : c.status === 'failure' ? '#ef4444' : 'var(--text-secondary)' 
                      }}>
                        {c.status}
                      </div>
                    </div>
                  ))}
                  {recordDetail.connections.length > 100 && (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
                      ... and {recordDetail.connections.length - 100} more connections
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              <HardDrive size={64} style={{ opacity: 0.1, marginBottom: 24 }} />
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)' }}>No Snapshot Selected</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>Select a record from the timeline to view its diagnostic state.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
