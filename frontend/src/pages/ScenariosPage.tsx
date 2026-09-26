import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { useStation } from '../components/StationContext';
import { TwinViewer } from '../components/TwinViewer';
import { TimelineEditor } from '../components/TimelineEditor';
import { DSLEditor } from '../components/DSLEditor';
import type { SceneEventData } from '../components/TimelineEditor';
import { EventInspector } from '../components/EventInspector';
import { SimulationMonitor } from '../components/SimulationMonitor';
import { Play, Pause, RefreshCw, StepForward, Code, List, Activity, Library, ChevronUp, ChevronDown, MousePointer2, LayoutDashboard, Plus, Trash2, GitCompare, FileText, FilePlus } from 'lucide-react';
import { ScenarioComparison } from '../components/ScenarioComparison';

export function ScenariosPage() {
  const { 
    selectedStation, hierarchy, spec, connections,
    liveStateRef,
    selectedScenarioId, setSelectedScenarioId,
    scenarioSource, setScenarioSource,
    runId, setRunId,
    simStatus, setSimStatus,
    simTime, setSimTime,
    simLog,
    simState, setSimState
  } = useStation();

  // Scenarios local state
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioEvents, setScenarioEvents] = useState<SceneEventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SceneEventData | null>(null);
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<number | undefined>(undefined);
  const [validationErrors, setValidationErrors] = useState<{message: string; line_number?: number}[]>([]);
  
  // Events library
  const [eventDefs, setEventDefs] = useState<any[]>([]);
  const [selectedEventDefId, setSelectedEventDefId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'scenario' | 'event'>('scenario');

  // Simulation UI state
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(false);
  const [playbackSpeed] = useState<number>(1.0);

  // UI state
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<'source' | 'log' | 'diagnostics' | 'inspector' | 'monitor' | 'compare'>('source');

  const [rightPanelWidth, setRightPanelWidth] = useState(450);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(192);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const globalToleranceInputRef = useRef<HTMLInputElement>(null);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRight) {
        setRightPanelWidth(prev => Math.max(200, Math.min(800, prev - e.movementX)));
      }
      if (isResizingBottom) {
        setBottomPanelHeight(prev => Math.max(100, Math.min(600, prev - e.movementY)));
      }
    };
    const handleMouseUp = () => {
      setIsResizingRight(false);
      setIsResizingBottom(false);
    };

    if (isResizingRight || isResizingBottom) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight, isResizingBottom]);

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
      setScenarioEvents([]);
    }
  }, [selectedScenarioId, selectedStation]);

  useEffect(() => {
    if (selectedScenarioId) {
      api.getScenarioEvents(selectedScenarioId)
        .then(events => {
          setScenarioEvents(events);
          setErrorLine(undefined);
          setValidationErrors([]);
        })
        .catch(err => {
          console.error(err);
          if (err.line_number !== undefined) {
            setErrorLine(err.line_number);
            setValidationErrors([{ message: err.message, line_number: err.line_number }]);
          } else {
            setErrorLine(undefined);
            setValidationErrors([{ message: err.message || err.toString() }]);
          }
        });
    }
  }, [selectedScenarioId, scenarioSource]); // Refetch events when source updates and parses

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
    if (!runId) {
      if (!selectedStation || !selectedScenarioId) return;
      try {
        await saveSource(); // Save source first
        const res = await api.createSimulation(selectedStation, selectedScenarioId, 20.0);
        setRunId(res.run_id);
        const playRes = await api.playSimulation(res.run_id, playbackSpeed);
        setSimStatus(playRes.status);
      } catch (err: any) {
        alert("Failed to start simulation: " + (err.message || err.toString()));
      }
      return;
    }
    
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
    await api.resetSimulation(runId);
    setSimStatus('Ready');
    setSimTime(0);
    setSimState(null);
  };

  const saveSource = async () => {
    if (editingType === 'scenario' && selectedScenarioId) {
      await api.updateScenarioSource(selectedScenarioId, scenarioSource);
      if (selectedStation) {
        const res = await api.createSimulation(selectedStation, selectedScenarioId);
        setRunId(res.runId);
        setSimStatus(res.status);
        setSimTime(0);
        setSimState(null);
      }
    } else if (editingType === 'event' && selectedEventDefId) {
      await api.updateEventDefinitionSource(selectedEventDefId, scenarioSource);
      // Event defs don't need a full simulation restart directly
    }
  };

  const toggleBottomTab = (tab: 'source' | 'log' | 'diagnostics' | 'inspector' | 'monitor' | 'compare') => {
    if (bottomOpen && bottomTab === tab) {
      setBottomOpen(false);
    } else {
      setBottomTab(tab);
      setBottomOpen(true);
    }
  };

  const handleUpdateEvent = (event: SceneEventData, newSourceSnippet: string) => {
    if (!event.source_location) return;
    const lines = scenarioSource.split('\n');
    const idx = event.source_location - 1; // source_location is 1-indexed
    if (idx >= 0 && idx < lines.length) {
      lines[idx] = newSourceSnippet;
      setScenarioSource(lines.join('\n'));
    }
  };

  const libraryTabContent = (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginTop: '8px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Scenarios</h3>
        <button 
          onClick={async () => {
            if (selectedStation) {
              const res = await api.createScenario(selectedStation, 'New Scenario', '');
              setSelectedScenarioId(res.id);
            }
          }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
          title="New File..."
        >
          <FilePlus size={14} />
        </button>
      </div>
      {scenarios.map(s => (
        <div 
          key={s.id} 
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginBottom: '2px',
            backgroundColor: selectedScenarioId === s.id ? 'var(--bg-input)' : 'transparent',
            color: selectedScenarioId === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
          onClick={() => {
            setEditingType('scenario');
            setSelectedScenarioId(s.id);
            setSelectedEventDefId(null);
            setBottomTab('source');
            setBottomOpen(true);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
            <span>{s.name}.scene</span>
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (confirm('Delete scenario?')) {
                await api.deleteScenario(s.id);
                if (selectedScenarioId === s.id) setSelectedScenarioId(null);
                if (selectedStation) {
                  api.getScenarios(selectedStation).then(setScenarios);
                }
              }
            }}
            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Delete Scenario"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', marginTop: '24px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Event Definitions</h3>
        <button
          onClick={async () => {
            const name = prompt('Enter new Event Definition name:');
            if (name && name.trim()) {
              await api.createEventDefinition(name.trim());
              api.getEventDefinitions().then(setEventDefs);
              setEditingType('event');
              setSelectedEventDefId(name.trim());
              setSelectedScenarioId(null);
            }
          }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
          title="New File..."
        >
          <FilePlus size={14} />
        </button>
      </div>
      {eventDefs.map((e, i) => (
        <div 
          key={i} 
          draggable
          onDragStart={(evt) => evt.dataTransfer.setData('text/plain', e.name)}
          onClick={() => {
            setEditingType('event');
            setSelectedEventDefId(e.name);
            setSelectedScenarioId(null);
            setBottomTab('source');
            setBottomOpen(true);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', cursor: 'grab', marginBottom: '2px',
            backgroundColor: selectedEventDefId === e.name ? 'var(--bg-input)' : 'transparent',
            color: selectedEventDefId === e.name ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <FileText size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>{e.name}.event</span>
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
            {simStatus} | T={(simTime || 0).toFixed(1)}s
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Tolerance:</span>
              <input 
                type="number" 
                ref={globalToleranceInputRef}
                defaultValue={20}
                onBlur={(e) => { if (runId) api.setGlobalTolerance(runId, parseFloat(e.target.value)); }}
                style={{
                  width: '50px', background: 'var(--bg-input)', border: '1px solid var(--border-solid)', 
                  color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'
                }}
              />
            </div>
            <button 
              onClick={() => {
                if (runId) api.setGlobalTolerance(runId, 20);
                if (globalToleranceInputRef.current) globalToleranceInputRef.current.value = '20';
              }}
              style={{
                fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)'
              }}
              title="Reset global tolerance to default (20)"
            >
              Set Default
            </button>
            <button 
              onClick={() => {
                if (runId) {
                  api.resetSimulation(runId);
                  setSimStatus('Ready');
                  setSimTime(0);
                }
              }}
              style={{
                fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)'
              }}
              title="Reset all components to defaults"
            >
              Reset All
            </button>
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

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* Twin Viewer Area (Full size) */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 1 }}>
            {hierarchy && spec && connections ? (
            <TwinViewer 
              topology={hierarchy}
              specification={spec}
              connections={connections}
              customSidebarTabs={customTabs}
              liveStateRef={liveStateRef}
              selectedName={selectedComponentName}
              onSelectName={setSelectedComponentName}
              rightOffset={(bottomOpen ? rightPanelWidth : 0) + 48}
              bottomOffset={(timelineOpen ? bottomPanelHeight : 40)}
            />
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              Loading twin data...
            </div>
          )}
        </div>
        
        {/* Right Side Panel (Overlay) */}
        <div style={{ 
          position: 'absolute', top: 0, right: 0, 
          bottom: timelineOpen ? bottomPanelHeight : 40, 
          transition: isResizingBottom ? 'none' : 'bottom 0.3s ease',
          display: 'flex', flexDirection: 'row', backgroundColor: 'transparent', zIndex: 10, pointerEvents: 'none' 
        }}>
          
          {/* Content Area (Resizable) */}
          {bottomOpen && (
            <div style={{ width: `${rightPanelWidth}px`, flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)', position: 'relative', pointerEvents: 'auto', borderLeft: '1px solid var(--border-color)', boxShadow: '-4px 0 15px rgba(0,0,0,0.3)' }}>
                {/* Resize Handle for Right Panel */}
                <div 
                  style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', cursor: 'ew-resize', zIndex: 50 }}
                  onMouseDown={(e) => { e.preventDefault(); setIsResizingRight(true); }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel-secondary)', zIndex: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {bottomTab === 'source' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-main)', padding: '6px 16px', borderTop: '2px solid var(--accent-blue)', borderRight: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)', marginTop: '-12px', marginBottom: '-12px', borderBottom: '1px solid transparent', zIndex: 20 }}>
                        <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
                        <span style={{ fontFamily: 'monospace' }}>
                          {editingType === 'scenario' 
                            ? (selectedScenarioId ? `${scenarios.find(s => s.id === selectedScenarioId)?.name || 'untitled'}.scene` : 'untitled.scene')
                            : (selectedEventDefId ? `${selectedEventDefId}.event` : 'untitled.event')}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>
                        {bottomTab === 'log' ? 'Simulation Log' : bottomTab === 'compare' ? 'Scenario Comparison' : bottomTab}
                      </div>
                    )}
                  </div>
                  {bottomTab === 'source' && (
                    <button onClick={saveSource} style={{ padding: '4px 12px', backgroundColor: 'var(--accent-blue)', color: '#fff', fontSize: '12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Save & Reload</button>
                  )}
                </div>

                {bottomTab === 'source' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <DSLEditor 
                      value={scenarioSource}
                      onChange={setScenarioSource}
                      selectedLine={selectedEvent?.source_location ? selectedEvent.source_location - 1 : undefined}
                      errorLine={errorLine}
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
                    {validationErrors.length === 0 ? (
                      <div style={{ color: 'var(--text-tertiary)' }}>No diagnostics or validation errors.</div>
                    ) : (
                      validationErrors.map((err, i) => (
                        <div key={i} style={{ color: '#ef4444', marginBottom: '8px', fontSize: '13px' }}>
                          {err.line_number !== undefined ? `Line ${err.line_number + 1}: ` : ''}{err.message}
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {bottomTab === 'inspector' && (
                  <EventInspector 
                    event={selectedEvent} 
                    eventDef={eventDefs.find(ed => ed.name === selectedEvent?.event_ref)}
                    onUpdateEvent={(snippet) => selectedEvent && handleUpdateEvent(selectedEvent, snippet)}
                  />
                )}
                
                {bottomTab === 'monitor' && (
                  <SimulationMonitor simState={simState} />
                )}
                
                {bottomTab === 'compare' && (
                  <ScenarioComparison stationId={selectedStation || ''} />
                )}
              </div>
            )}

          {/* Vertical Strip of Tabs */}
          <div style={{ width: '48px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: '16px', backgroundColor: 'var(--bg-panel-solid)', borderLeft: '1px solid var(--border-color)', pointerEvents: 'auto', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)' }}>
              <button 
                onClick={() => toggleBottomTab('source')} 
                title="DSL Source"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bottomOpen && bottomTab === 'source' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              >
                <Code size={20} />
              </button>
              <button 
                onClick={() => toggleBottomTab('log')} 
                title="Log"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bottomOpen && bottomTab === 'log' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              >
                <List size={20} />
              </button>
              <button 
                onClick={() => toggleBottomTab('diagnostics')} 
                title="Diagnostics"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bottomOpen && bottomTab === 'diagnostics' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              >
                <Activity size={20} />
              </button>
              <button 
                onClick={() => toggleBottomTab('inspector')} 
                title="Inspector"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bottomOpen && bottomTab === 'inspector' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              >
                <MousePointer2 size={20} />
              </button>
              <button 
                onClick={() => toggleBottomTab('monitor')} 
                title="Simulation Monitor"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bottomOpen && bottomTab === 'monitor' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              >
                <LayoutDashboard size={20} />
              </button>
              <button 
                onClick={() => toggleBottomTab('compare')} 
                title="Compare Scenarios"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: bottomOpen && bottomTab === 'compare' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              >
                <GitCompare size={20} />
              </button>
            </div>
        </div>

        {/* Timeline Editor (Bottom Panel) */}
        <div style={{ 
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: timelineOpen ? `${bottomPanelHeight}px` : '40px', 
          transition: isResizingBottom ? 'none' : 'height 0.3s ease',
          borderTop: '1px solid var(--border-color)', 
          backgroundColor: 'var(--bg-panel-secondary)', 
          display: 'flex', 
          flexDirection: 'column', 
          zIndex: 10,
          boxShadow: '0 -4px 15px rgba(0,0,0,0.2)'
        }}>
          {/* Resize Handle for Bottom Panel */}
          {timelineOpen && (
            <div 
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', cursor: 'ns-resize', zIndex: 50 }}
              onMouseDown={(e) => { e.preventDefault(); setIsResizingBottom(true); }}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 12px', alignItems: 'center' }}>
            <div 
              style={{ 
                height: '40px',
                minHeight: '40px',
                fontSize: '12px', 
                color: 'var(--text-secondary)', 
                fontWeight: 600, 
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                cursor: 'pointer'
              }}
              onClick={() => setTimelineOpen(!timelineOpen)}
            >
              <span>TIMELINE EDITOR {selectedComponentName ? `(Filtered: ${selectedComponentName})` : ''}</span>
              <div style={{ marginLeft: '12px' }}>
                {timelineOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            </div>
            {selectedComponentName && (
              <button 
                onClick={() => setSelectedComponentName(null)} 
                style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer' }}
              >
                Clear Filter
              </button>
            )}
          </div>
          {timelineOpen && (
            <TimelineEditor 
              events={selectedComponentName ? scenarioEvents.filter(e => e.selector === `@${selectedComponentName}` || e.selector === selectedComponentName) : scenarioEvents}
              simTime={simTime}
              selectedEvent={selectedEvent}
              onSelectEvent={(ev) => {
                setSelectedEvent(ev);
                if (ev && ev.selector) {
                  setSelectedComponentName(ev.selector.startsWith('@') ? ev.selector.slice(1) : ev.selector);
                }
                if (ev && !bottomOpen) setBottomOpen(true);
                if (ev) setBottomTab('inspector');
              }}
              onAppendEvent={(eventRef, at) => {
                const newLine = `\nevent:${eventRef} at=${at} for=1.0`;
                setScenarioSource(prev => prev + newLine);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
