import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { useStation } from '../components/StationContext';
import { TwinViewer } from '../components/TwinViewer';
import { Play, Pause, RefreshCw, StepForward, Code, List, Activity, Library, ChevronUp, ChevronDown } from 'lucide-react';

export function ScenariosPage() {
  const { selectedStation, hierarchy, spec, connections } = useStation();
  const liveStateRef = useRef<Record<string, unknown>>({});

  // Scenarios state
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioSource, setScenarioSource] = useState<string>('');
  
  // Events library
  const [eventDefs, setEventDefs] = useState<any[]>([]);

  // Simulation state
  const [runId, setRunId] = useState<string | null>(null);
  const [simStatus, setSimStatus] = useState<string>('Ready');
  const [simTime, setSimTime] = useState<number>(0);
  const [simLog, setSimLog] = useState<any[]>([]);
  const [simState, setSimState] = useState<any | null>(null);
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // UI state
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<'source' | 'log' | 'diagnostics'>('source');

  useEffect(() => {
    if (!selectedStation) return;
    api.getScenarios(selectedStation).then(setScenarios).catch(console.error);
    api.getEventDefinitions().then(setEventDefs).catch(console.error);
  }, [selectedStation]);

  useEffect(() => {
    if (selectedScenarioId) {
      api.getScenarioSource(selectedScenarioId).then(res => setScenarioSource(res.source)).catch(console.error);
      if (selectedStation) {
        api.createSimulation(selectedStation, selectedScenarioId).then(res => {
          setRunId(res.runId);
          setSimStatus(res.status);
        }).catch(console.error);
      }
    } else {
      setScenarioSource('');
      setRunId(null);
      setSimStatus('Ready');
    }
  }, [selectedScenarioId, selectedStation]);

  useEffect(() => {
    let interval: any;
    if (runId && (simStatus === 'RUNNING' || simStatus === 'running')) {
      interval = setInterval(() => {
        api.getSimulationState(runId).then(state => {
          if (state) {
            setSimTime(state.time);
            setSimState(state);
            setSimStatus(state.status);
          }
        }).catch(console.error);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [runId, simStatus]);

  const handlePlayPause = async () => {
    if (!runId) return;
    if (simStatus === 'RUNNING' || simStatus === 'running') {
      const res = await api.pauseSimulation(runId);
      setSimStatus(res.status);
    } else {
      const res = await api.playSimulation(runId, playbackSpeed);
      setSimStatus(res.status);
    }
  };

  const handleStep = async () => {
    if (!runId) return;
    try {
      await api.stepSimulation(runId);
      const state = await api.getSimulationState(runId);
      setSimTime(state.time);
      setSimState(state);
      setSimStatus(state.status);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = async () => {
    if (!runId) return;
    const res = await api.resetSimulation(runId);
    setSimStatus('Ready');
    setSimTime(0);
    setSimState(null);
  };

  const saveSource = async () => {
    if (!selectedScenarioId) return;
    await api.updateScenarioSource(selectedScenarioId, scenarioSource);
    if (selectedStation) {
      const res = await api.createSimulation(selectedStation, selectedScenarioId);
      setRunId(res.runId);
      setSimStatus(res.status);
      setSimTime(0);
      setSimState(null);
    }
  };

  const toggleBottomTab = (tab: 'source' | 'log' | 'diagnostics') => {
    if (bottomOpen && bottomTab === tab) {
      setBottomOpen(false);
    } else {
      setBottomTab(tab);
      setBottomOpen(true);
    }
  };

  const libraryTabContent = (
    <div style={{ padding: '8px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', marginTop: '8px' }}>Scenarios</h3>
      {scenarios.map(s => (
        <div 
          key={s.id} 
          style={{
            fontSize: '14px', padding: '8px', borderRadius: '4px', cursor: 'pointer', marginBottom: '4px',
            backgroundColor: selectedScenarioId === s.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: selectedScenarioId === s.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
            border: selectedScenarioId === s.id ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
          }}
          onClick={() => setSelectedScenarioId(s.id)}
        >
          {s.name}
        </div>
      ))}
      
      <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', marginTop: '24px' }}>Event Definitions</h3>
      {eventDefs.map((e, i) => (
        <div key={i} style={{ fontSize: '14px', padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', marginBottom: '4px', border: '1px solid var(--border-color)', cursor: 'grab' }}>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{e.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || 'No description'}</div>
        </div>
      ))}
    </div>
  );

  const customTabs = useMemo(() => [
    { id: 'library', icon: <Library size={20} />, title: 'Scenario Library', content: libraryTabContent }
  ], [libraryTabContent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <select 
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}
            value={selectedScenarioId || ''}
            onChange={e => setSelectedScenarioId(e.target.value || null)}
          >
            <option value="">-- Select Scenario --</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
            {simStatus} | T={simTime.toFixed(1)}s
          </span>
          <button 
            onClick={() => setTelemetryEnabled(!telemetryEnabled)}
            style={{ 
              fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)',
              backgroundColor: telemetryEnabled ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-input)',
              color: telemetryEnabled ? '#ef4444' : 'var(--text-secondary)'
            }}
          >
            {telemetryEnabled ? 'Telemetry: REC' : 'Telemetry: OFF'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleReset} style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Reset">
            <RefreshCw size={20} />
          </button>
          <button onClick={handleStep} style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Step Forward">
            <StepForward size={20} />
          </button>
          <button onClick={handlePlayPause} style={{ padding: '8px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }} title="Play/Pause">
            {(simStatus === 'RUNNING' || simStatus === 'running') ? <Pause size={20} /> : <Play size={20} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', flexDirection: 'row' }}>
        
        {/* Center */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          
          {/* Twin Viewer Area */}
          <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
             {hierarchy && spec && connections ? (
              <TwinViewer 
                topology={hierarchy}
                specification={spec}
                connections={connections}
                customSidebarTabs={customTabs}
                liveStateRef={liveStateRef}
              />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                Loading twin data...
              </div>
            )}
            
            {/* Simulation overlay */}
            <div style={{ position: 'absolute', top: '16px', right: '16px', pointerEvents: 'none' }}>
              <div className="glass-panel" style={{ padding: '16px', fontSize: '14px', width: '256px', color: 'var(--text-primary)' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>Simulation Monitor</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                  <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>{simStatus}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Time:</span>
                  <span style={{ fontFamily: 'monospace' }}>{simTime.toFixed(1)}s</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Components:</span>
                  <span style={{ fontFamily: 'monospace' }}>{simState ? simState.components?.length : 0}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Timeline Editor */}
          <div style={{ 
            height: timelineOpen ? '192px' : '40px', 
            transition: 'height 0.3s ease',
            borderTop: '1px solid var(--border-color)', 
            backgroundColor: 'var(--bg-panel-secondary)', 
            display: 'flex', 
            flexDirection: 'column', 
            flexShrink: 0 
          }}>
            <div 
              style={{ 
                padding: '0 12px', 
                height: '40px',
                backgroundColor: 'var(--bg-panel)', 
                fontSize: '12px', 
                color: 'var(--text-secondary)', 
                fontWeight: 600, 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
              onClick={() => setTimelineOpen(!timelineOpen)}
            >
              <span>TIMELINE EDITOR</span>
              {timelineOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
            {timelineOpen && (
              <div style={{ flex: 1, position: 'relative', overflowX: 'auto', padding: '16px', backgroundImage: 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGgwLjV2NDBIMHptMjAgMGgwLjV2NDBoLS41eiIgZmlsbD0iIzMzMyIgZmlsbC1vcGFjaXR5PSIuMiIvPjwvc3ZnPg==")' }}>
                 {/* Playhead */}
                 <div 
                   style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', backgroundColor: '#ef4444', zIndex: 10, boxShadow: '0 0 8px rgba(239,68,68,0.8)', left: `${Math.max(40, simTime * 10)}px` }}
                 >
                   <div style={{ position: 'absolute', top: '-12px', transform: 'translateX(-50%)', backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', padding: '0 4px', borderRadius: '2px' }}>
                     {simTime.toFixed(1)}
                   </div>
                 </div>
                 
                 <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                   Timeline events visualization will appear here. Edit the scenario source below to populate.
                 </div>
              </div>
            )}
          </div>
        </div>

      {/* Right Side Panel */}
      <div style={{ backgroundColor: 'var(--bg-panel-secondary)', borderLeft: '1px solid var(--border-color)', flexShrink: 0, transition: 'width 0.3s ease', width: bottomOpen ? '450px' : '40px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', height: '40px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <button 
              onClick={() => toggleBottomTab('source')}
              style={{ padding: '4px 12px', fontSize: '14px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: bottomOpen && bottomTab === 'source' ? 'var(--bg-input)' : 'transparent', color: bottomOpen && bottomTab === 'source' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <Code size={16} /> DSL Source
            </button>
            <button 
              onClick={() => toggleBottomTab('log')}
              style={{ padding: '4px 12px', fontSize: '14px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: bottomOpen && bottomTab === 'log' ? 'var(--bg-input)' : 'transparent', color: bottomOpen && bottomTab === 'log' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <List size={16} /> Log
            </button>
            <button 
              onClick={() => toggleBottomTab('diagnostics')}
              style={{ padding: '4px 12px', fontSize: '14px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: bottomOpen && bottomTab === 'diagnostics' ? 'var(--bg-input)' : 'transparent', color: bottomOpen && bottomTab === 'diagnostics' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <Activity size={16} /> Diagnostics
            </button>
          </div>
          
          {bottomOpen && (
            <button onClick={() => setBottomOpen(false)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 8px', marginLeft: 16 }}>
              &times; Close
            </button>
          )}
        </div>
        
        {bottomOpen && (
          <div style={{ height: 'calc(100% - 40px)', backgroundColor: '#000', overflow: 'hidden', position: 'relative' }}>
            {bottomTab === 'source' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel-secondary)', position: 'absolute', top: 0, right: 0, zIndex: 10, width: '100%' }}>
                  <button onClick={saveSource} style={{ padding: '4px 12px', backgroundColor: 'var(--accent-blue)', color: '#fff', fontSize: '12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Save & Reload</button>
                </div>
                <textarea 
                  style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-primary)', padding: '16px', paddingTop: '48px', fontFamily: 'monospace', fontSize: '14px', border: 'none', outline: 'none', resize: 'none' }}
                  value={scenarioSource}
                  onChange={e => setScenarioSource(e.target.value)}
                  placeholder="Select a scenario to edit its DSL source..."
                  spellCheck={false}
                />
              </div>
            )}
            
            {bottomTab === 'log' && (
              <div style={{ padding: '16px', height: '100%', overflowY: 'auto', fontFamily: 'monospace', fontSize: '14px' }}>
                {simLog.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)' }}>No log entries yet.</div>
                ) : (
                  simLog.map((log, i) => (
                    <div key={i} style={{ marginBottom: '4px', color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>[{log.time.toFixed(1)}s]</span> {JSON.stringify(log)}
                    </div>
                  ))
                )}
              </div>
            )}
            
            {bottomTab === 'diagnostics' && (
              <div style={{ padding: '16px', height: '100%', overflowY: 'auto' }}>
                <div style={{ color: 'var(--text-tertiary)' }}>Diagnostics and validation errors will appear here.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
