import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Header & Filters */}
      <div style={{ display: 'flex', gap: 16, padding: '12px 24px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>History & Diagnostics</h2>
        
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          <label htmlFor="source-filter" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Source:</label>
          <select 
            id="source-filter"
            value={sourceFilter} 
            onChange={e => setSourceFilter(e.target.value)}
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', borderRadius: 4, padding: '4px 8px' }}
          >
            <option value="ALL">All</option>
            <option value="SIMULATION">Simulation</option>
            <option value="PHYSICAL">Physical</option>
          </select>
          
          <label htmlFor="run-filter" style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 16 }}>Run:</label>
          <select 
            id="run-filter"
            value={selectedRun} 
            onChange={e => setSelectedRun(e.target.value)}
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', borderRadius: 4, padding: '4px 8px' }}
          >
            <option value="">All Runs</option>
            {runs.filter(r => r.station_id === selectedStation).map(r => (
              <option key={r.run_id} value={r.run_id}>{r.run_id}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Timeline / Table */}
        <div style={{ width: '40%', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel-secondary)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex' }}>
            <div style={{ width: 80 }}>Time</div>
            <div style={{ width: 80 }}>Source</div>
            <div style={{ flex: 1 }}>Run ID</div>
            <div style={{ width: 60, textAlign: 'right' }}>Comps</div>
            <div style={{ width: 60, textAlign: 'right' }}>Conns</div>
            <div style={{ width: 30 }}></div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredHistory.map(r => (
              <div 
                key={r.id} 
                onClick={() => setSelectedRecordId(r.id)}
                style={{ 
                  display: 'flex', 
                  padding: '10px 16px', 
                  borderBottom: '1px solid var(--border-solid)', 
                  cursor: 'pointer',
                  fontSize: 13,
                  backgroundColor: selectedRecordId === r.id ? 'var(--hover-overlay)' : 'transparent',
                  color: 'var(--text-primary)'
                }}
              >
                <div style={{ width: 80, fontFamily: 'monospace' }}>{r.simulation_time.toFixed(2)}s</div>
                <div style={{ width: 80 }}>
                  <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 10, backgroundColor: r.source === 'SIMULATION' ? '#3b82f640' : '#10b98140', color: r.source === 'SIMULATION' ? '#60a5fa' : '#34d399' }}>
                    {r.source.substring(0, 3)}
                  </span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>{r.run_id}</div>
                <div style={{ width: 60, textAlign: 'right', opacity: 0.7 }}>{r.component_count}</div>
                <div style={{ width: 60, textAlign: 'right', opacity: 0.7 }}>{r.connection_count}</div>
                <div style={{ width: 30, textAlign: 'right' }}>
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
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    title="Delete Record"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {filteredHistory.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                No telemetry records found.
              </div>
            )}
          </div>
        </div>

        {/* Record Detail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)', overflowY: 'auto', padding: 24 }}>
          {recordDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto', width: '100%' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: 'var(--bg-panel)', padding: 20, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Record Summary</h3>
                  <button 
                    onClick={async () => {
                      if (confirm('Delete this record?')) {
                        await api.deleteTelemetryRecord(recordDetail.id);
                        setHistory(h => h.filter(x => x.id !== recordDetail.id));
                        setRecordDetail(null);
                        setSelectedRecordId(null);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    title="Delete Record"
                  >
                    Delete Record
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Record ID: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{recordDetail.id}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Run ID: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{recordDetail.run_id}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Simulation Time: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{recordDetail.time.toFixed(3)} s</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Persistence Time: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{new Date(recordDetail.persistence_time * 1000).toLocaleString()}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Source: <span style={{ color: 'var(--text-primary)' }}>{recordDetail.source}</span></div>
                </div>
              </div>

              {/* External Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)' }}>External Environment</h3>
                {recordDetail.external && Object.keys(recordDetail.external).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {Object.entries(recordDetail.external).map(([key, val]: [string, any]) => (
                      <div key={key} style={{ backgroundColor: 'var(--bg-panel-secondary)', padding: '12px 16px', borderRadius: 6, border: '1px solid var(--border-solid)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{key}</div>
                        {typeof val === 'object' && val !== null ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                            {Object.entries(val).map(([subKey, subVal]) => (
                              <div key={subKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{subKey}:</span>
                                <span style={{ color: 'var(--text-primary)' }}>{String(subVal)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{String(val)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No external fields in this record.</div>
                )}
              </div>

              {/* Components */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)' }}>Components State ({recordDetail.components.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recordDetail.components.slice(0, 100).map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-panel)', padding: '10px 16px', borderRadius: 6, border: '1px solid var(--border-solid)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{c.component_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.type}</div>
                      </div>
                      <div style={{ marginRight: 24, textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Status</div>
                        <div style={{ fontSize: 13, color: c.status === 'active' ? '#10b981' : c.status === 'failure' ? '#ef4444' : 'var(--text-secondary)' }}>
                          {c.status}
                        </div>
                      </div>
                      <div style={{ width: 250, textAlign: 'right', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(c.value_json)}
                      </div>
                    </div>
                  ))}
                  {recordDetail.components.length > 100 && (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      ... and {recordDetail.components.length - 100} more components
                    </div>
                  )}
                </div>
              </div>

              {/* Connections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)' }}>Connections State ({recordDetail.connections.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recordDetail.connections.slice(0, 100).map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-panel)', padding: '10px 16px', borderRadius: 6, border: '1px solid var(--border-solid)' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.source_name}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.target_name}</span>
                      </div>
                      <div style={{ width: 100, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        {c.type}
                      </div>
                      <div style={{ width: 80, textAlign: 'right', fontSize: 13, color: c.status === 'active' ? '#10b981' : c.status === 'failure' ? '#ef4444' : 'var(--text-secondary)' }}>
                        {c.status}
                      </div>
                    </div>
                  ))}
                  {recordDetail.connections.length > 100 && (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      ... and {recordDetail.connections.length - 100} more connections
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Select a record from the timeline to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
