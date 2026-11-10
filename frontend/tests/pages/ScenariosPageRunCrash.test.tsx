import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenariosPage } from '../../src/pages/ScenariosPage';
import { StationContext } from '../../src/components/StationContext';
import { api } from '../../src/lib/api';

vi.mock('../../src/lib/api', () => ({
  api: {
    getScenarios: vi.fn().mockResolvedValue([{ id: 'Maitri:gen_failure', name: 'gen_failure' }]),
    getEventDefinitions: vi.fn().mockResolvedValue([]),
    getScenarioSource: vi.fn().mockResolvedValue({ source: 'event:failure @MainGenerator at=0' }),
    updateScenarioSource: vi.fn().mockResolvedValue({ source: '' }),
    getScenarioEvents: vi.fn().mockResolvedValue([]),
    createSimulation: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'RUNNING' }),
    parseScenarioRaw: vi.fn().mockResolvedValue([]),
    getTelemetryRuns: vi.fn().mockResolvedValue([]),
    getTelemetryHistory: vi.fn().mockResolvedValue([]),
    getTelemetryRecord: vi.fn().mockResolvedValue(null),
    stopSimulation: vi.fn().mockResolvedValue({ status: 'STOPPED' }),
  }
}));

vi.mock('../../src/components/TwinViewer', () => ({
  TwinViewer: () => <div data-testid="twin-viewer-mock">TwinViewer</div>
}));

describe('ScenariosPage Run State and Thematic Upgrades', () => {
  const mockState = {
    run_id: 'run-1',
    station_id: 'Maitri',
    status: 'RUNNING',
    simulation_time: 0.5,
    telemetry_publishing: true,
    components: [
      { name: 'MainGenerator', type: 'generator', is_backup: false, status: 'failure', value: { power: 0 } },
      { name: 'BackupGenerator', type: 'generator', is_backup: true, status: 'active', value: { power: 4500 } },
      { name: 'HVACController', type: 'controller', is_backup: false, status: 'active', value: {} }
    ],
    connections: [
      { source: 'MainGenerator', target: 'HVACController', type: 'power', status: 'failure' }
    ],
    external: {
      weather: { temperature: -30.0, wind_speed: 15.0, humidity: 65.0, visibility: 4000.0 },
      network: { bandwidth: 10.0, mainland_connectivity: true },
      supplies: []
    },
    active_events: [
      { event_id: 'failure', source_order: 0, start_time: 0.0, end_time: 0.2, node_key: 'component:MainGenerator', field_path: 'status', value: 'failure' }
    ],
    upcoming_events: []
  };

  const getMockStation = (overrides = {}) => ({
    availableStations: ['Maitri'],
    selectedStation: 'Maitri',
    setSelectedStation: vi.fn(),
    hierarchy: { name: 'Maitri', type: 'station', children: [] },
    connections: [],
    spec: { components: {} },
    isLoadingData: false,
    selectedScenarioId: 'Maitri:gen_failure',
    setSelectedScenarioId: vi.fn(),
    scenarioSource: 'event:failure @MainGenerator at=0',
    setScenarioSource: vi.fn(),
    runId: 'run-1',
    setRunId: vi.fn(),
    simStatus: 'RUNNING',
    setSimStatus: vi.fn(),
    simTime: 0.5,
    setSimTime: vi.fn(),
    simLog: [{ time: 0.5, level: 'ERROR', message: 'MainGenerator failure' }],
    setSimLog: vi.fn(),
    diagLog: [],
    setDiagLog: vi.fn(),
    simState: mockState,
    setSimState: vi.fn(),
    liveStateRef: { current: {} },
    runtime: null,
    ...overrides,
  });

  it('renders during an active simulation run without crashing', () => {
    const mockStation = getMockStation();
    expect(() => {
      render(
        <StationContext.Provider value={mockStation as any}>
          <ScenariosPage />
        </StationContext.Provider>
      );
    }).not.toThrow();

    // Active cascade incident banner renders with @MainGenerator
    expect(screen.getByText('@MainGenerator')).toBeInTheDocument();
    expect(screen.getByText(/CASCADE INCIDENT/i)).toBeInTheDocument();

    // Command HUD is visible and shows Subsystem Integrity
    expect(screen.getByText('COMMAND HUD')).toBeInTheDocument();
    expect(screen.getByText('Subsystem Integrity')).toBeInTheDocument();
  });

  it('ensures A/B Diff button is removed from top navbar', () => {
    const mockStation = getMockStation();
    render(
      <StationContext.Provider value={mockStation as any}>
        <ScenariosPage />
      </StationContext.Provider>
    );

    // Navbar should NOT have A/B Diff button
    expect(screen.queryByTitle('Scenario A/B Differential Inspection')).not.toBeInTheDocument();
    expect(screen.queryByText('A/B Diff')).not.toBeInTheDocument();
  });

  it('allows moving the Command HUD by dragging', () => {
    const mockStation = getMockStation();
    render(
      <StationContext.Provider value={mockStation as any}>
        <ScenariosPage />
      </StationContext.Provider>
    );

    const dragHandle = screen.getByTitle(/Click & drag anywhere below the navbar to reposition Command HUD/i);
    expect(dragHandle).toBeInTheDocument();

    // Drag the handle
    fireEvent.pointerDown(dragHandle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(dragHandle, { clientX: 250, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(dragHandle, { pointerId: 1 });

    // The HUD container remains present and healthy
    expect(screen.getByText('COMMAND HUD')).toBeInTheDocument();
  });

  it('does not crash when simStatus is undefined or null', () => {
    const mockStation = getMockStation({ simStatus: null });
    expect(() => {
      render(
        <StationContext.Provider value={mockStation as any}>
          <ScenariosPage />
        </StationContext.Provider>
      );
    }).not.toThrow();
  });

  it('runs continuously through time progression from T=0 to T=1.0 without crashing', () => {
    // Step 1: Initial state at T=0.0 with primary failure
    const station = getMockStation({ simTime: 0.0 });
    const { rerender } = render(
      <StationContext.Provider value={station as any}>
        <ScenariosPage />
      </StationContext.Provider>
    );

    expect(screen.getByText(/CASCADE INCIDENT/i)).toBeInTheDocument();

    // Step 2: Advance to T=0.2 (event expires, primary failure cleared, only weather active)
    const stateAtT02 = {
      ...mockState,
      simulation_time: 0.2,
      components: [
        { name: 'MainGenerator', type: 'generator', is_backup: false, status: 'active', value: { power: 5000 } },
        { name: 'BackupGenerator', type: 'generator', is_backup: true, status: 'active', value: { power: 0 } },
      ],
      active_events: [
        { event_id: 'weather_inflation', source_order: 1, start_time: 0.0, end_time: null, node_key: 'environment', field_path: 'wind_speed', value: 45 }
      ]
    };

    rerender(
      <StationContext.Provider value={getMockStation({ simTime: 0.2, simState: stateAtT02 }) as any}>
        <ScenariosPage />
      </StationContext.Provider>
    );

    // Event injection banner should now display
    expect(screen.getByText(/EVENT INJECTION:/i)).toBeInTheDocument();

    // Step 3: Advance to T=0.5 (cascading failure ripple across multiple subsystems)
    const stateAtT05 = {
      ...mockState,
      simulation_time: 0.5,
      components: [
        { name: 'MainGenerator', type: 'generator', is_backup: false, status: 'failure', value: {} },
        { name: 'BackupGenerator', type: 'generator', is_backup: true, status: 'critical', value: {} },
        { name: 'HVACController', type: 'controller', is_backup: false, status: 'failure', value: {} },
        { name: 'WaterPump', type: 'pump', is_backup: false, status: 'failure', value: {} },
      ],
      active_events: [
        { event_id: 'generator_overheat', source_order: 2, start_time: 0.5, end_time: 1.0, node_key: 'component:MainGenerator', field_path: 'temp', value: 120 }
      ]
    };

    rerender(
      <StationContext.Provider value={getMockStation({ simTime: 0.5, simState: stateAtT05 }) as any}>
        <ScenariosPage />
      </StationContext.Provider>
    );

    expect(screen.getByText(/CASCADE INCIDENT/i)).toBeInTheDocument();

    // Step 4: Advance to T=1.0 and stop simulation (triggering debrief modal)
    const stateAtT10 = { ...stateAtT05, simulation_time: 1.0 };
    rerender(
      <StationContext.Provider value={getMockStation({ simTime: 1.0, simState: stateAtT10, simStatus: 'FINISHED' }) as any}>
        <ScenariosPage />
      </StationContext.Provider>
    );

    // Check stop button click to ensure clean debrief modal launch
    const stopBtn = screen.getByTitle(/Stop Simulation/i);
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
  });

  it('renders simulation monitor tab safely when supplies array is empty and network is missing', () => {
    const stateWithMissingExternal = {
      ...mockState,
      external: {
        weather: { temperature: -40.0, wind_speed: 25.0, humidity: 50.0, visibility: 3000.0 },
        supplies: []
      }
    };

    const mockStation = getMockStation({ simState: stateWithMissingExternal });
    render(
      <StationContext.Provider value={mockStation as any}>
        <ScenariosPage />
      </StationContext.Provider>
    );

    // Click the Simulation Monitor tab on the right vertical strip
    const monitorTabBtn = screen.getByTitle('Simulation Monitor');
    expect(monitorTabBtn).toBeInTheDocument();
    fireEvent.click(monitorTabBtn);

    // Simulation monitor should display without throwing
    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(screen.getByText('-40 °C')).toBeInTheDocument();
  });
});
