import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { useStation } from '../components/StationContext';
import { TwinViewer } from '../components/TwinViewer';
import { TimelineEditor } from '../components/TimelineEditor';
import { DSLEditor } from '../components/DSLEditor';
import type { SceneEventData } from '../components/TimelineEditor';
import { EventInspector } from '../components/EventInspector';
import { SimulationMonitor } from '../components/SimulationMonitor';
import { Play, Pause, RefreshCw, StepForward, Code, List, Activity, Library, ChevronUp, ChevronDown, MousePointer2, LayoutDashboard, Trash2, FileText, FilePlus, PanelLeft, PanelRight, PanelBottom, Edit2 } from 'lucide-react';
import { formatTime } from '../utils';
import { Dropdown } from '../components/Dropdown';

export function ScenariosPage() {
  const {
    selectedStation, hierarchy, spec, connections, runtime,
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
  const [sourceVersion, setSourceVersion] = useState<number>(0);

  // Scenarios local state
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioEvents, setScenarioEvents] = useState<SceneEventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SceneEventData | null>(null);
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<number | undefined>(undefined);
  const [validationErrors, setValidationErrors] = useState<{ message: string; line_number?: number }[]>([]);
  const [compileLogs, setCompileLogs] = useState<{ message: string, isError: boolean }[]>([]);

  // Events library
  const [eventDefs, setEventDefs] = useState<any[]>([]);
  const [selectedEventDefId, setSelectedEventDefId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'scenario' | 'event'>('scenario');
  const [isEditingInitials, setIsEditingInitials] = useState<boolean>(false);
  const [valueOverrides, setValueOverrides] = useState<Record<string, Record<string, number>>>({});
  const [newFileModal, setNewFileModal] = useState<{ type: 'scenario' | 'event', name: string } | null>(null);
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState<{ type: 'scenario' | 'event', id: string, name: string } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState<boolean>(false);
  const [selectedManageScenarios, setSelectedManageScenarios] = useState<string[]>([]);
  const [selectedManageEvents, setSelectedManageEvents] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);

  // Simulation UI state
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [simulationDuration, setSimulationDuration] = useState<number>(0);

  // UI state
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<'source' | 'log' | 'diagnostics' | 'inspector' | 'monitor'>('source');

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
    api.getScenarios(selectedStation).then(res => {
      setScenarios(res);
      if (res.length > 0 && !selectedScenarioId && !selectedEventDefId) {
        setSelectedScenarioId(res[0].id);
      }
    }).catch(console.error);
    if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs).catch(console.error);
  }, [selectedStation, selectedScenarioId, selectedEventDefId]);

  useEffect(() => {
    if (editingType === 'scenario' && selectedScenarioId) {
      api.getScenarioSource(selectedScenarioId).then(res => {
        const src = res.source.replace(/\r\n/g, '\n');
        setScenarioSource(src);
        setSavedScenarioSource(src);
        setSourceVersion(v => v + 1);
      }).catch(console.error);
    } else if (editingType === 'event' && selectedEventDefId) {
      api.getEventDefinitionSource(selectedEventDefId).then(res => {
        const src = res.source.replace(/\r\n/g, '\n');
        setScenarioSource(src);
        setSavedScenarioSource(src);
        setSourceVersion(v => v + 1);
      }).catch(console.error);
      // keep scenario running
    } else {
      setScenarioSource('');
      setSavedScenarioSource('');
      setSourceVersion(v => v + 1);
      // keep scenario running
    }
  }, [selectedScenarioId, selectedEventDefId, editingType, selectedStation]);

  // Ctrl+S handler is implemented below saveSource

  useEffect(() => {
    if (editingType === 'scenario' && scenarioSource) {
      const timer = setTimeout(() => {
        const start = performance.now();
        api.parseScenarioRaw(scenarioSource)
          .then(events => {
            const end = performance.now();
            setCompileLogs([{ message: `Successfully compiled in ${(end - start).toFixed(1)}ms`, isError: false }]);
            setScenarioEvents(events);
            setErrorLine(undefined);
            setValidationErrors([]);
          })
          .catch(err => {
            const end = performance.now();
            setCompileLogs([{ message: `Failed to compile after ${(end - start).toFixed(1)}ms`, isError: true }]);
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
      setCompileLogs([]);
    }
  }, [scenarioSource, editingType]);

  // Auto-stop simulation when simulationDuration is reached
  useEffect(() => {
    if (runId && simulationDuration > 0 && simTime >= simulationDuration && (simStatus === 'RUNNING' || simStatus === 'running')) {
      handleStartStop(); // This handles stopping and flushing telemetry
    }
  }, [runId, simTime, simStatus, simulationDuration]);

  // Auto-flush telemetry periodically while running
  useEffect(() => {
    let flushInterval: any;
    if (runId && (simStatus === 'RUNNING' || simStatus === 'running' || simStatus === 'PAUSED' || simStatus === 'paused')) {
      flushInterval = setInterval(async () => {
        try {
          await fetch(`${import.meta.env.VITE_API_URL || '/api'}/simulations/${runId}/telemetry/flush`, { method: 'POST' });
        } catch (e) { console.error('Flush error:', e); }
      }, 5000);
    }
    return () => {
      if (flushInterval) clearInterval(flushInterval);
    };
  }, [runId, simStatus]);

  const handleStartStop = async () => {
    if (!runId) {
      if (!selectedStation || !selectedScenarioId) return;
      try {
        await saveSource();
        const res = await api.createSimulation(selectedStation, selectedScenarioId, 20.0, Object.keys(valueOverrides).length > 0 ? valueOverrides : undefined);
        setRunId(res.runId);
        setSimStatus(res.status);
        if (telemetryEnabled) {
          await api.setTelemetryPublishing(res.runId, true);
        }
      } catch (err: any) {
        alert("Failed to start simulation: " + (err.message || err.toString()));
      }
    } else {
      if (telemetryEnabled) {
        try {
          await fetch(`${import.meta.env.VITE_API_URL || '/api'}/simulations/${runId}/telemetry/flush`, { method: 'POST' });
        } catch (e) {
          console.error('Final flush error:', e);
        }
        if ((window as any).__telemetryFlushInterval) {
          clearInterval((window as any).__telemetryFlushInterval);
          delete (window as any).__telemetryFlushInterval;
        }
      }
      await api.stopSimulation(runId);
      setRunId(null);
      setSimStatus('Ready');
      setSimTime(0);
      setSimState(null);
    }
  };

  const handlePlayPause = async () => {
    if (!runId) return;

    if (simStatus === 'RUNNING' || simStatus === 'running') {
      const res = await api.pauseSimulation(runId);
      setSimStatus(res.status);
    } else {
      const res = await api.playSimulation(runId, 1.0 / playbackSpeed);
      setSimStatus(res.status);
    }
  };

  const handleStep = async () => {
    if (!runId) return;
    try {
      await api.stepSimulation(runId);
      const state = await api.getSimulationState(runId);
      setSimTime(state.simulation_time);
      setSimState(state);
      setSimStatus(state.status);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSeek = async (time: number) => {
    if (!runId || (simStatus !== 'paused' && simStatus !== 'PAUSED')) return;
    try {
      const history = await api.getTelemetryHistory(selectedStation!, runId);
      const records = history.sort((a: any, b: any) => a.simulation_time - b.simulation_time);
      if (records.length === 0) return;

      let targetRecord = records[0];
      for (const r of records) {
        if (r.simulation_time <= time) {
          targetRecord = r;
        } else {
          break;
        }
      }

      const fullState = await api.getTelemetryRecord(targetRecord.id);
      const mappedState: any = { components: {}, connections: {}, external: fullState.external || {} };

      fullState.components.forEach((c: any) => {
        mappedState.components[c.component_name] = { status: c.status, value: c.value_json };
      });
      fullState.connections.forEach((c: any) => {
        mappedState.connections[`${c.source_name}-${c.target_name}-${c.type}`] = { status: c.status };
      });

      liveStateRef.current = mappedState;
      setSimTime(time);
    } catch (e) {
      console.error("Seek failed:", e);
    }
  };

  const handleSetInitial = (componentName: string, key: string, val: number) => {
    setValueOverrides(prev => ({
      ...prev,
      [componentName]: {
        ...(prev[componentName] || {}),
        [key]: val
      }
    }));
  };

  const handleResetInitials = (componentName: string) => {
    setValueOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[componentName];
      return newOverrides;
    });
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
    } else if (editingType === 'event' && selectedEventDefId) {
      await api.updateEventDefinitionSource(selectedEventDefId, cleanSource);
      setScenarioSource(cleanSource); setSavedScenarioSource(cleanSource);
    }
  };

  // Ctrl+S handler using latest saveSource
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSource();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveSource]);

  const toggleBottomTab = (tab: 'source' | 'log' | 'diagnostics' | 'inspector' | 'monitor') => {
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
      // If the event had a multi-line block, replace all lines
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
      lines.splice(idx, endIdx - idx + 1, ...newSourceSnippet.split('\n'));
      const newSource = lines.join('\n');
      setScenarioSource(newSource);
      setSourceVersion(v => v + 1);
      // Re-parse and update selectedEvent so the inspector refreshes
      api.parseScenarioRaw(newSource)
        .then(events => {
          setScenarioEvents(events);
          // Find the updated event at the same source location
          const updated = events.find((ev: SceneEventData) => ev.source_location === event.source_location);
          if (updated) setSelectedEvent(updated);
        })
        .catch(console.error);
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
      setSourceVersion(v => v + 1);
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
      setSourceVersion(v => v + 1);
      if (selectedEvent === event) setSelectedEvent(null);
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedManageScenarios) {
      await api.deleteScenario(id);
      if (selectedScenarioId === id) setSelectedScenarioId(null);
    }
    for (const id of selectedManageEvents) {
      await api.deleteEventDefinition(id);
      if (selectedEventDefId === id) setSelectedEventDefId(null);
    }
    if (selectedStation) {
      api.getScenarios(selectedStation).then(setScenarios);
      api.getEventDefinitions(selectedStation).then(setEventDefs);
    }
    setIsManageMode(false);
    setSelectedManageScenarios([]);
    setSelectedManageEvents([]);
    setShowBulkDeleteModal(false);
  };

  const libraryTabContent = (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => {
              setIsManageMode(!isManageMode);
              setSelectedManageScenarios([]);
              setSelectedManageEvents([]);
            }}
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: isManageMode ? 'var(--accent-blue)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
          >
            {isManageMode ? 'Cancel' : 'Manage'}
          </button>
          {isManageMode && (
            <button
              onClick={() => {
                if (selectedManageScenarios.length === scenarios.length && selectedManageEvents.length === eventDefs.length) {
                  setSelectedManageScenarios([]);
                  setSelectedManageEvents([]);
                } else {
                  setSelectedManageScenarios(scenarios.map(s => s.id));
                  setSelectedManageEvents(eventDefs.map(e => e.id));
                }
              }}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
            >
              {selectedManageScenarios.length === scenarios.length && selectedManageEvents.length === eventDefs.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        {isManageMode && (selectedManageScenarios.length > 0 || selectedManageEvents.length > 0) && (
          <button
            onClick={() => setShowBulkDeleteModal(true)}
            style={{ background: '#ef4444', border: 'none', color: 'white', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Trash2 size={12} /> Delete Selected
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginTop: '8px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Scenarios</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {isManageMode && (
            <button
              onClick={() => {
                if (selectedManageScenarios.length === scenarios.length) {
                  setSelectedManageScenarios([]);
                } else {
                  setSelectedManageScenarios(scenarios.map(s => s.id));
                }
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px' }}
            >
              Select All
            </button>
          )}
          {!isManageMode && (
            <button
              onClick={() => {
                setNewFileModal({ type: 'scenario', name: 'New Scenario' });
                setNewFileError(null);
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="New File..."
            >
              <FilePlus size={14} />
            </button>
          )}
        </div>
      </div>
      {scenarios.map(s => (
        <div
          key={s.id}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none',
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginBottom: '2px',
            backgroundColor: selectedScenarioId === s.id && !isManageMode ? 'var(--bg-input)' : 'transparent',
            color: selectedScenarioId === s.id && !isManageMode ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
          onClick={() => {
            if (isManageMode) {
              setSelectedManageScenarios(prev => 
                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
              );
            } else {
              if (selectedScenarioId === s.id) {
                setSelectedScenarioId(null);
                setScenarioEvents([]);
                setRunId(null);
                setSimStatus('Ready');
                if (editingType === 'scenario') setScenarioSource('');
              } else {
                setEditingType('scenario');
                setSelectedScenarioId(s.id);
                setSelectedEventDefId(null);
                setBottomTab('source');
                setBottomOpen(true);
              }
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1, minWidth: 0 }}>
            {isManageMode && (
              <input 
                type="checkbox" 
                checked={selectedManageScenarios.includes(s.id)}
                readOnly
                style={{ cursor: 'pointer' }}
              />
            )}
            <FileText size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}.scene</span>
          </div>
          {!isManageMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameModal({ type: 'scenario', id: s.id, name: s.name });
                  setRenameError(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Rename Scenario"
              >
                <Edit2 size={12} />
              </button>
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
          )}
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', marginTop: '24px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Event Definitions</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {isManageMode && (
            <button
              onClick={() => {
                if (selectedManageEvents.length === eventDefs.length) {
                  setSelectedManageEvents([]);
                } else {
                  setSelectedManageEvents(eventDefs.map(e => e.id));
                }
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px' }}
            >
              Select All
            </button>
          )}
          {!isManageMode && (
            <button
              onClick={() => {
                setNewFileModal({ type: 'event', name: 'New Event' });
                setNewFileError(null);
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="New File..."
            >
              <FilePlus size={14} />
            </button>
          )}
        </div>
      </div>
      {eventDefs.map((e, i) => (
        <div
          key={i}
          draggable={!isManageMode}
          onDragStart={(evt) => {
            if (!isManageMode) {
              evt.dataTransfer.setData('text/plain', e.name);
              evt.dataTransfer.setData('application/x-event-def', 'true');
            }
          }}
          onClick={() => {
            if (isManageMode) {
              setSelectedManageEvents(prev => 
                prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id]
              );
            } else {
              if (selectedEventDefId === e.id) {
                setSelectedEventDefId(null);
              } else {
                setEditingType('event');
                setSelectedEventDefId(e.id);
                setBottomTab('source');
                setBottomOpen(true);
              }
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', cursor: isManageMode ? 'pointer' : 'grab', marginBottom: '2px',
            backgroundColor: selectedEventDefId === e.id && !isManageMode ? 'var(--bg-input)' : 'transparent',
            color: selectedEventDefId === e.id && !isManageMode ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1, minWidth: 0 }}>
            {isManageMode && (
              <input 
                type="checkbox" 
                checked={selectedManageEvents.includes(e.id)}
                readOnly
                style={{ cursor: 'pointer' }}
              />
            )}
            <FileText size={14} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}.event</span>
          </div>
          {!isManageMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={(evt) => {
                  evt.stopPropagation();
                  setRenameModal({ type: 'event', id: e.id, name: e.name });
                  setRenameError(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Rename Event Definition"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={async (evt) => {
                  evt.stopPropagation();
                  if (confirm('Delete event definition?')) {
                    await api.deleteEventDefinition(e.id);
                    if (selectedEventDefId === e.id) setSelectedEventDefId(null);
                    if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs);
                  }
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Delete Event Definition"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const customTabs = useMemo(() => [
    { id: 'library', icon: <Library size={20} />, title: 'Scenario Library', content: libraryTabContent }
  ], [libraryTabContent]);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      <style>{
        `.glass-btn-sm {
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
        .modal-btn:focus {
          outline: 2px solid var(--accent-blue);
          outline-offset: 2px;
      }`}</style>

      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Dropdown
            value={selectedScenarioId || ''}
            onChange={val => { setSelectedScenarioId(val || null); setEditingType('scenario'); }}
            options={scenarios.map(s => ({ value: s.id, label: s.name }))}
            placeholder="-- Select Scenario --"
            style={{ minWidth: 200 }}
          />
          <button className="glass-btn-sm" onClick={() => { setSelectedScenarioId(null); setScenarioEvents([]); setRunId(null); setSimStatus('Ready'); if (editingType === 'scenario') setScenarioSource(''); }} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Deselect</button>

          <button className="glass-btn-sm" onClick={saveSource} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={14} />
            Save
          </button>
          {scenarioSource !== savedScenarioSource && (
            <span style={{ fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              Unsaved changes
            </span>
          )}

          <span style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
            {simStatus} | T={formatTime(simTime || 0)}
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
              onClick={() => setIsEditingInitials(!isEditingInitials)}
              style={{
                fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)',
                backgroundColor: isEditingInitials ? 'var(--accent-blue)' : 'var(--bg-input)',
                color: isEditingInitials ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Toggle Edit Initials mode on components"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button
              onClick={() => {
                setValueOverrides({});
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
              onClick={() => {
                setTelemetryEnabled(!telemetryEnabled);
              }}
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

          {/* Duration Limit Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Stop at:</span>
            <input
              type="number"
              value={simulationDuration || ''}
              onChange={e => setSimulationDuration(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="∞"
              style={{ width: 45, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, padding: '2px 4px', fontSize: 11 }}
            />
          </div>

          {/* Playback Speed Dropdown */}
          <Dropdown
            value={playbackSpeed.toString()}
            onChange={async (val) => {
              const speed = parseFloat(val);
              setPlaybackSpeed(speed);
              if (runId && (simStatus === 'RUNNING' || simStatus === 'running')) {
                await api.playSimulation(runId, 1.0 / speed);
              }
            }}
            options={[
              { value: "1", label: "1x Speed" },
              { value: "2", label: "2x Speed" },
              { value: "5", label: "5x Speed" },
              { value: "10", label: "10x Speed" },
              { value: "60", label: "60x Speed" },
              { value: "240", label: "MAX (240x)" },
            ]}
            style={{ minWidth: 100, marginLeft: 8 }}
          />

          {/* Start/Stop Button */}
          <button
            onClick={handleStartStop}
            style={{ padding: '8px', backgroundColor: runId ? '#ef4444' : 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', marginLeft: 8 }}
            title={runId ? "Stop Simulation" : "Start Simulation"}
          >
            {runId ? <Pause size={20} style={{ transform: 'rotate(90deg)' }} /> : <Play size={20} />}
          </button>

          <button
            onClick={handlePlayPause}
            disabled={!runId}
            style={{
              padding: '8px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px',
              cursor: runId ? 'pointer' : 'not-allowed', boxShadow: 'var(--shadow-sm)', marginLeft: 8,
              opacity: runId ? 1.0 : 0.5
            }}
            title="Play/Pause"
          >
            {(simStatus === 'RUNNING' || simStatus === 'running') ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '16px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: leftOpen ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              title="Toggle Left Panel"
            >
              <PanelLeft size={18} />
            </button>
            <button
              onClick={() => setTimelineOpen(!timelineOpen)}
              style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: timelineOpen ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              title="Toggle Bottom Panel"
            >
              <PanelBottom size={18} />
            </button>
            <button
              onClick={() => setBottomOpen(!bottomOpen)}
              style={{ padding: '6px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: bottomOpen ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
              title="Toggle Right Panel"
            >
              <PanelRight size={18} />
            </button>
          </div>
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
              leftPanelOpen={leftOpen}
              isEditingInitials={isEditingInitials}
              setIsEditingInitials={setIsEditingInitials}
              onSetInitials={handleSetInitial}
              onResetInitials={handleResetInitials}
              hideEditInitials={true}
              valueOverrides={valueOverrides}
              runtime={runtime}
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
                      {bottomTab === 'log' ? 'Simulation Log' : bottomTab}
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
                    fileType={editingType}
                    selectedLine={selectedEvent?.source_location ? selectedEvent.source_location - 1 : undefined}
                    errorLine={errorLine}
                    sourceVersion={sourceVersion}
                  />
                </div>
              )}

              {bottomTab === 'log' && (
                <div style={{ padding: '16px', height: '100%', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px' }}>
                  {compileLogs.map((log, i) => (
                    <div key={`comp-${i}`} style={{ color: log.isError ? '#ef4444' : '#10b981', marginBottom: '8px' }}>
                      [Compiler] {log.message}
                    </div>
                  ))}
                  {validationErrors.map((err, i) => (
                    <div key={`err-${i}`} style={{ color: '#ef4444', marginBottom: '8px' }}>
                      [Parse Error] {err.line_number !== undefined ? `Line ${err.line_number + 1}: ` : ''}{err.message}
                    </div>
                  ))}

                  {runId && <div style={{ borderTop: '1px solid var(--border-color)', margin: '12px 0' }} />}

                  {runId && simLog.map((log, i) => (
                    <div key={`sim-${i}`} style={{ marginBottom: '4px', color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>[{formatTime(log.time || 0)}]</span> {log.message || JSON.stringify(log)}
                    </div>
                  ))}
                </div>
              )}

              {bottomTab === 'diagnostics' && (
                <div style={{ padding: '16px', height: '100%', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px' }}>
                  {simLog.length === 0 ? (
                    <div style={{ color: 'var(--text-tertiary)' }}>No simulation diagnostics recorded yet.</div>
                  ) : (
                    simLog.map((log, i) => (
                      <div key={`sim-${i}`} style={{ marginBottom: '4px', color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>[{log.time?.toFixed(1) || '0.0'}h]</span> {log.message || JSON.stringify(log)}
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
              <span>TIMELINE</span>
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
              events={scenarioEvents}
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
              onSeek={handleSeek}
            />
          )}
        </div>
      </div>

      {/* New File Modal */}
      {newFileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNewFileModal(null);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              const name = newFileModal.name.trim();
              if (!name) return;
              try {
                if (newFileModal.type === 'scenario' && selectedStation) {
                  const res = await api.createScenario(selectedStation, name, '');
                  api.getScenarios(selectedStation).then(setScenarios);
                  setSelectedScenarioId(res.id);
                  setEditingType('scenario');
                  setSelectedEventDefId(null);
                } else if (newFileModal.type === 'event' && selectedStation) {
                  const res = await api.createEventDefinition(selectedStation, name);
                  if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs);
                  setEditingType('event');
                  setSelectedEventDefId(res.id);
                  setSelectedScenarioId(null);
                }
                setBottomTab('source');
                setBottomOpen(true);
                setNewFileModal(null);
                setNewFileError(null);
              } catch (err: any) {
                setNewFileError(err.message || 'Failed to create file');
              }
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '300px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}
          >
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>New {newFileModal.type === 'scenario' ? 'Scenario' : 'Event'}</h3>
            {newFileError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{newFileError}</div>}
            <input
              autoFocus
              type="text"
              value={newFileModal.name}
              onChange={e => setNewFileModal({ ...newFileModal, name: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="modal-btn"
                onClick={() => setNewFileModal(null)}
                style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn"
                style={{ padding: '6px 12px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename File Modal */}
      {renameModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form
            onKeyDown={(e) => {
              if (e.key === 'Escape') setRenameModal(null);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              const name = renameModal.name.trim();
              if (!name) return;
              try {
                if (renameModal.type === 'scenario') {
                  await api.renameScenario(renameModal.id, name);
                  if (selectedStation) api.getScenarios(selectedStation).then(setScenarios);
                } else if (renameModal.type === 'event') {
                  await api.renameEventDefinition(renameModal.id, name);
                  if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs);
                }
                setRenameModal(null);
                setRenameError(null);
              } catch (err: any) {
                setRenameError(err.message || 'Failed to rename file');
              }
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '300px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}
          >
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Rename {renameModal.type === 'scenario' ? 'Scenario' : 'Event'}</h3>
            {renameError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{renameError}</div>}
            <input
              autoFocus
              type="text"
              value={renameModal.name}
              onChange={e => setRenameModal({ ...renameModal, name: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="modal-btn"
                onClick={() => setRenameModal(null)}
                style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn"
                style={{ padding: '6px 12px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Confirm Bulk Deletion</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete {selectedManageScenarios.length} scenario(s) and {selectedManageEvents.length} event definition(s)?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="modal-btn"
                onClick={() => setShowBulkDeleteModal(false)}
                style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="modal-btn"
                style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
