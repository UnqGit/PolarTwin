export interface StationManifest {
  station_id: string;
  component_count: number;
  connection_count: number;
}

export const api = {
  getStations: async (): Promise<StationManifest[]> => {
    const res = await fetch('/api/stations');
    if (!res.ok) throw new Error("Failed to fetch stations");
    return res.json();
  },
  
  getHierarchy: async (stationId: string) => {
    const res = await fetch(`/api/stations/${stationId}/hierarchy`);
    if (!res.ok) throw new Error("Failed to fetch hierarchy");
    return res.json();
  },

  getConnections: async (stationId: string) => {
    const res = await fetch(`/api/stations/${stationId}/connections`);
    if (!res.ok) throw new Error("Failed to fetch connections");
    return res.json();
  },

  getSpec: async (stationId: string) => {
    const res = await fetch(`/api/stations/${stationId}/spec`);
    if (!res.ok) throw new Error("Failed to fetch spec");
    return res.json();
  },

  getTelemetryRuns: async () => {
    const res = await fetch('/api/telemetry/runs');
    if (!res.ok) throw new Error("Failed to fetch telemetry runs");
    return res.json();
  },

  getTelemetryHistory: async (stationId: string, runId?: string) => {
    let url = `/api/telemetry/history?station_id=${stationId}`;
    if (runId) url += `&run_id=${runId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch telemetry history");
    return res.json();
  },

  getTelemetryRecord: async (recordId: number) => {
    const res = await fetch(`/api/telemetry/records/${recordId}`);
    if (!res.ok) throw new Error("Failed to fetch telemetry record");
    return res.json();
  }
};
