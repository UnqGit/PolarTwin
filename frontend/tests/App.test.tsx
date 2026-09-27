import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import App from '../src/App';
import { HoverProvider } from '../src/components/HoverContext';

describe('Phase 34: Navigation and Station Context', () => {
  it('renders the navigation bar and layout container', () => {
    render(
      <HoverProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HoverProvider>
    );
    
    // Test that the app layout is rendered
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });
});
