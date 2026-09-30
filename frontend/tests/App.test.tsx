import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { ThemeProvider } from '../src/components/ThemeContext';

vi.mock('../src/lib/api', () => ({
  api: {
    getStations: vi.fn().mockResolvedValue([{ station_id: 'TestStation' }]),
  }
}));

// We only need to check if LandingPage renders at the root route
describe('App Routing', () => {
  it('renders the LandingPage at the root path', async () => {
    // App contains its own BrowserRouter
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    // LandingPage has a specific title
    await waitFor(() => {
      expect(screen.getByText('PolarTwin')).toBeInTheDocument();
      expect(screen.getByText('Select a Station')).toBeInTheDocument();
    });
  });
});
