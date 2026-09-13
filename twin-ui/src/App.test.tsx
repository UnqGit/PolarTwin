import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import React from 'react';
import App from './App';

// Mock R3F Canvas and Drei components since they need a real WebGL context to render properly in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas:   ({ children }: { children: React.ReactNode }) => <div data-testid="mock-canvas">{children}</div>,
  // useFrame: no-op stub — HoverManager calls this inside Canvas; in jsdom there is no GL loop
  useFrame: (_cb: unknown) => undefined,
  // useThree: return a minimal fake raycaster for RaycasterConfig
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

describe('App Component (Phase 30 3D Twin Viewer)', () => {
  it('should render the TwinViewer Canvas', () => {
    const { getByText, getByTestId } = render(<App />);
    
    // Check that the title is rendered
    expect(getByText('PolarTwin 3D Viewer')).toBeInTheDocument();
    
    // Check that the mocked Canvas is rendered
    expect(getByTestId('mock-canvas')).toBeInTheDocument();
  });
});
