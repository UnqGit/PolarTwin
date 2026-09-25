import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { DigitalTwin } from './pages/DigitalTwin';
import { Overview } from './pages/Overview';
import { ComponentsPage } from './pages/ComponentsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

import { ScenariosPage } from './pages/ScenariosPage';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
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
