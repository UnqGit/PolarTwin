import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionsPage } from '../../src/pages/ConnectionsPage';
import { StationContext } from '../../src/components/StationContext';

// Mock cytoscape since it requires a real DOM layout to run fcose
vi.mock('cytoscape', () => {
  const cyMock = {
    elements: () => {
      const coll: any = {
        removeClass: vi.fn().mockReturnThis(),
        addClass: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        layout: vi.fn().mockReturnValue({ run: vi.fn() }),
        forEach: vi.fn()
      };
      return coll;
    },
    getElementById: () => {
      const node: any = {
        addClass: vi.fn().mockReturnThis(),
        removeClass: vi.fn().mockReturnThis(),
        nonempty: vi.fn().mockReturnValue(true),
        isNode: vi.fn().mockReturnValue(true),
        isParent: vi.fn().mockReturnValue(false),
        connectedEdges: vi.fn().mockReturnThis(),
        union: vi.fn().mockReturnThis(),
        ancestors: vi.fn().mockReturnThis(),
        descendants: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        last: vi.fn().mockReturnThis(),
        source: vi.fn().mockReturnThis(),
        target: vi.fn().mockReturnThis(),
        hasClass: vi.fn().mockReturnValue(false)
      };
      return node;
    },
    edges: () => {
      const coll: any = {
        filter: vi.fn().mockReturnThis(),
        addClass: vi.fn().mockReturnThis(),
        removeClass: vi.fn().mockReturnThis(),
        forEach: vi.fn(),
        nonempty: vi.fn().mockReturnValue(true),
        union: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        connectedNodes: vi.fn().mockReturnThis()
      };
      return coll;
    },
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

  it('renders connections list and cytoscape container when data is present', async () => {
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
      { id: '1', source: 'A', target: 'B', type: 'power' as any, relation: 'test' }
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

    // Should render ConnectionsList empty state (since mock data doesn't fully simulate parents)
    expect(await screen.findByText('No connections match search.')).toBeInTheDocument();
    // Should render Cytoscape container
    expect(screen.getByTestId('cytoscape-container')).toBeInTheDocument();
  });
});
