import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionsPage } from './ConnectionsPage';
import { StationContext } from '../components/StationContext';

// Mock cytoscape since it requires a real DOM layout to run fcose
vi.mock('cytoscape', () => {
  const cyMock = {
    elements: () => ({ removeClass: vi.fn(), addClass: vi.fn() }),
    getElementById: () => ({ addClass: vi.fn(), removeClass: vi.fn() }),
    edges: () => ({ filter: () => ({ addClass: vi.fn(), removeClass: vi.fn() }) }),
    style: () => ({
      selector: vi.fn().mockReturnThis(),
      style: vi.fn().mockReturnThis(),
      update: vi.fn()
    }),
    on: vi.fn(),
    resize: vi.fn(),
    fit: vi.fn(),
    zoom: vi.fn(() => 1),
    minZoom: vi.fn(),
    destroy: vi.fn(),
  };
  const cytoscape = vi.fn(() => cyMock);
  (cytoscape as any).use = vi.fn();
  return { default: cytoscape };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as any;

describe('ConnectionsPage', () => {
  it('shows loading state initially', () => {
    render(
      <StationContext.Provider value={{
        selectedStation: '',
        hierarchy: null,
        connections: null,
        spec: null,
        availableStations: [],
        isLoadingData: true,
        setSelectedStation: vi.fn(),
      }}>
        <ConnectionsPage />
      </StationContext.Provider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows message when no twin data available', () => {
    render(
      <StationContext.Provider value={{
        selectedStation: 'Twin',
        hierarchy: null,
        connections: null,
        spec: null,
        availableStations: [],
        isLoadingData: false,
        setSelectedStation: vi.fn(),
      }}>
        <ConnectionsPage />
      </StationContext.Provider>
    );
    expect(screen.getByText('No twin data available.')).toBeInTheDocument();
  });

  it('renders connections list and cytoscape container when data is present', () => {
    const mockHierarchy = {
      name: 'Station1',
      type: 'station',
      priority: 0,
      floor: 0,
      is_backup: false,
      backup: [],
      children: [
        { name: 'A', type: 'sensor', children: [] },
        { name: 'B', type: 'generator', children: [] }
      ],
      tags: []
    };
    const mockConnections = [
      { id: '1', source: 'A', target: 'B', connectionType: 'power' as any, relation: 'test' }
    ];

    render(
      <StationContext.Provider value={{
        selectedStation: 'Twin',
        hierarchy: mockHierarchy,
        connections: mockConnections,
        spec: {},
        availableStations: [],
        isLoadingData: false,
        setSelectedStation: vi.fn(),
      }}>
        <ConnectionsPage />
      </StationContext.Provider>
    );

    // Should render ConnectionsList component texts
    expect(screen.getByText('Source:')).toBeInTheDocument(); // Inner group heading logic
    // Should render Cytoscape container
    expect(screen.getByTestId('cytoscape-container')).toBeInTheDocument();
  });
});
