import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './components/ThemeContext.tsx'
import { StationProvider } from './components/StationContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <StationProvider>
        <App />
      </StationProvider>
    </ThemeProvider>
  </StrictMode>,
)
