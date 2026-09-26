import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ScenarioComparison } from '../src/components/ScenarioComparison';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({
  api: {
    getTelemetryRuns: vi.fn(),
    getTelemetryHistory: vi.fn(),
    getTelemetryRecord: vi.fn(),
  }
}));

describe('ScenarioComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropdowns and empty state initially', async () => {
    (api.getTelemetryRuns as any).mockResolvedValue([]);
    render(<ScenarioComparison stationId="station-1" />);

    expect(screen.getByText('Scenario A (Run ID)')).toBeInTheDocument();
    expect(screen.getByText('Scenario B (Run ID)')).toBeInTheDocument();
    expect(screen.getByText('Select two runs to compare their final states.')).toBeInTheDocument();
  });

  it('fetches runs based on stationId', async () => {
    (api.getTelemetryRuns as any).mockResolvedValue([
      { run_id: 'run-1', station_id: 'station-1' },
      { run_id: 'run-2', station_id: 'station-2' }
    ]);
    
    render(<ScenarioComparison stationId="station-1" />);

    await waitFor(() => {
      const optionsA = screen.getAllByRole('option');
      // 2 default empty options + 2 valid runs
      expect(optionsA.length).toBeGreaterThan(2); 
    });
  });
});
