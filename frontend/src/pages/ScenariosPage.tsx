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
const STYLE_INJECTION = `
  .glass-btn-sm {
    transition: all 0.2s ease;
  }
  .glass-btn-sm:hover {
    background: var(--accent-blue) !important;
    color: #fff !important;
    border-color: var(--accent-blue) !important;
    box-shadow: 0 0 10px rgba(0, 230, 118, 0.3);
  }
  .topbar-select {
    transition: border-color 0.2s;
  }
  .topbar-select:hover {
    border-color: var(--accent-blue) !important;
  }
  .page-container::-webkit-scrollbar {
    display: none;
  }
  .page-container {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

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

  const [savedScenarioSource, setSavedScenarioSource] = useState<string>('');

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
  const [newFileModal, setNewFileModal] = useState<{type: 'scenario' | 'event', name: string} | null>(null);

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
    if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs).catch(console.error);
  }, [selectedStation]);

  useEffect(() => {
    console.log('EFFECT RUNNING:', { editingType, selectedScenarioId, selectedStation });
    if (editingType === 'scenario' && selectedScenarioId) {
      console.log('CALLING API getScenarioSource');
      api.getScenarioSource(selectedScenarioId).then(res => {
        const src = res.source.replace(/\r\n/g, '\n');
        setScenarioSource(src);
        setSavedScenarioSource(src);
      }).catch(console.error);
      if (selectedStation) {
        api.createSimulation(selectedStation, selectedScenarioId).then(res => {
          setRunId(res.runId);
          setSimStatus(res.status);
        }).catch(console.error);
      }
    } else if (editingType === 'event' && selectedEventDefId) {
      api.getEventDefinitionSource(selectedEventDefId).then(res => {
        const src = res.source.replace(/\r\n/g, '\n');
        setScenarioSource(src);
        setSavedScenarioSource(src);
      }).catch(console.error);
      // keep scenario running
    } else {
      setScenarioSource('');
      setSavedScenarioSource('');
      // keep scenario running
    }
  }, [selectedScenarioId, selectedEventDefId, editingType, selectedStation]);

  // Ctrl+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSource();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingType, selectedScenarioId, selectedEventDefId, scenarioSource, selectedStation]);

  useEffect(() => {
    if (editingType === 'scenario' && scenarioSource) {
      const timer = setTimeout(() => {
        api.parseScenarioRaw(scenarioSource)
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
      }, 500);
      return () => clearTimeout(timer);
    } else if (editingType === 'scenario' && !scenarioSource) {
      setScenarioEvents([]);
      setErrorLine(undefined);
      setValidationErrors([]);
    }
  }, [scenarioSource, editingType]);

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
    const cleanSource = scenarioSource.replace(/\r/g, '');
    if (editingType === 'scenario' && selectedScenarioId) {
      await api.updateScenarioSource(selectedScenarioId, cleanSource);
      setScenarioSource(cleanSource); setSavedScenarioSource(cleanSource);
      if (selectedStation) {
        const res = await api.createSimulation(selectedStation, selectedScenarioId);
        setRunId(res.runId);
        setSimStatus(res.status);
        setSimTime(0);
        setSimState(null);
      }
    } else if (editingType === 'event' && selectedEventDefId) {
      await api.updateEventDefinitionSource(selectedEventDefId, cleanSource);
      setScenarioSource(cleanSource); setSavedScenarioSource(cleanSource);
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

  const handleUpdateEventLocation = (event: SceneEventData, newAt: number, newDuration: number | null) => {
    if (!event.source_location) return;
    const lines = scenarioSource.split('\n');
    const idx = event.source_location - 1;
    if (idx >= 0 && idx < lines.length) {
      let line = lines[idx];
      line = line.replace(/at=[\d\.]+/, `at=${newAt}`);
      if (newDuration === null) {
        line = line.replace(/for=([\d\.]+|inf)/, `for=inf`);
      } else {
        line = line.replace(/for=([\d\.]+|inf)/, `for=${newDuration}`);
      }
      lines[idx] = line;
      setScenarioSource(lines.join('\n'));
    }
  };

  const handleDeleteEventFromTimeline = (event: SceneEventData) => {
    if (!event.source_location) return;
    const lines = scenarioSource.split('\n');
    const idx = event.source_location - 1;
    if (idx >= 0 && idx < lines.length) {
      let endIdx = idx;
      if (lines[idx].trim().endsWith('{')) {
        let braces = 1;
        for (let i = idx + 1; i < lines.length; i++) {
          if (lines[i].includes('{')) braces++;
          if (lines[i].includes('}')) braces--;
          endIdx = i;
          if (braces === 0) break;
        }
      }
      lines.splice(idx, endIdx - idx + 1);
      setScenarioSource(lines.join('\n'));
      if (selectedEvent === event) setSelectedEvent(null);
    }
  };

  const libraryTabContent = (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginTop: '8px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Scenarios</h3>
        <button 
          onClick={() => {
            setNewFileModal({ type: 'scenario', name: 'New Scenario' });
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
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1 }}>
            <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}.scene</span>
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
          onClick={() => {
            setNewFileModal({ type: 'event', name: 'New Event' });
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
          onDragStart={(evt) => {
            evt.dataTransfer.setData('text/plain', e.name);
            evt.dataTransfer.setData('application/x-event-def', 'true');
          }}
          onClick={() => {
            setEditingType('event');
            setSelectedEventDefId(e.id);
            setBottomTab('source');
            setBottomOpen(true);
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', cursor: 'grab', marginBottom: '2px',
            backgroundColor: selectedEventDefId === e.name ? 'var(--bg-input)' : 'transparent',
            color: selectedEventDefId === e.name ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1 }}>
            <FileText size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}.event</span>
          </div>
          <button
            onClick={async (evt) => {
              evt.stopPropagation();
              if (confirm('Delete event definition?')) {
                await api.deleteEventDefinition(e.name);
                if (selectedEventDefId === e.name) setSelectedEventDefId(null);
                if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs);
              }
            }}
            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Delete Event Definition"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );

  const customTabs = useMemo(() => [
    { id: 'library', icon: <Library size={20} />, title: 'Scenario Library', content: libraryTabContent }
  ], [libraryTabContent]);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      <style>{STYLE_INJECTION}</style>
      
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <select 
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}
            value={selectedScenarioId || ''}
            onChange={e => { setSelectedScenarioId(e.target.value || null); setEditingType('scenario'); }}
          >
            <option value="">-- Select Scenario --</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="glass-btn-sm" onClick={() => { setSelectedScenarioId(null); setScenarioEvents([]); setRunId(null); setSimStatus('Ready'); if (editingType === 'scenario') setScenarioSource(''); }} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Deselect</button>
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
                          {scenarioSource !== savedScenarioSource ? '*' : ''}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>
                        {bottomTab === 'log' ? 'Simulation Log' : bottomTab === 'compare' ? 'Scenario Comparison' : bottomTab}
                      </div>
                    )}
                  </div>
                  {bottomTab === 'source' && scenarioSource !== savedScenarioSource && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingRight: 8 }}>Unsaved (Ctrl+S)</span>
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
            {selectedEvent && editingType === 'scenario' && (
              <button 
                onClick={() => handleDeleteEventFromTimeline(selectedEvent)} 
                style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
              >
                Delete Instance
              </button>
            )}
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
              onAppendEvent={editingType === 'scenario' ? ((eventRef, at) => {
                const newLine = `\nevent:${eventRef} at=${at} for=1.0`;
                setScenarioSource(prev => prev + newLine);
              }) : undefined}
              onUpdateEventLocation={editingType === 'scenario' ? handleUpdateEventLocation : undefined}
              onDeleteEvent={editingType === 'scenario' ? handleDeleteEventFromTimeline : undefined}
            />
          )}
        </div>
      </div>
      
      {/* New File Modal */}
      {newFileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '300px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>New {newFileModal.type === 'scenario' ? 'Scenario' : 'Event'}</h3>
            <input 
              autoFocus
              type="text" 
              value={newFileModal.name} 
              onChange={e => setNewFileModal({ ...newFileModal, name: e.target.value })}
              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  const name = newFileModal.name.trim();
                  if (!name) return;
                  if (newFileModal.type === 'scenario' && selectedStation) {
                    const res = await api.createScenario(selectedStation, name, '');
                    api.getScenarios(selectedStation).then(setScenarios);
                    setSelectedScenarioId(res.id);
                    setEditingType('scenario');
                    setSelectedEventDefId(null);
                  } else if (newFileModal.type === 'event' && selectedStation) {
                    await api.createEventDefinition(selectedStation, name);
                    if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs);
                    setEditingType('event');
                    setSelectedEventDefId(name);
                    setSelectedScenarioId(null);
                  }
                  setBottomTab('source');
                  setBottomOpen(true);
                  setNewFileModal(null);
                }
              }}
              style={{ width: '100%', padding: '8px', marginTop: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', boxSizing: 'border-box' }} 
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button onClick={() => setNewFileModal(null)} style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
              <button 
                onClick={async () => {
                  const name = newFileModal.name.trim();
                  if (!name) return;
                  if (newFileModal.type === 'scenario' && selectedStation) {
                    const res = await api.createScenario(selectedStation, name, '');
                    api.getScenarios(selectedStation).then(setScenarios);
                    setSelectedScenarioId(res.id);
                    setEditingType('scenario');
                    setSelectedEventDefId(null);
                  } else if (newFileModal.type === 'event' && selectedStation) {
                    await api.createEventDefinition(selectedStation, name);
                    if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs);
                    setEditingType('event');
                    setSelectedEventDefId(name);
                    setSelectedScenarioId(null);
                  }
                  setBottomTab('source');
                  setBottomOpen(true);
                  setNewFileModal(null);
                }}
                style={{ padding: '6px 12px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
