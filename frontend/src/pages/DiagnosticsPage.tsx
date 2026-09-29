import React, { useState, useEffect, useMemo } from 'react';
import { useStation } from '../components/StationContext';
import { api } from '../lib/api';
import { 
  ChevronDown, ChevronRight, Activity, Cloud, Signal, Droplets, History, Box, Network, Link2, Globe
} from 'lucide-react';
import { buildSceneLayout } from '../lib/layout';
import { SelectionProvider } from '../components/SelectionContext';
import { HierarchyPanel } from '../components/HierarchyPanel';

export function DiagnosticsPage() {
  const { selectedStation, hierarchy, connections, spec } = useStation();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runMeta, setRunMeta] = useState<any>(null);
  const [runEvents, setRunEvents] = useState<any[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<'connections' | 'components' | 'environment' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);

  const [selectedName, setSelectedName] = useState<string | null>(null);

  const sceneLayout = useMemo(() => {
    if (!hierarchy || !spec) return null;
    const layout = buildSceneLayout(hierarchy, connections || [], spec);
    const gen = layout.connectionRouterGenerator();
    while (!gen.next().done) {}
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
    api.getTelemetryRuns().then(r => setRuns(r)).catch(console.error);
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
      } else if (category === 'components' || category === 'connections') {
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
            expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>
          ) : (
            <div style={{width: 14}}/>
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
              {new Date(r.start_time * 1000).toLocaleString()} | {r.run_id.substring(0,8)} | {r.status}
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
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Total Events: {runEvents.length} <br/>
                  Total Records: {runMeta?.record_count}
                </p>
              </div>
              
              <h3 style={{ fontSize: 14 }}>Event Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runEvents.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', gap: 16, fontSize: 13, padding: 12, background: 'var(--bg-input)', borderRadius: 6 }}>
                    <div style={{ width: 60, color: 'var(--text-tertiary)' }}>{(ev.simulation_time).toFixed(2)}h</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{ev.source}</div>
                  </div>
                ))}
                {runEvents.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No events recorded for this run.</div>}
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
                <MultiMetricCharts data={historyData} category={selectedCategory} itemId={selectedItemId!} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MultiMetricCharts({ data, category, itemId }: { data: any[]; category: string; itemId: string }) {
  const metrics = useMemo(() => {
    const keys = new Set<string>();
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
        if (typeof values[k] === 'number') keys.add(k);
        if (typeof values[k] === 'object' && values[k]?.value !== undefined) keys.add(k);
      });
    });
    return Array.from(keys);
  }, [data, category, itemId]);

  if (metrics.length === 0) {
    return <div style={{ color: 'var(--text-tertiary)' }}>No plottable numeric metrics found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 32 }}>
      {metrics.map(metric => (
        <MetricChart key={metric} metric={metric} data={data} category={category} itemId={itemId} />
      ))}
    </div>
  );
}

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
  const times = points.map(p => p.time);
  const values = points.map(p => p.value);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const rangeTime = Math.max(0.1, maxTime - minTime);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const rangeVal = Math.max(0.1, maxVal - minVal);

  const W = 450;
  const H = 180;
  const padLeft = 60;
  const padBottom = 60;
  const padTop = 20;
  const padRight = 20;

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 14, textTransform: 'capitalize' }}>
        {metric.replace(/_/g, ' ')} {unit ? `(${unit})` : ''}
      </h3>
      
      <div style={{ position: 'relative', width: W + padLeft + padRight, height: H + padBottom + padTop }}>
        <svg width={W + padLeft + padRight} height={H + padBottom + padTop}>
          {/* Axes */}
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={H + padTop} stroke="var(--border-color)" strokeWidth={2} />
          <line x1={padLeft} y1={H + padTop} x2={W + padLeft} y2={H + padTop} stroke="var(--border-color)" strokeWidth={2} />
          
          {/* Axis Labels */}
          <text x={padLeft / 2} y={padTop + H / 2} fill="var(--text-tertiary)" fontSize={11} transform={`rotate(-90 ${padLeft/2} ${padTop + H/2})`} textAnchor="middle">
            Value {unit ? `(${unit})` : ''}
          </text>
          <text x={padLeft + W / 2} y={H + padTop + padBottom - 10} fill="var(--text-tertiary)" fontSize={11} textAnchor="middle">
            Time (h)
          </text>

          {/* Y Axis Grid Lines & Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const val = minVal + frac * rangeVal;
            const y = padTop + H - frac * H;
            return (
              <g key={`y-${frac}`}>
                <line x1={padLeft} y1={y} x2={padLeft + W} y2={y} stroke="var(--border-color)" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                <text x={padLeft - 8} y={y + 3} fill="var(--text-secondary)" fontSize={10} textAnchor="end">
                  {val.toFixed(1)}{unit}
                </text>
              </g>
            );
          })}
          
          {/* X Axis Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const val = minTime + frac * rangeTime;
            const x = padLeft + frac * W;
            return (
              <text key={`x-${frac}`} x={x} y={H + padTop + 20} fill="var(--text-secondary)" fontSize={10} textAnchor="middle">
                {val.toFixed(1)}h
              </text>
            );
          })}

          {/* Line Chart */}
          <path
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth={2}
            d={points.map((p, i) => {
              const x = padLeft + ((p.time - minTime) / rangeTime) * W;
              const y = padTop + H - ((p.value - minVal) / rangeVal) * H;
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ')}
          />

          {/* Points */}
          {points.map((p, i) => {
            const x = padLeft + ((p.time - minTime) / rangeTime) * W;
            const y = padTop + H - ((p.value - minVal) / rangeVal) * H;
            return (
              <circle key={i} cx={x} cy={y} r={3} fill="var(--accent-blue)">
                <title>{`Time: ${p.time.toFixed(2)}h, Value: ${p.value.toFixed(2)}${unit}`}</title>
              </circle>
            );
          })}

          {/* Status Indicator Bar */}
          {points.some(p => p.status) && (
            <g transform={`translate(${padLeft}, ${H + padTop + 25})`}>
              {points.map((p, i) => {
                if (i === points.length - 1) return null;
                const nextP = points[i + 1];
                const x1 = ((p.time - minTime) / rangeTime) * W;
                const x2 = ((nextP.time - minTime) / rangeTime) * W;
                let color = 'var(--bg-input)';
                if (p.status === 'active') color = '#4ade80';
                else if (p.status === 'failure') color = '#ef4444';
                else if (p.status === 'inactive') color = '#94a3b8';
                
                return (
                  <rect key={i} x={x1} y={0} width={x2 - x1} height={6} fill={color}>
                    <title>{`Status: ${p.status}`}</title>
                  </rect>
                );
              })}
            </g>
          )}
        </svg>
      </div>
      
      {points.some(p => p.status) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', paddingLeft: padLeft }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%' }}></div> Active</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#94a3b8', borderRadius: '50%' }}></div> Inactive</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}></div> Failure</div>
        </div>
      )}
    </div>
  );
}

