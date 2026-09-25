import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, waitFor, screen } from '@testing-library/react';
import React from 'react';
import App from './App';
import { DigitalTwin } from './pages/DigitalTwin';
import { BrowserRouter } from 'react-router-dom';
import { StationProvider, useStation } from './components/StationContext';
import { ThemeProvider } from './components/ThemeContext';

// Mock R3F Canvas and Drei components
vi.mock('@react-three/fiber', () => ({
  Canvas:   ({ children }: { children: React.ReactNode }) => <div data-testid="mock-canvas">{children}</div>,
  useFrame: (_cb: unknown) => undefined,
  useThree: () => ({
    raycaster: { params: { Line: {}, Points: {} } },
    scene: { children: [] },
  }),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Environment:   () => <div data-testid="environment" />,
  Bounds:  ({ children }: { children: React.ReactNode }) => <div data-testid="bounds">{children}</div>,
  Html:    ({ children }: { children: React.ReactNode }) => <div data-testid="html-overlay">{children}</div>,
  Text:    ({ children }: { children?: React.ReactNode }) => <span data-testid="text-label">{children}</span>,
  useGLTF: () => ({ scene: {} }),
  Line:    () => <div data-testid="connection-line" />,
  Edges:   () => null,
}));

vi.mock('./lib/api', () => ({
  api: {
    getStations: vi.fn().mockResolvedValue([{ station_id: 'TestStation' }]),
    getHierarchy: vi.fn().mockResolvedValue([{ name: 'Root', type: 'block' }]),
    getConnections: vi.fn().mockResolvedValue([]),
    getSpec: vi.fn().mockResolvedValue({})
  }
}));

describe('App Component (Phase 18 Global Navigation)', () => {
  it('should render the Navbar and Overview page by default', async () => {
    render(
      <ThemeProvider>
        <StationProvider>
          <App />
        </StationProvider>
      </ThemeProvider>
    );
    
    // Check that the title and navbar items are rendered
    await waitFor(() => {
      expect(screen.getByText('PolarTwin')).toBeInTheDocument();
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Digital Twin')).toBeInTheDocument();
      expect(screen.getAllByText('Components').length).toBeGreaterThan(0);
      
      // Check that the default route (Overview) content is present
      expect(screen.getByText('System status and high-level telemetry')).toBeInTheDocument();
      expect(screen.getByText('Power Output')).toBeInTheDocument();
      expect(screen.getByText('Station Temp')).toBeInTheDocument();
    });
  });
});

describe('DigitalTwin Component', () => {
  it('should render the TwinViewer Canvas', async () => {
    render(
      <BrowserRouter>
        <StationProvider>
          <DigitalTwin />
        </StationProvider>
      </BrowserRouter>
    );
    
    await waitFor(() => {
      // Check that the mocked Canvas is rendered
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });
  });
});

