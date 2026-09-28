import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { LandingPage } from './pages/LandingPage';
import { DigitalTwin } from './pages/DigitalTwin';
import { Overview } from './pages/Overview';
import { ComponentsPage } from './pages/ComponentsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { StationProvider } from './components/StationContext';

const StationRoute = () => {
  const { stationId } = useParams<{ stationId: string }>();
  return (
    <StationProvider key={stationId} stationId={stationId}>
      <Layout />
    </StationProvider>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/:stationId" element={<StationRoute />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="twin" element={<DigitalTwin />} />
          <Route path="components" element={<ComponentsPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
