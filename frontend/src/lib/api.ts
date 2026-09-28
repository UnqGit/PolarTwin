const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface StationManifest {
  station_id: string;
  component_count: number;
  connection_count: number;
}

export const api = {
  getStations: async (): Promise<StationManifest[]> => {
    const res = await fetch(`${API_BASE}/stations`);
    if (!res.ok) throw new Error("Failed to fetch stations");
    return res.json();
  },
  
  getHierarchy: async (stationId: string) => {
    const res = await fetch(`${API_BASE}/stations/${stationId}/hierarchy`);
    if (!res.ok) throw new Error("Failed to fetch hierarchy");
    return res.json();
  },

  getConnections: async (stationId: string) => {
    const res = await fetch(`${API_BASE}/stations/${stationId}/connections`);
    if (!res.ok) throw new Error("Failed to fetch connections");
    return res.json();
  },

  getSpec: async (stationId: string) => {
    const res = await fetch(`${API_BASE}/stations/${stationId}/spec`);
    if (!res.ok) throw new Error("Failed to fetch spec");
    return res.json();
  },

  getTelemetryRuns: async () => {
    const res = await fetch(`${API_BASE}/telemetry/runs`);
    if (!res.ok) throw new Error("Failed to fetch telemetry runs");
    return res.json();
  },

  getTelemetryHistory: async (stationId: string, runId?: string) => {
    let url = `${API_BASE}/telemetry/history?station_id=${stationId}`;
    if (runId) url += `&run_id=${runId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch telemetry history");
    return res.json();
  },

  getTelemetryRecord: async (recordId: number) => {
    const res = await fetch(`${API_BASE}/telemetry/records/${recordId}`);
    if (!res.ok) throw new Error("Failed to fetch telemetry record");
    return res.json();
  },

  deleteTelemetryRecord: async (recordId: number) => {
    const res = await fetch(`${API_BASE}/telemetry/records/${recordId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Failed to delete telemetry record");
    return;
  },

  // Scenario API
  getScenarios: async (stationId: string) => {
    const res = await fetch(`${API_BASE}/stations/${stationId}/scenarios`);
    if (!res.ok) throw new Error("Failed to fetch scenarios");
    return res.json();
  },
  createScenario: async (stationId: string, name: string, source: string = "") => {
    const res = await fetch(`${API_BASE}/stations/${stationId}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, source })
    });
    if (!res.ok) throw new Error("Failed to create scenario");
    return res.json();
  },
  getScenario: async (scenarioId: string) => {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}`);
    if (!res.ok) throw new Error("Failed to fetch scenario");
    return res.json();
  },
  getScenarioSource: async (scenarioId: string) => {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/source`);
    if (!res.ok) throw new Error("Failed to fetch scenario source");
    return res.json();
  },
  updateScenarioSource: async (scenarioId: string, source: string) => {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/source`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    });
    if (!res.ok) throw new Error("Failed to update scenario source");
    return res.json();
  },
  duplicateScenario: async (scenarioId: string) => {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error("Failed to duplicate scenario");
    return res.json();
  },
  deleteScenario: async (scenarioId: string) => {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Failed to delete scenario");
  },
  validateScenario: async (scenarioId: string) => {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/validate`, { method: 'POST' });
    if (!res.ok) throw new Error("Failed to validate scenario");
    return res.json();
  },
  getScenarioEvents: async (scenarioId: string) => {
    const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/events`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw err.detail || new Error("Failed to fetch scenario events");
    }
    return res.json();
  },
  parseScenarioRaw: async (source: string) => {
    const res = await fetch(`${API_BASE}/scenarios/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw err.detail || new Error("Failed to parse scenario source");
    }
    return res.json();
  },

  // Event Definitions
  getEventDefinitions: async (stationId: string) => {
    const res = await fetch(`${API_BASE}/stations/${stationId}/event-definitions`);
    if (!res.ok) throw new Error("Failed to fetch event definitions");
    return res.json();
  },
  createEventDefinition: async (stationId: string, name: string) => {
    const res = await fetch(`${API_BASE}/stations/${stationId}/event-definitions/${name}`, { method: 'POST' });
    if (!res.ok) throw new Error("Failed to create event definition");
    return res.json();
  },
  getEventDefinitionSource: async (eventId: string) => {
    const res = await fetch(`${API_BASE}/event-definitions/${eventId}`);
    if (!res.ok) throw new Error("Failed to fetch event definition");
    return res.json();
  },
  updateEventDefinitionSource: async (eventId: string, source: string) => {
    const res = await fetch(`${API_BASE}/event-definitions/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    });
    if (!res.ok) throw new Error("Failed to update event definition");
    return res.json();
  },
  deleteEventDefinition: async (eventId: string) => {
    const res = await fetch(`${API_BASE}/event-definitions/${eventId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Failed to delete event definition");
  },

  // Simulations
  listSimulations: async () => {
    const res = await fetch(`${API_BASE}/simulations`);
    if (!res.ok) throw new Error("Failed to list simulations");
    return res.json();
  },
  createSimulation: async (stationId: string, scenarioId?: string, globalTolerance: number = 10.0) => {
    const res = await fetch(`${API_BASE}/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id: stationId, scenario_id: scenarioId, global_tolerance: globalTolerance })
    });
    if (!res.ok) throw new Error("Failed to create simulation");
    return res.json();
  },
  getSimulation: async (runId: string) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}`);
    if (!res.ok) throw new Error("Failed to fetch simulation");
    return res.json();
  },
  playSimulation: async (runId: string, tickInterval: number = 1.0) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tick_interval: tickInterval })
    });
    if (!res.ok) throw new Error("Failed to play simulation");
    return res.json();
  },
  pauseSimulation: async (runId: string) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/pause`, { method: 'POST' });
    if (!res.ok) throw new Error("Failed to pause simulation");
    return res.json();
  },
  stepSimulation: async (runId: string) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/step`, { method: 'POST' });
    if (!res.ok) throw new Error("Failed to step simulation");
    return res.json();
  },
  resetSimulation: async (runId: string) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/reset`, { method: 'POST' });
    if (!res.ok) throw new Error("Failed to reset simulation");
    return res.json();
  },
  setComponentState: async (runId: string, componentId: string, stateUpdate: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/component/${componentId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stateUpdate)
    });
    if (!res.ok) throw new Error("Failed to set component state");
    return res.json();
  },
  setComponentTolerance: async (runId: string, componentId: string, tolerance: number) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/tolerance/component/${componentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: tolerance })
    });
    if (!res.ok) throw new Error("Failed to set component tolerance");
    return res.json();
  },
  setGlobalTolerance: async (runId: string, tolerance: number) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/tolerance/global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: tolerance })
    });
    if (!res.ok) throw new Error("Failed to set global tolerance");
    return res.json();
  },
  setTelemetryPublishing: async (runId: string, enable: boolean) => {
    const action = enable ? 'start' : 'stop';
    const res = await fetch(`${API_BASE}/simulations/${runId}/telemetry/${action}`, { method: 'POST' });
    if (!res.ok) throw new Error("Failed to change telemetry publishing state");
    return res.json();
  },
  getSimulationState: async (runId: string) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/state`);
    if (!res.ok) throw new Error("Failed to fetch simulation state");
    return res.json();
  },
  getSimulationLog: async (runId: string) => {
    const res = await fetch(`${API_BASE}/simulations/${runId}/log`);
    if (!res.ok) throw new Error("Failed to fetch simulation log");
    return res.json();
  }
};
