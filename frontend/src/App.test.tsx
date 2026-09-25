import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import React from 'react';
import App from './App';
import { DigitalTwin } from './pages/DigitalTwin';
import { BrowserRouter } from 'react-router-dom';

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

describe('App Component (Phase 18 Global Navigation)', () => {
  it('should render the Navbar and Overview page by default', () => {
    const { getByText } = render(<App />);
    
    // Check that the title and navbar items are rendered
    expect(getByText('PolarTwin')).toBeInTheDocument();
    expect(getByText('Overview')).toBeInTheDocument();
    expect(getByText('Digital Twin')).toBeInTheDocument();
    expect(getByText('Components')).toBeInTheDocument();
    
    // Check that the default route (Overview) content is present
    expect(getByText('High-level dashboard coming soon.')).toBeInTheDocument();
  });
});

describe('DigitalTwin Component', () => {
  it('should render the TwinViewer Canvas', () => {
    const { getByText, getByTestId } = render(
      <BrowserRouter>
        <DigitalTwin />
      </BrowserRouter>
    );
    
    // Check that the digital twin title card is rendered
    expect(getByText('3D Digital Twin Viewer')).toBeInTheDocument();
    
    // Check that the mocked Canvas is rendered
    expect(getByTestId('mock-canvas')).toBeInTheDocument();
  });
});
