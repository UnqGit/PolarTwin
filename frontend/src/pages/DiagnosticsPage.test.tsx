import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DiagnosticsPage } from './DiagnosticsPage';
import { StationContext } from '../components/StationContext';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getTelemetryRuns: vi.fn(),
    getTelemetryHistory: vi.fn(),
    getTelemetryRecord: vi.fn(),
  }
}));

const mockRuns = [
  { run_id: 'run-1', station_id: 'Station1' },
  { run_id: 'run-2', station_id: 'Station1' }
];

const mockHistory = [
  { id: 101, run_id: 'run-1', station_id: 'Station1', simulation_time: 10.5, persistence_time: 1690000000, source: 'SIMULATION', component_count: 5, connection_count: 3 },
  { id: 102, run_id: 'run-1', station_id: 'Station1', simulation_time: 20.0, persistence_time: 1690000010, source: 'SIMULATION', component_count: 5, connection_count: 3 },
];

const mockRecord = {
  id: 102,
  run_id: 'run-1',
  station_id: 'Station1',
  source: 'SIMULATION',
  time: 20.0,
  persistence_time: 1690000010,
  components: [
    { component_name: 'Heater1', type: 'heater', status: 'active', value_json: { temp: 22 } }
  ],
  connections: [
    { source_name: 'Panel1', target_name: 'Heater1', type: 'power', status: 'active' }
  ],
  external: {
    temperature: -40,
    wind_speed: 15
  }
};

describe('DiagnosticsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (api.getTelemetryRuns as any).mockResolvedValue(mockRuns);
    (api.getTelemetryHistory as any).mockResolvedValue(mockHistory);
    (api.getTelemetryRecord as any).mockResolvedValue(mockRecord);
  });

  it('prompts to select a station if none selected', () => {
    render(
      <StationContext.Provider value={{
        selectedStation: '',
        hierarchy: null,
        connections: null,
        spec: null,
        availableStations: [],
        isLoadingData: false,
        setSelectedStation: vi.fn()
      }}>
        <DiagnosticsPage />
      </StationContext.Provider>
    );

    expect(screen.getByText('Please select a station first.')).toBeInTheDocument();
  });

  it('loads and displays telemetry history', async () => {
    render(
      <StationContext.Provider value={{
        selectedStation: 'Station1',
        hierarchy: null,
        connections: null,
        spec: null,
        availableStations: [],
        isLoadingData: false,
        setSelectedStation: vi.fn()
      }}>
        <DiagnosticsPage />
      </StationContext.Provider>
    );

    // Initial render
    expect(screen.getByText('History & Diagnostics')).toBeInTheDocument();

    // Verify history timeline populated
    expect(await screen.findByText('10.50s')).toBeInTheDocument();
    expect(await screen.findByText('20.00s')).toBeInTheDocument();

    // Automatically selects the latest record (102) but let's click it to be sure
    const latestRow = await screen.findByText('20.00s');
    fireEvent.click(latestRow);

    await waitFor(() => {
      expect(api.getTelemetryRecord).toHaveBeenCalledWith(102);
    });
  });

  it('filters history by run', async () => {
    render(
      <StationContext.Provider value={{
        selectedStation: 'Station1',
        hierarchy: null,
        connections: null,
        spec: null,
        availableStations: [],
        isLoadingData: false,
        setSelectedStation: vi.fn()
      }}>
        <DiagnosticsPage />
      </StationContext.Provider>
    );

    const elements = await screen.findAllByText('run-1');
    expect(elements.length).toBeGreaterThan(0);

    const runSelect = screen.getByLabelText(/Run:/i);
    
    // Change run selection
    fireEvent.change(runSelect, { target: { value: 'run-1' } });
    
    // Should refetch history with runId
    await waitFor(() => {
      expect(api.getTelemetryHistory).toHaveBeenCalledWith('Station1', 'run-1');
    });
  });
});
