import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { useStation } from '../components/StationContext';
import { TwinViewer } from '../components/TwinViewer';
import { TimelineEditor } from '../components/TimelineEditor';
import { DSLEditor } from '../components/DSLEditor';
import type { SceneEventData } from '../components/TimelineEditor';
import { EventInspector } from '../components/EventInspector';
import { SimulationMonitor } from '../components/SimulationMonitor';
import { Play, Pause, RefreshCw, StepForward, Code, List, Activity, Library, ChevronUp, ChevronDown, MousePointer2, LayoutDashboard, Trash2, FileText, FilePlus, PanelLeft, PanelRight, PanelBottom, Edit2, X, RotateCcw, Radio, Square, PlayCircle } from 'lucide-react';
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
    simLog, setSimLog,
    diagLog, setDiagLog,
    simState, setSimState
  } = useStation();

  const [savedScenarioSource, setSavedScenarioSource] = useState<string>('');
  const [sourceVersion, setSourceVersion] = useState<number>(0);

  // Scenarios local state
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioEvents, setScenarioEvents] = useState<SceneEventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SceneEventData | null>(null);
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);
  const [errorLines, setErrorLines] = useState<number[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ message: string; line_number?: number }[]>([]);
  const [compileLogs, setCompileLogs] = useState<{ message: string, isError: boolean }[]>([]);

  useEffect(() => {
    setSelectedEvent(prev => {
      if (!prev) return null;
      if (scenarioEvents.includes(prev)) return prev;

      // Match strictly by exact location and ref
      let match = scenarioEvents.find(e => e.source_location === prev.source_location && e.event_ref === prev.event_ref);
      
      return match || null;
    });
  }, [scenarioEvents]);

  // Events library
  const [eventDefs, setEventDefs] = useState<any[]>([]);
  const [selectedEventDefId, setSelectedEventDefId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'scenario' | 'event'>('scenario');
  const [isEditingInitials, setIsEditingInitials] = useState<boolean>(false);
  const [valueOverrides, setValueOverrides] = useState<Record<string, Record<string, number>>>({});
  const [newFileModal, setNewFileModal] = useState<{ type: 'scenario' | 'event', name: string, startAfter?: boolean } | null>(null);
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState<{ type: 'scenario' | 'event', id: string, name: string } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState<boolean>(false);
  const [selectedManageScenarios, setSelectedManageScenarios] = useState<string[]>([]);
  const [selectedManageEvents, setSelectedManageEvents] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [deleteModal, setDeleteModal] = useState<{ type: 'scenario' | 'event', id: string, name: string } | null>(null);

  // Simulation UI state
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [simulationDuration, setSimulationDuration] = useState<number>(0);

  // UI state
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<'source' | 'log' | 'diagnostics' | 'inspector' | 'monitor'>('source');

  const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTimelineZoom(z => {
      const next = [...ZOOM_STEPS].reverse().find(s => s < z);
      return next || ZOOM_STEPS[0];
    });
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTimelineZoom(z => {
      const next = ZOOM_STEPS.find(s => s > z);
      return next || ZOOM_STEPS[ZOOM_STEPS.length - 1];
    });
  };

  const handleZoomReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTimelineZoom(100);
  };

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
  }, [selectedStation]); // Run ONLY when selectedStation changes

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
        api.parseScenarioRaw(scenarioSource, selectedStation)
          .then(events => {
            const end = performance.now();
            setCompileLogs([{ message: `Successfully compiled in ${(end - start).toFixed(1)}ms`, isError: false }]);
            setScenarioEvents(events);
            setErrorLines([]);
            setValidationErrors([]);
          })
          .catch(err => {
            const end = performance.now();
            setCompileLogs([{ message: `Failed to compile after ${(end - start).toFixed(1)}ms`, isError: true }]);
            console.error(err);
            if (err.events) {
              setScenarioEvents(err.events);
            }
            if (err.errors) {
              setErrorLines(err.errors.map((e: any) => e.line_number).filter((n: any) => n !== undefined));
              setValidationErrors(err.errors);
            } else if (err.line_number !== undefined) {
              setErrorLines([err.line_number]);
              setValidationErrors([{ message: err.message, line_number: err.line_number }]);
            } else {
              setErrorLines([]);
              setValidationErrors([{ message: err.message || err.toString() }]);
            }
          });
      }, 500);
      return () => clearTimeout(timer);
    } else if (editingType === 'scenario' && !scenarioSource) {
      setScenarioEvents([]);
      setErrorLines([]);
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

  const startSimulationWithScenario = async (targetScenarioId: string) => {
    if (!selectedStation) return;
    try {
      const res = await api.createSimulation(selectedStation, targetScenarioId, 20.0, Object.keys(valueOverrides).length > 0 ? valueOverrides : undefined);
      setRunId(res.runId);
      setSimStatus(res.status);
      if (telemetryEnabled) {
        await api.setTelemetryPublishing(res.runId, true);
      }
    } catch (err: any) {
      alert("Failed to start simulation: " + (err.message || err.toString()));
    }
  };

  const handleStartStop = async () => {
    if (!runId) {
      if (!selectedStation) return;
      if (errorLines.length > 0 || validationErrors.length > 0 || compileLogs.some(log => log.isError)) return;
      
      if (!selectedScenarioId) {
        setNewFileModal({ type: 'scenario', name: 'new_scenario', startAfter: true });
        return;
      }
      
      await saveSource();
      startSimulationWithScenario(selectedScenarioId);
      setEditingType('scenario');
      setSelectedEventDefId(null);
      setIsEditingInitials(false);
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
      setSimLog([]);
      setDiagLog([]);
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
    setSimLog([]);
    setDiagLog([]);
  };

  const saveSource = async () => {
    const cleanSource = scenarioSource.replace(/\r/g, '');
    if (editingType === 'scenario' && selectedScenarioId) {
      await api.updateScenarioSource(selectedScenarioId, cleanSource);
      setScenarioSource(cleanSource); setSavedScenarioSource(cleanSource);
    } else if (editingType === 'event' && selectedEventDefId) {
      await api.updateEventDefinitionSource(selectedEventDefId, cleanSource);
      setScenarioSource(cleanSource); setSavedScenarioSource(cleanSource);
      if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs).catch(console.error);
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

  const handleUpdateEvent = async (event: SceneEventData, newSourceSnippet: string) => {
    if (!event.source_location || !selectedScenarioId) return;
    
    let currentSceneSource = scenarioSource;
    if (editingType !== 'scenario') {
      try {
        const res = await api.getScenarioSource(selectedScenarioId);
        currentSceneSource = res.source;
      } catch (e) { console.error(e); return; }
    }

    const lines = currentSceneSource.split('\n');
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
      
      if (editingType === 'scenario') {
        setScenarioSource(newSource);
        setSourceVersion(v => v + 1);
      } else {
        await api.updateScenarioSource(selectedScenarioId, newSource);
      }

      // Re-parse and update selectedEvent so the inspector refreshes
      api.parseScenarioRaw(newSource, selectedStation)
        .then(events => {
          setScenarioEvents(events);
          const updated = events.find((ev: SceneEventData) => ev.source_location === event.source_location);
          if (updated) setSelectedEvent(updated);
        })
        .catch(console.error);
    }
  };

  const handleUpdateEventLocation = async (event: SceneEventData, newAt: number, newDuration: number | null) => {
    if (!event.source_location || !selectedScenarioId) return;
    
    let currentSceneSource = scenarioSource;
    if (editingType !== 'scenario') {
      try {
        const res = await api.getScenarioSource(selectedScenarioId);
        currentSceneSource = res.source;
      } catch (e) { console.error(e); return; }
    }

    const lines = currentSceneSource.split('\n');
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
      const newSource = lines.join('\n');
      
      if (editingType === 'scenario') {
        setScenarioSource(newSource);
        setSourceVersion(v => v + 1);
      } else {
        await api.updateScenarioSource(selectedScenarioId, newSource);
      }
      
      api.parseScenarioRaw(newSource, selectedStation).then(setScenarioEvents).catch(console.error);
    }
  };

  const handleDeleteEventFromTimeline = async (event: SceneEventData) => {
    if (!event.source_location || !selectedScenarioId) return;
    
    let currentSceneSource = scenarioSource;
    if (editingType !== 'scenario') {
      try {
        const res = await api.getScenarioSource(selectedScenarioId);
        currentSceneSource = res.source;
      } catch (e) { console.error(e); return; }
    }

    const lines = currentSceneSource.split('\n');
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
      const newSource = lines.join('\n');
      
      if (editingType === 'scenario') {
        setScenarioSource(newSource);
        setSourceVersion(v => v + 1);
      } else {
        await api.updateScenarioSource(selectedScenarioId, newSource);
      }

      if (selectedEvent === event) setSelectedEvent(null);
      api.parseScenarioRaw(newSource, selectedStation).then(setScenarioEvents).catch(console.error);
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
            disabled={!!runId}
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--border-color)', 
              color: isManageMode ? 'var(--accent-blue)' : 'var(--text-secondary)', 
              cursor: !!runId ? 'not-allowed' : 'pointer', 
              fontSize: '11px', 
              padding: '4px 8px', 
              borderRadius: '4px',
              opacity: !!runId ? 0.5 : 1
            }}
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
                setNewFileModal({ type: 'scenario', name: 'new_scenario' });
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
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', cursor: (!!runId && s.id !== selectedScenarioId) ? 'not-allowed' : 'pointer', marginBottom: '2px',
            backgroundColor: selectedScenarioId === s.id && !isManageMode ? 'var(--bg-input)' : 'transparent',
            color: selectedScenarioId === s.id && !isManageMode ? 'var(--text-primary)' : 'var(--text-secondary)',
            opacity: (!!runId && s.id !== selectedScenarioId) ? 0.5 : 1,
          }}
          onClick={() => {
            if (!!runId && s.id !== selectedScenarioId) return;
            if (isManageMode) {
              setSelectedManageScenarios(prev => 
                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
              );
            } else {
              setEditingType('scenario');
              setSelectedScenarioId(s.id);
              setSelectedEventDefId(null);
              setBottomTab('source');
              setBottomOpen(true);
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
                disabled={!!runId}
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameModal({ type: 'scenario', id: s.id, name: s.name });
                  setRenameError(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: !!runId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                title="Rename Scenario"
              >
                <Edit2 size={12} />
              </button>
              <button
                disabled={!!runId}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteModal({ type: 'scenario', id: s.id, name: s.name });
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: !!runId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
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
                setNewFileModal({ type: 'event', name: 'new_event' });
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
              setEditingType('event');
              setSelectedEventDefId(e.id);
              setBottomTab('source');
              setBottomOpen(true);
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', cursor: isManageMode ? 'pointer' : 'grab', marginBottom: '2px',
            backgroundColor: selectedEventDefId === e.id && !isManageMode ? 'var(--bg-input)' : 'transparent',
            color: selectedEventDefId === e.id && !isManageMode ? 'var(--text-primary)' : 'var(--text-secondary)'
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
                disabled={!!runId}
                onClick={(evt) => {
                  evt.stopPropagation();
                  setRenameModal({ type: 'event', id: e.id, name: e.name });
                  setRenameError(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: !!runId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                title="Rename Event Definition"
              >
                <Edit2 size={12} />
              </button>
              <button
                disabled={!!runId}
                onClick={(evt) => {
                  evt.stopPropagation();
                  setDeleteModal({ type: 'event', id: e.id, name: e.name });
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: !!runId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
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

  const RightIconBtn = ({ icon, active, onClick, title }: any) => (
    <div
      onClick={onClick}
      title={title}
      style={{
        width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
        borderRight: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
        background: active ? 'rgba(99,219,188,0.08)' : 'transparent',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = active ? 'rgba(99,219,188,0.08)' : 'var(--hover-overlay)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? 'var(--accent-primary)' : 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.background = active ? 'rgba(99,219,188,0.08)' : 'transparent'; }}
    >
      {icon}
    </div>
  );

  const hasCompilationErrors = errorLines.length > 0 || validationErrors.length > 0 || compileLogs.some(log => log.isError);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      <style>{
        `.topbar-select {
          transition: border-color 0.2s;
        }
        .topbar-select:hover {
          border-color: var(--accent-primary) !important;
        }

        .modal-btn:focus {
          outline: 2px solid var(--accent-primary);
          outline-offset: 2px;
      }`}</style>

      {/* Top Bar */}
      <div style={{ position: 'relative', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: 'var(--bg-panel-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        {/* LEFT: Scenario Management & Component Config */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Dropdown
            disabled={!!runId}
            value={selectedScenarioId || ''}
            onChange={val => { setSelectedScenarioId(val || null); setEditingType('scenario'); }}
            options={scenarios.map(s => ({ value: s.id, label: s.name }))}
            placeholder="-- Select Scenario --"
            style={{ minWidth: 220, height: 30 }}
          />
          {selectedScenarioId && (
            <button disabled={!!runId} className="btn-glass" onClick={() => { setSelectedScenarioId(null); setScenarioEvents([]); setRunId(null); setSimStatus('Ready'); if (editingType === 'scenario') setScenarioSource(''); }} title="Deselect Scenario" style={{ padding: '0 8px' }}>
              <X size={15} />
            </button>
          )}
          <button className="btn-glass" onClick={saveSource} title="Save Scenario">
            <FileText size={15} />
            Save
          </button>
          {scenarioSource !== savedScenarioSource && (
            <span style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, padding: '0 4px', height: 30 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              Unsaved
            </span>
          )}

          <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

          {/* Tolerance & Editing Fields */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>TOL:</span>
            <input
              type="number"
              disabled={!!runId}
              ref={globalToleranceInputRef}
              defaultValue={20}
              onBlur={(e) => { if (runId) api.setGlobalTolerance(runId, parseFloat(e.target.value)); }}
              style={{
                width: '45px', height: 30, background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', padding: '0 6px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
                textAlign: 'center', outline: 'none'
              }}
            />
            <button
              disabled={!!runId}
              onClick={() => {
                if (runId) api.setGlobalTolerance(runId, 20);
                if (globalToleranceInputRef.current) globalToleranceInputRef.current.value = '20';
              }}
              className="btn-glass"
              style={{ padding: '0 8px' }}
              title="Reset Tolerance (20)"
            >
              <RotateCcw size={15} />
            </button>
          </div>
          
          <button
            disabled={!!runId}
            onClick={() => setIsEditingInitials(!isEditingInitials)}
            className={`btn-glass ${isEditingInitials ? "active" : ""}`}
            style={{ padding: '0 8px' }}
            title="Edit Initials"
          >
            <Edit2 size={15} />
          </button>

          <button
            disabled={!!runId}
            onClick={() => {
              setValueOverrides({});
              if (runId) {
                api.resetSimulation(runId);
                setSimStatus('Ready');
                setSimTime(0);
              }
            }}
            className="btn-glass"
            style={{ padding: '0 10px' }}
            title="Reset All Overrides"
          >
            <RefreshCw size={15} />
            Reset All
          </button>
          <button
            onClick={() => setTelemetryEnabled(!telemetryEnabled)}
            className={`btn-glass ${telemetryEnabled ? 'active' : ''}`}
            style={telemetryEnabled ? { color: '#ef4444', borderColor: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.1)', padding: '0 10px' } : { padding: '0 10px' }}
            title="Toggle Telemetry Recording"
          >
            <Radio size={15} /> {telemetryEnabled ? 'REC' : 'OFF'}
          </button>
        </div>

        {/* RIGHT: Playback & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* YouTube-style Status & Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: 30 }}>
            {simStatus.toUpperCase() === 'RUNNING' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 600, fontSize: '11px', letterSpacing: '0.05em' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
                LIVE
              </div>
            )}
            {simStatus.toUpperCase() !== 'RUNNING' && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                {simStatus.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {formatTime(simTime || 0)}
            </span>
          </div>

          <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 2px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>STOP:</span>
            <input
              type="number"
              disabled={!!runId}
              value={simulationDuration || ''}
              onChange={e => setSimulationDuration(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="∞"
              style={{ width: 45, height: 30, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '0 6px', fontSize: 12, textAlign: 'center', outline: 'none' }}
            />
          </div>

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
            style={{ minWidth: 100, height: 30 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn-glass" onClick={handleReset} style={{ padding: '0 8px' }} title="Reset Run">
              <RotateCcw size={16} />
            </button>
            <button 
              className="btn-glass" 
              onClick={handleStep} 
              disabled={!runId}
              style={{ padding: '0 8px', opacity: runId ? 1.0 : 0.5, cursor: runId ? 'pointer' : 'not-allowed' }} 
              title="Step Forward"
            >
              <StepForward size={16} />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={!runId}
              className="btn-glass"
              style={{ padding: '0 8px', opacity: runId ? 1.0 : 0.5, cursor: runId ? 'pointer' : 'not-allowed' }}
              title="Play/Pause"
            >
              {(simStatus === 'RUNNING' || simStatus === 'running') ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={handleStartStop}
              disabled={!runId && hasCompilationErrors}
              className="btn-glass"
              style={{ padding: '0 12px', background: runId ? 'rgba(239,68,68,0.1)' : 'var(--accent-blue)', color: runId ? '#ef4444' : '#fff', borderColor: runId ? 'rgba(239,68,68,0.5)' : 'var(--accent-blue)' }}
              title={runId ? "Stop Simulation" : (!runId && hasCompilationErrors ? "Fix compilation errors to start" : "Start Simulation")}
            >
              {runId ? <Square size={16} /> : <PlayCircle size={16} />}
              <span style={{ marginLeft: 4 }}>{runId ? 'Stop' : 'Start'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px', borderLeft: '1px solid var(--border-color)', paddingLeft: '10px' }}>
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              className={`btn-glass ${leftOpen ? 'active' : ''}`}
              style={{ padding: '0 8px' }}
              title="Toggle Left Panel"
            >
              <PanelLeft size={16} />
            </button>
            <button
              onClick={() => setTimelineOpen(!timelineOpen)}
              className={`btn-glass ${timelineOpen ? 'active' : ''}`}
              style={{ padding: '0 8px' }}
              title="Toggle Bottom Panel"
            >
              <PanelBottom size={16} />
            </button>
            <button
              onClick={() => setBottomOpen(!bottomOpen)}
              className={`btn-glass ${bottomOpen ? 'active' : ''}`}
              style={{ padding: '0 8px' }}
              title="Toggle Right Panel"
            >
              <PanelRight size={16} />
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
              setLeftPanelOpen={setLeftOpen}
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
          transition: 'none',
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
                        {runId ? <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', fontStyle: 'italic', marginLeft: '6px' }}>(Read-Only)</span> : null}
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
                    errorLines={errorLines}
                    sourceVersion={sourceVersion}
                    readOnly={!!runId}
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
                  {diagLog.length === 0 ? (
                    <div style={{ color: 'var(--text-tertiary)' }}>No simulation diagnostics recorded yet.</div>
                  ) : (
                    diagLog.map((log, i) => (
                      <div key={`diag-${i}`} style={{ marginBottom: '4px', color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>[{formatTime(log.time || 0)}]</span> {log.message || JSON.stringify(log)}
                      </div>
                    ))
                  )}
                </div>
              )}

              {bottomTab === 'inspector' && (
                <EventInspector
                  disabled={!!runId}
                  event={selectedEvent}
                  eventDef={eventDefs.find(ed => ed.name === selectedEvent?.event_ref)}
                  specs={spec}
                  onUpdateEvent={(snippet) => selectedEvent && handleUpdateEvent(selectedEvent, snippet)}
                />
              )}

              {bottomTab === 'monitor' && (
                <SimulationMonitor simState={simState} />
              )}
            </div>
          )}

          {/* Vertical Strip of Tabs */}
          <div style={{ width: '48px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px', paddingBottom: '8px', backgroundColor: 'var(--bg-panel-solid)', borderLeft: '1px solid var(--border-color)', pointerEvents: 'auto', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)' }}>
            <RightIconBtn icon={<Code size={20} />} active={bottomOpen && bottomTab === 'source'} onClick={() => toggleBottomTab('source')} title="DSL Source" />
            <RightIconBtn icon={<List size={20} />} active={bottomOpen && bottomTab === 'log'} onClick={() => toggleBottomTab('log')} title="Log" />
            <RightIconBtn icon={<Activity size={20} />} active={bottomOpen && bottomTab === 'diagnostics'} onClick={() => toggleBottomTab('diagnostics')} title="Diagnostics" />
            <RightIconBtn icon={<MousePointer2 size={20} />} active={bottomOpen && bottomTab === 'inspector'} onClick={() => toggleBottomTab('inspector')} title="Inspector" />
            <RightIconBtn icon={<LayoutDashboard size={20} />} active={bottomOpen && bottomTab === 'monitor'} onClick={() => toggleBottomTab('monitor')} title="Simulation Monitor" />
          </div>
        </div>

        {/* Timeline Editor (Bottom Panel) */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: timelineOpen ? `${bottomPanelHeight}px` : '40px',
          transition: 'none',
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

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 12px', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel-secondary)' }}>
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
            
            {/* Zoom Controls */}
            {timelineOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={handleZoomOut}
                  className="btn-glass"
                  style={{ padding: '2px 8px', fontSize: 14, height: 22 }}
                  title="Zoom Out"
                >-</button>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'center', userSelect: 'none' }}>
                  {timelineZoom}%
                </div>
                <button
                  onClick={handleZoomIn}
                  className="btn-glass"
                  style={{ padding: '2px 8px', fontSize: 14, height: 22 }}
                  title="Zoom In"
                >+</button>
                <button
                  onClick={handleZoomReset}
                  className="btn-glass"
                  style={{ padding: '2px 8px', fontSize: 11, height: 22, marginLeft: '4px' }}
                  title="Reset Zoom"
                >Reset</button>
              </div>
            )}

            {selectedEvent && editingType === 'scenario' && (
              <button
                onClick={() => handleDeleteEventFromTimeline(selectedEvent)}
                style={{ height: '22px', fontSize: '10px', padding: '0 8px', display: 'flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete Instance
              </button>
            )}
            {selectedComponentName && (
              <button
                onClick={() => setSelectedComponentName(null)}
                style={{ height: '22px', fontSize: '10px', padding: '0 8px', display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer' }}
              >
                Clear Filter
              </button>
            )}
          </div>
          {timelineOpen && (
            <TimelineEditor
              events={scenarioEvents}
              simTime={simTime}
              zoom={timelineZoom}
              selectedEvent={selectedEvent}
              errorLines={errorLines}
              onSelectEvent={(ev, isCtrlKey) => {
                setSelectedEvent(ev);
                if (ev && ev.selector) {
                  if (!ev.selector.startsWith('@') || isCtrlKey) {
                    setSelectedComponentName(ev.selector.startsWith('@') ? ev.selector.slice(1) : ev.selector);
                  }
                }
                if (ev && !bottomOpen) setBottomOpen(true);
                if (ev) setBottomTab('inspector');
              }}
              onAppendEvent={async (eventRef, at) => {
                const newLine = `\nevent:${eventRef} at=${at} for=1.0`;
                if (editingType === 'scenario') {
                  setScenarioSource(prev => prev + newLine);
                } else if (selectedScenarioId) {
                  try {
                    const res = await api.getScenarioSource(selectedScenarioId);
                    const newSource = res.source + newLine;
                    await api.updateScenarioSource(selectedScenarioId, newSource);
                    api.parseScenarioRaw(newSource, selectedStation).then(setScenarioEvents).catch(console.error);
                  } catch (e) { console.error(e); }
                }
              }}
              onUpdateEventLocation={handleUpdateEventLocation}
              onDeleteEvent={handleDeleteEventFromTimeline}
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
                  setScenarioSource('');
                  setSavedScenarioSource('');
                  if (newFileModal.startAfter) {
                    startSimulationWithScenario(res.id);
                  }
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
          <form 
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowBulkDeleteModal(false);
            }}
            onSubmit={(e) => {
              e.preventDefault();
              handleBulkDelete();
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
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
                type="submit"
                autoFocus
                className="modal-btn"
                style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete Selected
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Single Delete Modal */}
      {deleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form 
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDeleteModal(null);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (deleteModal.type === 'scenario') {
                await api.deleteScenario(deleteModal.id);
                if (selectedScenarioId === deleteModal.id) setSelectedScenarioId(null);
                if (selectedStation) api.getScenarios(selectedStation).then(setScenarios);
              } else if (deleteModal.type === 'event') {
                await api.deleteEventDefinition(deleteModal.id);
                if (selectedEventDefId === deleteModal.id) setSelectedEventDefId(null);
                if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs);
              }
              setDeleteModal(null);
            }}
            style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete {deleteModal.type} <strong>{deleteModal.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="modal-btn"
                onClick={() => setDeleteModal(null)}
                style={{ padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                autoFocus
                className="modal-btn"
                style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
