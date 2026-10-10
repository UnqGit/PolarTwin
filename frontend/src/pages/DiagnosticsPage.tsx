import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStation } from '../components/StationContext';
import { api } from '../lib/api';
import {
  ChevronDown, ChevronRight, Activity, Cloud, Signal, Droplets, History, Box, Globe, Trash2, Maximize2, Minimize2, AlignLeft, WrapText
} from 'lucide-react';
import { buildSceneLayout, type NodeLayout } from '../lib/layout';
import { SelectionProvider } from '../components/SelectionContext';
import { HierarchyPanel } from '../components/HierarchyPanel';
import { Dropdown } from '../components/Dropdown';

export function DiagnosticsPage() {
  const { selectedStation, hierarchy, connections, spec } = useStation();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedScenarioFilter, setSelectedScenarioFilter] = useState<string>('');
  const [runMeta, setRunMeta] = useState<any>(null);
  const [runEvents, setRunEvents] = useState<any[]>([]);
  const [runSimLogs, setRunSimLogs] = useState<any[]>([]);
  const [runDiagLogs, setRunDiagLogs] = useState<any[]>([]);
  
  const [simLogsExpanded, setSimLogsExpanded] = useState(false);
  const [diagLogsExpanded, setDiagLogsExpanded] = useState(false);

  const [deleteRunModal, setDeleteRunModal] = useState<string | null>(null);
  const [deleteScenarioModal, setDeleteScenarioModal] = useState<string | null>(null);

  const [showManageScenarios, setShowManageScenarios] = useState(false);
  const [selectedManageScenarios, setSelectedManageScenarios] = useState<string[]>([]);

  const [showManageRuns, setShowManageRuns] = useState(false);
  const [selectedManageRuns, setSelectedManageRuns] = useState<string[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<'connections' | 'components' | 'environment' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
  const fetchRuns = () => {
    api.getTelemetryRuns().then(r => {
      setRuns(r);
    }).catch(console.error);
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  // Filter runs by selected station and scenario
  const stationRuns = useMemo(() => {
    return runs.filter(r => r.station_model_id === selectedStation || r.station_id === selectedStation);
  }, [runs, selectedStation]);

  const uniqueScenarios = useMemo(() => {
    return Array.from(new Set(stationRuns.map(r => r.scenario_id || 'Manual')));
  }, [stationRuns]);

  const filteredRuns = useMemo(() => {
    if (!selectedScenarioFilter) return [];
    return stationRuns.filter(r => (r.scenario_id || 'Manual') === selectedScenarioFilter);
  }, [stationRuns, selectedScenarioFilter]);

  // When run selected
  useEffect(() => {
    if (!selectedRunId) {
      setRunMeta(null);
      setRunEvents([]);
      setRunSimLogs([]);
      setRunDiagLogs([]);
      setHistoryData([]);
      return;
    }
    api.getRunMetadata(selectedRunId).then(setRunMeta).catch(console.error);
    api.getRunEvents(selectedRunId).then(setRunEvents).catch(console.error);
    api.getSimulationLog(selectedRunId).then(logs => {
      if (Array.isArray(logs)) {
        setRunSimLogs(logs);
        setRunDiagLogs([]);
      } else {
        setRunSimLogs(logs.simLog || []);
        setRunDiagLogs(logs.diagLog || []);
      }
    }).catch(console.error);

    // Clear selected category/item to show overview for new run
    setSelectedCategory(null);
    setSelectedItemId(null);
    setSelectedName(null);
    setHistoryData([]);
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
            background: isSelected ? 'rgba(99,219,188,0.08)' : 'transparent',
            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
            transition: 'all 0.15s ease',
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
      <div style={{ position: 'relative', zIndex: 100, padding: '14px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'var(--bg-panel)', backdropFilter: 'blur(12px)' }}>
        <History size={18} style={{ color: 'var(--accent-primary)' }} />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Simulation History</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            value={selectedScenarioFilter}
            onChange={val => {
              setSelectedScenarioFilter(val);
              setSelectedRunId(''); // Clear run when scenario changes
            }}
            options={uniqueScenarios.map(scenario => ({ value: scenario, label: scenario }))}
            placeholder="-- Select a Scenario --"
            style={{ minWidth: 200 }}
            onManage={() => {
              setSelectedManageScenarios([]);
              setShowManageScenarios(true);
            }}
            onOpen={fetchRuns}
          />
          {selectedScenarioFilter && (
            <button
              onClick={() => setDeleteScenarioModal(selectedScenarioFilter)}
              style={{ padding: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
              title="Delete all runs for this scenario"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            value={selectedRunId}
            onChange={val => setSelectedRunId(val)}
            disabled={!selectedScenarioFilter}
            options={filteredRuns.map(r => {
              const runNoMatch = r.run_id.match(/\d+$/);
              const runNo = runNoMatch ? runNoMatch[0] : '?';
              const isRunning = r.status === 'RUNNING' || r.status === 'running';
              const dotColor = isRunning ? '#4ade80' : '#3b82f6';
              const dateStr = new Date(r.start_time * 1000).toLocaleString();
              
              return {
                value: r.run_id,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500 }}>Run {runNo}</span>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} title={r.status} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{dateStr}</span>
                  </div>
                )
              };
            })}
            placeholder="-- Select a Simulation Run --"
            style={{ minWidth: 250 }}
            onManage={() => {
              setSelectedManageRuns([]);
              setShowManageRuns(true);
            }}
            onOpen={fetchRuns}
          />
          {selectedRunId && (
            <button
              onClick={() => setDeleteRunModal(selectedRunId)}
              style={{ padding: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
              title="Delete this run"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

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
              activeView={activeView}
              setActiveView={setActiveView}
              isOpen={isSidebarOpen}
              onIsOpenChange={setIsSidebarOpen}
              customSidebarTopTabs={[
                {
                  id: 'overview',
                  title: 'Overview',
                  icon: <Activity size={20} />,
                  onClick: (toggleView) => {
                    setSelectedCategory(null);
                    setSelectedItemId(null);
                    setSelectedName(null);
                    toggleView('overview');
                  }
                }
              ]}
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
        <div style={{ flex: 1, padding: 24, paddingLeft: isSidebarOpen ? 400 : 72, overflowY: 'auto', transition: 'padding-left 0.2s ease' }}>


          {!selectedRunId ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Select a simulation run to view historical data.
            </div>
          ) : !selectedCategory && activeView === 'overview' ? (
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

              <ScrollableLogBox title="Logs" logs={runSimLogs} expanded={simLogsExpanded} setExpanded={setSimLogsExpanded} />
              <ScrollableLogBox title="Diagnostics" logs={runDiagLogs} expanded={diagLogsExpanded} setExpanded={setDiagLogsExpanded} />
            </div>
          ) : !selectedCategory ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Please select a component to inspect.
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

      {deleteScenarioModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form 
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDeleteScenarioModal(null);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              await api.deleteScenarioRuns(deleteScenarioModal);
              const updatedRuns = await api.getTelemetryRuns();
              setRuns(updatedRuns.filter((run: any) => run.status !== 'RUNNING'));
              setSelectedScenarioFilter('');
              setSelectedRunId('');
              setDeleteScenarioModal(null);
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete all simulation runs for scenario <strong>{deleteScenarioModal}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button type="button" onClick={() => setDeleteScenarioModal(null)} style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
              <button type="submit" autoFocus style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
            </div>
          </form>
        </div>
      )}

      {deleteRunModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form 
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDeleteRunModal(null);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              await api.deleteSimulation(deleteRunModal);
              const updatedRuns = await api.getTelemetryRuns();
              setRuns(updatedRuns.filter((run: any) => run.status !== 'RUNNING'));
              setSelectedRunId('');
              setDeleteRunModal(null);
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete simulation run <strong>{deleteRunModal}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button type="button" onClick={() => setDeleteRunModal(null)} style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
              <button type="submit" autoFocus style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
            </div>
          </form>
        </div>
      )}

      {showManageScenarios && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form 
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowManageScenarios(false);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              for (const scenarioId of selectedManageScenarios) {
                await api.deleteScenarioRuns(scenarioId);
              }
              const updatedRuns = await api.getTelemetryRuns();
              setRuns(updatedRuns.filter((run: any) => run.status !== 'RUNNING'));
              setSelectedScenarioFilter('');
              setSelectedRunId('');
              setShowManageScenarios(false);
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Manage Scenarios</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Select scenarios to delete all their runs.</p>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-input)', padding: '8px' }}>
              {uniqueScenarios.map(scenario => (
                <label key={scenario} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedManageScenarios.includes(scenario)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedManageScenarios([...selectedManageScenarios, scenario]);
                      else setSelectedManageScenarios(selectedManageScenarios.filter(s => s !== scenario));
                    }}
                  />
                  <span style={{ fontSize: '13px' }}>{scenario}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowManageScenarios(false)} style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
              <button type="submit" autoFocus disabled={selectedManageScenarios.length === 0} style={{ padding: '6px 12px', background: selectedManageScenarios.length > 0 ? '#ef4444' : 'var(--border-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedManageScenarios.length > 0 ? 'pointer' : 'not-allowed' }}>
                Delete Selected ({selectedManageScenarios.length})
              </button>
            </div>
          </form>
        </div>
      )}

      {showManageRuns && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form 
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowManageRuns(false);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              for (const runId of selectedManageRuns) {
                await api.deleteSimulation(runId);
              }
              const updatedRuns = await api.getTelemetryRuns();
              setRuns(updatedRuns.filter((run: any) => run.status !== 'RUNNING'));
              setSelectedRunId('');
              setShowManageRuns(false);
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Manage Runs</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Select simulation runs to delete.</p>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-input)', padding: '8px' }}>
              {filteredRuns.map(r => (
                <label key={r.run_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedManageRuns.includes(r.run_id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedManageRuns([...selectedManageRuns, r.run_id]);
                      else setSelectedManageRuns(selectedManageRuns.filter(id => id !== r.run_id));
                    }}
                  />
                  <span style={{ fontSize: '13px' }}>{new Date(r.start_time * 1000).toLocaleString()} | {r.run_id.substring(0, 8)}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowManageRuns(false)} style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
              <button type="submit" autoFocus disabled={selectedManageRuns.length === 0} style={{ padding: '6px 12px', background: selectedManageRuns.length > 0 ? '#ef4444' : 'var(--border-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedManageRuns.length > 0 ? 'pointer' : 'not-allowed' }}>
                Delete Selected ({selectedManageRuns.length})
              </button>
            </div>
          </form>
        </div>
      )}

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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, usePlotArea } from 'recharts';

const AxisColorOverlay = (props: any) => {
  const { fullPoints: points } = props;
  const plotArea = usePlotArea();

  if (!plotArea || !points || points.length === 0) return null;

  if (!points.some((p: any) => p.status)) {
    return <rect x={plotArea.x} y={plotArea.y + plotArea.height + 6} width={plotArea.width} height={4} fill="#facc15" />;
  }

  const rects: any[] = [];
  let currentX = plotArea.x;
  const totalWidth = plotArea.width;
  const totalDuration = points[points.length - 1].time - points[0].time || 1;

  points.forEach((p: any, i: number) => {
    const nextP = points[i + 1];
    const duration = nextP ? nextP.time - p.time : 0;
    const widthPct = duration / totalDuration;
    const rectWidth = widthPct * totalWidth;
    
    let bg = '#94a3b8'; // inactive
    if (p.status === 'active' || p.status === 'ACTIVE') bg = '#4ade80';
    if (p.status === 'failure' || p.status === 'FAILURE') bg = '#ef4444';

    rects.push(
      <rect 
        key={i} 
        x={currentX} 
        y={plotArea.y + plotArea.height + 6}
        width={rectWidth + 0.5} 
        height={4} 
        fill={bg} 
      />
    );
    currentX += rectWidth;
  });

  return <g>{rects}</g>;
};

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

  const fullPoints = useMemo(() => {
    return data.map(row => ({ time: row.time, status: row.status }));
  }, [data]);

  if (points.length === 0 || data.length === 0) return null;

  const unit = points[0]?.unit || '';

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, width: 550 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 14, textTransform: 'capitalize' }}>
        {metric.replace(/_/g, ' ')} {unit ? `(${unit})` : ''}
      </h3>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 20, left: -20, bottom: 20 }} style={{ overflow: 'visible' }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={[data[0].time, data[data.length - 1].time]}
              tickFormatter={(v) => formatTime(v)}
              stroke="var(--text-tertiary)"
              tick={{ fontSize: 11 }}
              dy={10}
              axisLine={{ stroke: 'var(--border-color)' }}
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
            <AxisColorOverlay fullPoints={fullPoints} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {fullPoints.some(p => p.status) && (
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 20, justifyContent: 'center', marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%' }}></div> Active</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#94a3b8', borderRadius: '50%' }}></div> Inactive</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}></div> Failure</div>
        </div>
      )}
    </div>
  );
}

function ScrollableLogBox({ title, logs, expanded, setExpanded }: { title: string, logs: any[], expanded: boolean, setExpanded: (v: boolean) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topShadowRef = useRef<HTMLDivElement>(null);
  const bottomShadowRef = useRef<HTMLDivElement>(null);
  const leftShadowRef = useRef<HTMLDivElement>(null);
  const rightShadowRef = useRef<HTMLDivElement>(null);
  const [wrap, setWrap] = useState(false);

  const checkScrollState = () => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    if (topShadowRef.current) {
      topShadowRef.current.style.opacity = el.scrollTop > 2 ? '1' : '0';
    }
    if (bottomShadowRef.current) {
      bottomShadowRef.current.style.opacity = el.scrollHeight - Math.ceil(el.scrollTop) - el.clientHeight > 2 ? '1' : '0';
    }
    if (leftShadowRef.current) {
      leftShadowRef.current.style.opacity = el.scrollLeft > 2 ? '1' : '0';
    }
    if (rightShadowRef.current) {
      rightShadowRef.current.style.opacity = el.scrollWidth - Math.ceil(el.scrollLeft) - el.clientWidth > 2 ? '1' : '0';
    }
  };

  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [logs, expanded, wrap]);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 12px 0' }}>{title}</h3>
      <div style={{ position: 'relative' }}>
        
        {/* Toolbar */}
        <div style={{ position: 'absolute', top: 8, right: 16, display: 'flex', gap: 4, zIndex: 10 }}>
          <button 
            onClick={() => setWrap(!wrap)}
            style={{ background: 'var(--bg-input)', border: 'none', color: wrap ? 'var(--accent-blue)' : 'var(--text-tertiary)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={wrap ? "Disable Wrap" : "Enable Wrap"}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.color = wrap ? 'var(--accent-blue)' : 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = wrap ? 'var(--accent-blue)' : 'var(--text-tertiary)'; }}
          >
            <WrapText size={14} />
          </button>
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={expanded ? "Shrink" : "Expand"}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Shadows */}
        <div ref={topShadowRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, background: 'linear-gradient(to bottom, var(--bg-input), transparent)', pointerEvents: 'none', zIndex: 5, opacity: 0, transition: 'opacity 0.2s', borderRadius: '6px 6px 0 0' }} />
        <div ref={bottomShadowRef} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, background: 'linear-gradient(to top, var(--bg-input), transparent)', pointerEvents: 'none', zIndex: 5, opacity: 0, transition: 'opacity 0.2s', borderRadius: '0 0 6px 6px' }} />
        <div ref={leftShadowRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 20, background: 'linear-gradient(to right, var(--bg-input), transparent)', pointerEvents: 'none', zIndex: 5, opacity: 0, transition: 'opacity 0.2s', borderRadius: '6px 0 0 6px' }} />
        <div ref={rightShadowRef} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 60, background: 'linear-gradient(to left, var(--bg-input) 30%, transparent)', pointerEvents: 'none', zIndex: 5, opacity: 0, transition: 'opacity 0.2s', borderRadius: '0 6px 6px 0' }} />

        {/* Content */}
        <div 
          ref={containerRef}
          onScroll={checkScrollState}
          style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-input)', padding: 12, paddingRight: 64, borderRadius: 6, maxHeight: expanded ? 'none' : 200, overflow: 'auto' }}
        >
          {logs.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : 'var(--text-primary)', whiteSpace: wrap ? 'normal' : 'pre', wordBreak: wrap ? 'break-all' : 'normal', width: wrap ? '100%' : 'max-content' }}>
              <div style={{ width: 80, color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatTime(log.time || 0)}</div>
              <div>[{log.level}] {log.message}</div>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>No {title.toLowerCase()} recorded for this run.</div>}
        </div>
      </div>
    </div>
  );
}
