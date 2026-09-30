import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DiagnosticsPage } from '../../src/pages/DiagnosticsPage';
import { StationContext } from '../../src/components/StationContext';
import { api } from '../../src/lib/api';

vi.mock('../../src/lib/api', () => ({
  api: {
    getTelemetryRuns: vi.fn(),
    getRunMetadata: vi.fn(),
    getRunEvents: vi.fn(),
    getSimulationLog: vi.fn(),
    getExternalHistory: vi.fn(),
    getConnectionHistory: vi.fn(),
    getComponentHistory: vi.fn(),
  }
}));

const mockRuns = [
  { run_id: 'run-1', station_id: 'Station1', start_time: 1690000000, status: 'FINISHED' },
  { run_id: 'run-2', station_id: 'Station1', start_time: 1690000010, status: 'ERROR' }
];

const mockMeta = {
  id: 'run-1',
  station_model_id: 'Station1',
  scenario_id: 'blizzard',
  status: 'FINISHED',
  start_time: 1690000000,
  end_time: 1690000100,
  record_count: 50
};

const mockEvents = [
  { id: 1, simulation_time: 10.5, source: 'SIMULATION' },
  { id: 2, simulation_time: 20.0, source: 'SIMULATION' },
];

const mockLogs = [
  { level: 'INFO', time: 10.5, message: 'Started' },
];

describe('DiagnosticsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (api.getTelemetryRuns as any).mockResolvedValue(mockRuns);
    (api.getRunMetadata as any).mockResolvedValue(mockMeta);
    (api.getRunEvents as any).mockResolvedValue(mockEvents);
    (api.getSimulationLog as any).mockResolvedValue(mockLogs);
  });

  it('renders simulation history layout', async () => {
    render(
      <StationContext.Provider value={{
        selectedStation: 'Station1',
        hierarchy: null,
        connections: null,
        spec: null,
        availableStations: [],
        isLoadingData: false,
        setSelectedStation: vi.fn()
      } as any}>
        <DiagnosticsPage />
      </StationContext.Provider>
    );

    expect(screen.getByText('Simulation History')).toBeInTheDocument();
    
    // Check if runs are loaded into select options
    await waitFor(() => {
      expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
    });
  });

  it('loads run details when a run is selected', async () => {
    render(
      <StationContext.Provider value={{
        selectedStation: 'Station1',
        hierarchy: null,
        connections: null,
        spec: null,
        availableStations: [],
        isLoadingData: false,
        setSelectedStation: vi.fn()
      } as any}>
        <DiagnosticsPage />
      </StationContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
    });

    const runSelect = screen.getByRole('combobox');
    
    // Change run selection
    fireEvent.change(runSelect, { target: { value: 'run-1' } });
    
    // Should fetch metadata, events, and logs
    await waitFor(() => {
      expect(api.getRunMetadata).toHaveBeenCalledWith('run-1');
      expect(api.getRunEvents).toHaveBeenCalledWith('run-1');
      expect(api.getSimulationLog).toHaveBeenCalledWith('run-1');
    });

    // Check if timeline is populated
    expect((await screen.findAllByText('10:30:00'))[0]).toBeInTheDocument();
    expect((await screen.findAllByText('20:00:00'))[0]).toBeInTheDocument();
  });
});
