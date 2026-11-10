import React, { useState, useEffect, useMemo } from 'react';
import { GitCompare, AlertTriangle, CheckCircle, ArrowRight, X, Layers, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { Dropdown } from './Dropdown';

interface ScenarioComparisonProps {
  stationId: string;
  onClose?: () => void;
}

export function ScenarioComparison({ stationId, onClose }: ScenarioComparisonProps) {
  const [runs, setRuns] = useState<{ run_id: string; station_id: string; scenario_id?: string }[]>([]);
  const [runA, setRunA] = useState<string>('');
  const [runB, setRunB] = useState<string>('');
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);

  const fetchRuns = () => {
    setIsLoadingRuns(true);
    api.getTelemetryRuns()
      .then((r) => {
        setRuns(r.filter((x: any) => x.station_id === stationId || x.station_model_id === stationId));
      })
      .catch(console.error)
      .finally(() => setIsLoadingRuns(false));
  };

  useEffect(() => {
    fetchRuns();
  }, [stationId]);

  useEffect(() => {
    if (runA) {
      api.getTelemetryHistory(stationId, runA).then((hist) => {
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
      api.getTelemetryHistory(stationId, runB).then((hist) => {
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

    compMap.forEach((cid) => {
      const cA = compsA.find((c: any) => c.component_id === cid);
      const cB = compsB.find((c: any) => c.component_id === cid);

      if (!cA) componentsDiff.push({ id: cid, type: 'missing_in_A', cA: null, cB });
      else if (!cB) componentsDiff.push({ id: cid, type: 'missing_in_B', cA, cB: null });
      else {
        if (cA.status !== cB.status) {
          componentsDiff.push({ id: cid, type: 'status_diff', cA, cB });
        } else if (JSON.stringify(cA.state) !== JSON.stringify(cB.state)) {
          componentsDiff.push({ id: cid, type: 'value_diff', cA, cB });
        }
      }
    });

    // Compare connections
    const connsA = dataA.connections || [];
    const connsB = dataB.connections || [];
    const connMap = new Set([...connsA.map((c: any) => c.connection_id), ...connsB.map((c: any) => c.connection_id)]);

    connMap.forEach((cid) => {
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
    <div
      style={{
        padding: '20px',
        height: '100%',
        overflowY: 'auto',
        color: 'var(--text-primary, #f1f5f9)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header bar with controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '6px',
              backgroundColor: 'rgba(167, 139, 250, 0.15)',
              border: '1px solid rgba(167, 139, 250, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a78bfa',
            }}
          >
            <GitCompare size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>
              Scenario A/B Differential Inspection
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #94a3b8)' }}>
              Compare component health and fluid/electrical flows between two simulation runs
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary, #38d9f5)', letterSpacing: '0.04em' }}>
            Scenario A (Run ID)
          </label>
          <div style={{ marginTop: '6px' }}>
            <Dropdown
              value={runA}
              onChange={(val) => setRunA(val)}
              options={runs.map((r) => ({
                value: r.run_id,
                label: `${r.scenario_id ? `[${r.scenario_id}] ` : ''}${r.run_id.slice(0, 16)}...`,
              }))}
              placeholder="-- Select Run A --"
              style={{ width: '100%', height: 34 }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan, #06b6d4)', letterSpacing: '0.04em' }}>
            Scenario B (Run ID)
          </label>
          <div style={{ marginTop: '6px' }}>
            <Dropdown
              value={runB}
              onChange={(val) => setRunB(val)}
              options={runs.map((r) => ({
                value: r.run_id,
                label: `${r.scenario_id ? `[${r.scenario_id}] ` : ''}${r.run_id.slice(0, 16)}...`,
              }))}
              placeholder="-- Select Run B --"
              style={{ width: '100%', height: 34 }}
            />
          </div>
        </div>
      </div>

      {!dataA || !dataB ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--text-tertiary, #94a3b8)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color, rgba(255, 255, 255, 0.1))',
          }}
        >
          <GitCompare size={36} style={{ color: 'var(--text-tertiary, #94a3b8)', opacity: 0.5, marginBottom: '12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Select two runs to compare their final states.</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Execute simulation runs with recording enabled to build telemetry history for comparative analysis.
          </div>
        </div>
      ) : diff && diff.componentsDiff.length === 0 && diff.connectionsDiff.length === 0 ? (
        <div
          style={{
            padding: '30px',
            textAlign: 'center',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '8px',
            color: '#10b981',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={28} />
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Identical Operational State</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #cbd5e1)' }}>
            No status, state, or flow differences found between Run A and Run B.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {diff && diff.componentsDiff.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--accent-primary, #38d9f5)',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Layers size={14} />
                Component Divergences ({diff.componentsDiff.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {diff.componentsDiff.map((d: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 1fr 1fr',
                      gap: '16px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#fff' }}>
                      @{d.id}
                    </div>

                    {/* Run A */}
                    <div style={{ borderRight: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))', paddingRight: '12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 2 }}>
                        Run A
                      </div>
                      {d.cA ? (
                        <div>
                          Status:{' '}
                          <span style={{ fontWeight: 700, color: d.cA.status === 'failure' ? '#ef4444' : '#10b981' }}>
                            {d.cA.status.toUpperCase()}
                          </span>
                          {d.cA.state && Object.keys(d.cA.state).length > 0 && (
                            <div style={{ color: 'var(--text-secondary, #cbd5e1)', marginTop: 2, fontFamily: 'monospace' }}>
                              {JSON.stringify(d.cA.state)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#ef4444' }}>Missing</span>
                      )}
                    </div>

                    {/* Run B */}
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 2 }}>
                        Run B
                      </div>
                      {d.cB ? (
                        <div>
                          Status:{' '}
                          <span style={{ fontWeight: 700, color: d.cB.status === 'failure' ? '#ef4444' : '#10b981' }}>
                            {d.cB.status.toUpperCase()}
                          </span>
                          {d.cB.state && Object.keys(d.cB.state).length > 0 && (
                            <div style={{ color: 'var(--text-secondary, #cbd5e1)', marginTop: 2, fontFamily: 'monospace' }}>
                              {JSON.stringify(d.cB.state)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#ef4444' }}>Missing</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff && diff.connectionsDiff.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#f8d57e',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Connection & Flow Divergences ({diff.connectionsDiff.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {diff.connectionsDiff.map((d: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 1fr 1fr',
                      gap: '16px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#fff' }}>
                      {d.id}
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 2 }}>
                        Run A
                      </div>
                      {d.cA ? (
                        <div>
                          Status: <span style={{ fontWeight: 700, color: d.cA.status === 'failure' ? '#ef4444' : '#10b981' }}>{d.cA.status}</span>
                          <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>Flow: {d.cA.flow_rate}</span>
                        </div>
                      ) : <span style={{ color: '#ef4444' }}>Missing</span>}
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', marginBottom: 2 }}>
                        Run B
                      </div>
                      {d.cB ? (
                        <div>
                          Status: <span style={{ fontWeight: 700, color: d.cB.status === 'failure' ? '#ef4444' : '#10b981' }}>{d.cB.status}</span>
                          <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>Flow: {d.cB.flow_rate}</span>
                        </div>
                      ) : <span style={{ color: '#ef4444' }}>Missing</span>}
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
