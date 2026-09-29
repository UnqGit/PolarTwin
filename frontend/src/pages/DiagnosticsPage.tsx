import { useState, useEffect, useMemo } from 'react';
import { useStation } from '../components/StationContext';
import { api } from '../lib/api';
import {
  ChevronDown, ChevronRight, Activity, Cloud, Signal, Droplets, History, Box, Globe
} from 'lucide-react';
import { buildSceneLayout, type NodeLayout } from '../lib/layout';
import { SelectionProvider } from '../components/SelectionContext';
import { HierarchyPanel } from '../components/HierarchyPanel';

export function DiagnosticsPage() {
  const { hierarchy, connections, spec } = useStation();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runMeta, setRunMeta] = useState<any>(null);
  const [runEvents, setRunEvents] = useState<any[]>([]);
  const [runLogs, setRunLogs] = useState<any[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<'connections' | 'components' | 'environment' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);

  const [selectedName, setSelectedName] = useState<string | null>(null);

  const sceneLayout = useMemo(() => {
    if (!hierarchy || !spec) return null;
    const layout = buildSceneLayout(hierarchy, connections || [], spec);
    // @ts-ignore
    const gen = layout.connectionRouterGenerator();
    while (!gen.next().done) { }
    return layout;
  }, [hierarchy, connections, spec]);

  useEffect(() => {
    if (selectedName) {
      if (selectedName.includes('--')) {
        setSelectedCategory('connections');
        setSelectedItemId(selectedName);
      } else {
        setSelectedCategory('components');
        setSelectedItemId(selectedName);
      }
    }
  }, [selectedName]);

  // Load runs
  useEffect(() => {
    api.getTelemetryRuns().then(r => {
      setRuns(r.filter((run: any) => run.status !== 'RUNNING'));
    }).catch(console.error);
  }, []);

  // When run selected
  useEffect(() => {
    if (!selectedRunId) {
      setRunMeta(null);
      setRunEvents([]);
      setHistoryData([]);
      return;
    }
    api.getRunMetadata(selectedRunId).then(setRunMeta).catch(console.error);
    api.getRunEvents(selectedRunId).then(setRunEvents).catch(console.error);
    api.getSimulationLog(selectedRunId).then(setRunLogs).catch(console.error);

    // Refresh history data if category/item is already selected
    if (selectedCategory && selectedItemId) {
      fetchHistory(selectedCategory, selectedItemId);
    } else {
      setHistoryData([]);
    }
  }, [selectedRunId]);

  // When category/item selected
  useEffect(() => {
    if (selectedRunId && selectedCategory && selectedItemId) {
      fetchHistory(selectedCategory, selectedItemId);
    }
  }, [selectedCategory, selectedItemId]);

  const fetchHistory = async (category: string, itemId: string) => {
    try {
      if (category === 'environment') {
        const data = await api.getExternalHistory(selectedRunId);
        setHistoryData(data);
      } else if (category === 'connections') {
        const data = await api.getConnectionHistory(selectedRunId, itemId);
        setHistoryData(data);
      } else if (category === 'components') {
        const data = await api.getComponentHistory(selectedRunId, itemId);
        setHistoryData(data);
      }
    } catch (err) {
      console.error(err);
      setHistoryData([]);
    }
  };

  // Node tree component
  const TreeNode = ({ node, depth }: { node: NodeLayout; depth: number }) => {
    const [expanded, setExpanded] = useState(depth < 2);
    const isLeaf = !node.children || node.children.length === 0;
    const isSelected = selectedCategory === 'components' && selectedItemId === node.name;

    return (
      <div style={{ marginLeft: depth > 0 ? 12 : 0 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
            cursor: 'pointer', borderRadius: 4,
            background: isSelected ? 'var(--bg-input)' : 'transparent',
            color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)'
          }}
          onClick={() => {
            if (!isLeaf) setExpanded(!expanded);
            setSelectedCategory('components');
            setSelectedItemId(node.name);
          }}
        >
          {!isLeaf ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div style={{ width: 14 }} />
          )}
          <Box size={14} />
          <span style={{ fontSize: 13, userSelect: 'none' }}>{node.name}</span>
        </div>
        {expanded && !isLeaf && (
          <div>
            {node.children.map(c => <TreeNode key={c.name} node={c} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>

      {/* RUN SELECTOR */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <History size={20} style={{ color: 'var(--accent-blue)' }} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Simulation History</h2>

        <select
          value={selectedRunId}
          onChange={e => setSelectedRunId(e.target.value)}
          style={{
            background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
            padding: '6px 12px', borderRadius: 6, fontSize: 13, outline: 'none', minWidth: 250
          }}
        >
          <option value="">-- Select a Simulation Run --</option>
          {runs.map(r => (
            <option key={r.run_id} value={r.run_id}>
              {new Date(r.start_time * 1000).toLocaleString()} | {r.run_id.substring(0, 8)} | {r.status}
            </option>
          ))}
        </select>

        {runMeta && (
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span><strong>Scenario:</strong> {runMeta.scenario_id || 'Manual'}</span>
            <span><strong>Duration:</strong> {runMeta.end_time ? Math.round(runMeta.end_time - runMeta.start_time) + 's' : 'Ongoing'}</span>
            <span><strong>Status:</strong> {runMeta.status}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {sceneLayout && (
          <SelectionProvider externalSelection={[selectedName, setSelectedName]}>
            <HierarchyPanel
              root={sceneLayout.root}
              connections={sceneLayout.connections}
              componentsInteractable={true}
              connectionsInteractable={true}
              hideEditInitials={true}
              hideSettings={true}
              hideSensors={true}
              customSidebarTabs={[
                {
                  id: 'external',
                  title: 'External Environment',
                  icon: <Globe size={20} />,
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 16, pointerEvents: 'auto' }}>
                      {[
                        { id: 'weather', label: 'Weather', icon: Cloud },
                        { id: 'network', label: 'Network', icon: Signal },
                        { id: 'supplies', label: 'Supplies', icon: Droplets }
                      ].map(env => (
                        <div
                          key={env.id}
                          onClick={() => { setSelectedCategory('environment'); setSelectedItemId(env.id); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 4,
                            background: selectedCategory === 'environment' && selectedItemId === env.id ? 'var(--bg-input)' : 'transparent',
                            color: selectedCategory === 'environment' && selectedItemId === env.id ? 'var(--accent-blue)' : 'var(--text-secondary)'
                          }}
                        >
                          <env.icon size={14} />
                          <span style={{ fontSize: 13 }}>{env.label}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              ]}
            />
          </SelectionProvider>
        )}

        {/* RIGHT MAIN AREA */}
        <div style={{ flex: 1, padding: 24, paddingLeft: 400, overflowY: 'auto' }}>


          {!selectedRunId ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Select a simulation run to view historical data.
            </div>
          ) : !selectedCategory ? (
            <div>
              <h2 style={{ marginTop: 0 }}>Simulation Report</h2>
              <div style={{ background: 'var(--bg-panel)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 14 }}>Run Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div><strong>Run ID:</strong> {runMeta?.id}</div>
                  <div><strong>Station:</strong> {runMeta?.station_model_id}</div>
                  <div><strong>Scenario:</strong> {runMeta?.scenario_id || 'Manual'}</div>
                  <div><strong>Status:</strong> {runMeta?.status}</div>
                  <div><strong>Start Time:</strong> {runMeta?.start_time ? new Date(runMeta.start_time * 1000).toLocaleString() : 'N/A'}</div>
                  <div><strong>End Time:</strong> {runMeta?.end_time ? new Date(runMeta.end_time * 1000).toLocaleString() : 'Ongoing'}</div>
                  <div><strong>Duration:</strong> {runMeta?.start_time && runMeta?.end_time ? `${(runMeta.end_time - runMeta.start_time).toFixed(1)}s` : 'N/A'}</div>
                  <div><strong>Total Events:</strong> {runEvents.length}</div>
                  <div><strong>Total Records:</strong> {runMeta?.record_count}</div>
                </div>
              </div>

              <h3 style={{ fontSize: 14 }}>Event Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {runEvents.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', gap: 16, fontSize: 13, padding: 12, background: 'var(--bg-input)', borderRadius: 6 }}>
                    <div style={{ width: 80, color: 'var(--text-tertiary)' }}>{formatTime(ev.simulation_time)}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{ev.source}</div>
                  </div>
                ))}
                {runEvents.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No events recorded for this run.</div>}
              </div>

              <h3 style={{ fontSize: 14 }}>Logs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-input)', padding: 12, borderRadius: 6, maxHeight: 400, overflowY: 'auto' }}>
                {runLogs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : 'var(--text-primary)' }}>
                    <div style={{ width: 80, color: 'var(--text-tertiary)' }}>{formatTime(log.time || 0)}</div>
                    <div>[{log.level}] {log.message}</div>
                  </div>
                ))}
                {runLogs.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>No logs recorded for this run.</div>}
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={24} style={{ color: 'var(--accent-blue)' }} />
                {selectedItemId} Historical Diagnostics
              </h2>

              {historyData.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-panel)', borderRadius: 8 }}>
                  No historical telemetry is available for this selection.
                </div>
              ) : (
                <>
                  <ComponentReportOverview data={historyData} category={selectedCategory} itemId={selectedItemId!} />
                  <MultiMetricCharts data={historyData} category={selectedCategory} itemId={selectedItemId!} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComponentReportOverview({ data, category, itemId }: { data: any[]; category: string; itemId: string }) {
  const lastState = data[data.length - 1];
  const failures = data.filter((r, i) => {
    const prev = data[i - 1];
    return (r.status === 'failure' || r.status === 'FAILURE') && (!prev || prev.status !== r.status);
  });

  return (
    <div style={{ background: 'var(--bg-panel)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 14 }}>{category === 'connections' ? 'Connection Summary' : 'Component Summary'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
        <div><strong>Name:</strong> {itemId}</div>
        <div><strong>Type:</strong> {category}</div>
        <div><strong>Final Status:</strong> <span style={{ color: lastState?.status === 'failure' ? '#ef4444' : lastState?.status === 'active' ? '#4ade80' : 'inherit' }}>{lastState?.status || 'unknown'}</span></div>
        <div><strong>Total Failure Events:</strong> {failures.length}</div>
        <div><strong>Records (Telemetry points):</strong> {data.length}</div>
      </div>
    </div>
  );
}

function MultiMetricCharts({ data, category, itemId }: { data: any[]; category: string; itemId: string }) {
  const metrics = useMemo(() => {
    const keys = new Set<string>();
    const ignoreKeys = ['dummy', 'length', 'width', 'breadth', 'height', 'unit', 'inputs', 'status', 'rating', 'id', 'name', 'type', 'position', 'rotation', 'scale', 'measures', 'tolerance', 'efficiency'];

    data.forEach(row => {
      let values: any = {};
      if (category === 'environment') {
        if (itemId === 'weather' && row.external?.weather) values = row.external.weather;
        if (itemId === 'network' && row.external?.network) values = row.external.network;
        if (itemId === 'supplies' && row.external?.supplies) values = row.external.supplies;
      } else {
        values = row.value || {};
      }

      Object.keys(values).forEach(k => {
        if (ignoreKeys.includes(k.toLowerCase()) || k.toLowerCase().startsWith('failure_time')) return;
        if (typeof values[k] === 'number') keys.add(k);
        if (typeof values[k] === 'object' && values[k]?.value !== undefined) keys.add(k);
      });
    });
    return Array.from(keys);
  }, [data, category, itemId]);

  if (metrics.length === 0) {
    return <div style={{ color: 'var(--text-tertiary)' }}>No plottable numeric metrics found in rating fields.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 32 }}>
        {metrics.map(metric => (
          <MetricChart key={metric} metric={metric} data={data} category={category} itemId={itemId} />
        ))}
      </div>
    </div>
  );
}

import { formatTime } from '../utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function MetricChart({ metric, data, category, itemId }: { metric: string; data: any[]; category: string; itemId: string }) {
  const points = useMemo(() => {
    return data.map(row => {
      let val = null;
      let unit = '';
      if (category === 'environment') {
        if (itemId === 'weather' && row.external?.weather) val = row.external.weather[metric];
        if (itemId === 'network' && row.external?.network) val = row.external.network[metric];
        if (itemId === 'supplies' && row.external?.supplies) val = row.external.supplies[metric];
      } else {
        val = row.value?.[metric];
      }

      if (val !== null && typeof val === 'object' && val.value !== undefined) {
        unit = val.unit || '';
        val = val.value;
      }

      return { time: row.time, value: val, unit, status: row.status };
    }).filter(p => p.value !== null && typeof p.value === 'number');
  }, [data, metric, category, itemId]);

  if (points.length === 0) return null;

  const unit = points[0]?.unit || '';

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, width: 550 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 14, textTransform: 'capitalize' }}>
        {metric.replace(/_/g, ' ')} {unit ? `(${unit})` : ''}
      </h3>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => formatTime(v)}
              stroke="var(--text-tertiary)"
              tick={{ fontSize: 11 }}
              dy={10}
            />
            <YAxis
              stroke="var(--text-tertiary)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(1)}
              domain={['auto', 'auto']}
              dx={-10}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, color: 'var(--text-primary)' }}
              itemStyle={{ color: 'var(--accent-blue)' }}
              labelFormatter={(label) => `Time: ${formatTime(Number(label))}`}
              formatter={(value: any) => [`${Number(value).toFixed(2)}${unit}`, metric.replace(/_/g, ' ')]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent-blue)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--accent-blue)' }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {points.some(p => p.status) && (
        <>
          <div style={{ position: 'relative', height: 6, margin: '0 20px 16px 20px', display: 'flex', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            {points.map((p, i) => {
              const nextP = points[i + 1];
              const duration = nextP ? nextP.time - p.time : (points.length > 1 ? p.time - points[i - 1].time : 1);
              const totalDuration = points[points.length - 1].time - points[0].time || 1;
              const widthPct = (duration / totalDuration) * 100;
              let bg = '#94a3b8'; // inactive
              if (p.status === 'active' || p.status === 'ACTIVE') bg = '#4ade80';
              if (p.status === 'failure' || p.status === 'FAILURE') bg = '#ef4444';
              return (
                <div
                  key={i}
                  style={{ width: `${widthPct}%`, height: '100%', backgroundColor: bg }}
                  title={`Time: ${p.time.toFixed(2)}h - Status: ${p.status}`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%' }}></div> Active</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#94a3b8', borderRadius: '50%' }}></div> Inactive</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}></div> Failure</div>
          </div>
        </>
      )}
    </div>
  );
}

