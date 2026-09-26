import React, { useState, useEffect, useMemo } from 'react';
import { GitCompare } from 'lucide-react';
import { api } from '../lib/api';

export function ScenarioComparison({ stationId }: { stationId: string }) {
  const [runs, setRuns] = useState<{run_id: string, station_id: string}[]>([]);
  const [runA, setRunA] = useState<string>('');
  const [runB, setRunB] = useState<string>('');
  
  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);

  useEffect(() => {
    api.getTelemetryRuns().then(r => setRuns(r.filter((x: any) => x.station_id === stationId))).catch(console.error);
  }, [stationId]);

  useEffect(() => {
    if (runA) {
      api.getTelemetryHistory(stationId, runA).then(hist => {
        if (hist.length > 0) {
          api.getTelemetryRecord(hist[hist.length - 1].id).then(setDataA);
        } else {
          setDataA(null);
        }
      });
    } else {
      setDataA(null);
    }
  }, [runA, stationId]);

  useEffect(() => {
    if (runB) {
      api.getTelemetryHistory(stationId, runB).then(hist => {
        if (hist.length > 0) {
          api.getTelemetryRecord(hist[hist.length - 1].id).then(setDataB);
        } else {
          setDataB(null);
        }
      });
    } else {
      setDataB(null);
    }
  }, [runB, stationId]);

  const diff = useMemo(() => {
    if (!dataA || !dataB) return null;
    const componentsDiff: any[] = [];
    const connectionsDiff: any[] = [];

    // Compare components
    const compsA = dataA.components || [];
    const compsB = dataB.components || [];
    const compMap = new Set([...compsA.map((c: any) => c.component_id), ...compsB.map((c: any) => c.component_id)]);
    
    compMap.forEach(cid => {
      const cA = compsA.find((c: any) => c.component_id === cid);
      const cB = compsB.find((c: any) => c.component_id === cid);
      
      if (!cA) componentsDiff.push({ id: cid, type: 'missing_in_A', cA: null, cB });
      else if (!cB) componentsDiff.push({ id: cid, type: 'missing_in_B', cA, cB: null });
      else {
        if (cA.status !== cB.status) {
          componentsDiff.push({ id: cid, type: 'status_diff', cA, cB });
        } else {
          if (JSON.stringify(cA.state) !== JSON.stringify(cB.state)) {
             componentsDiff.push({ id: cid, type: 'value_diff', cA, cB });
          }
        }
      }
    });

    // Compare connections
    const connsA = dataA.connections || [];
    const connsB = dataB.connections || [];
    const connMap = new Set([...connsA.map((c: any) => c.connection_id), ...connsB.map((c: any) => c.connection_id)]);
    
    connMap.forEach(cid => {
      const cA = connsA.find((c: any) => c.connection_id === cid);
      const cB = connsB.find((c: any) => c.connection_id === cid);
      
      if (!cA) connectionsDiff.push({ id: cid, type: 'missing_in_A', cA: null, cB });
      else if (!cB) connectionsDiff.push({ id: cid, type: 'missing_in_B', cA, cB: null });
      else {
        if (cA.status !== cB.status || cA.flow_rate !== cB.flow_rate) {
          connectionsDiff.push({ id: cid, type: 'status_diff', cA, cB });
        }
      }
    });

    return { componentsDiff, connectionsDiff };
  }, [dataA, dataB]);

  return (
    <div style={{ padding: '16px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-secondary)' }}>Scenario A (Run ID)</label>
          <select 
            value={runA} onChange={e => setRunA(e.target.value)}
            style={{ width: '100%', marginTop: 4, padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
          >
            <option value="">-- Select Run A --</option>
            {runs.map(r => <option key={r.run_id} value={r.run_id}>{r.run_id}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-secondary)' }}>Scenario B (Run ID)</label>
          <select 
            value={runB} onChange={e => setRunB(e.target.value)}
            style={{ width: '100%', marginTop: 4, padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
          >
            <option value="">-- Select Run B --</option>
            {runs.map(r => <option key={r.run_id} value={r.run_id}>{r.run_id}</option>)}
          </select>
        </div>
      </div>

      {!dataA || !dataB ? (
        <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 40 }}>
          Select two runs to compare their final states.
        </div>
      ) : diff && (diff.componentsDiff.length === 0 && diff.connectionsDiff.length === 0) ? (
        <div style={{ color: '#10b981', textAlign: 'center', marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <GitCompare size={20} />
          <span>No differences found between the two scenarios at their latest state.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {diff?.componentsDiff.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Component Differences</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {diff.componentsDiff.map((d: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 16, background: 'var(--bg-panel)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    <div style={{ width: 120, fontWeight: 'bold', color: 'var(--text-secondary)' }}>{d.id}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Run A</div>
                      {d.cA ? (
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                          Status: <span style={{ color: d.cA.status === 'FAILURE' ? '#ef4444' : '#10b981' }}>{d.cA.status}</span>
                          <br/>
                          State: {JSON.stringify(d.cA.state)}
                        </div>
                      ) : <span style={{ color: '#ef4444', fontSize: 12 }}>Missing</span>}
                    </div>
                    <div style={{ width: 1, background: 'var(--border-color)' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Run B</div>
                      {d.cB ? (
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                          Status: <span style={{ color: d.cB.status === 'FAILURE' ? '#ef4444' : '#10b981' }}>{d.cB.status}</span>
                          <br/>
                          State: {JSON.stringify(d.cB.state)}
                        </div>
                      ) : <span style={{ color: '#ef4444', fontSize: 12 }}>Missing</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff?.connectionsDiff.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Connection Differences</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {diff.connectionsDiff.map((d: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 16, background: 'var(--bg-panel)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    <div style={{ width: 120, fontWeight: 'bold', color: 'var(--text-secondary)' }}>{d.id}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Run A</div>
                      {d.cA ? (
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                          Status: <span style={{ color: d.cA.status === 'FAILURE' ? '#ef4444' : '#10b981' }}>{d.cA.status}</span>
                          <br/>
                          Flow: {d.cA.flow_rate}
                        </div>
                      ) : <span style={{ color: '#ef4444', fontSize: 12 }}>Missing</span>}
                    </div>
                    <div style={{ width: 1, background: 'var(--border-color)' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Run B</div>
                      {d.cB ? (
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                          Status: <span style={{ color: d.cB.status === 'FAILURE' ? '#ef4444' : '#10b981' }}>{d.cB.status}</span>
                          <br/>
                          Flow: {d.cB.flow_rate}
                        </div>
                      ) : <span style={{ color: '#ef4444', fontSize: 12 }}>Missing</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
