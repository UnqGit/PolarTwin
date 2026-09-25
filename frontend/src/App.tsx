import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { DigitalTwin } from './pages/DigitalTwin';
import { Overview } from './pages/Overview';

function Components() { return <div style={{ padding: 24 }}><h2>Components</h2><p>Component hierarchy and specs coming soon.</p></div>; }
function Connections() { return <div style={{ padding: 24 }}><h2>Connections</h2><p>Network topology coming soon.</p></div>; }
function Scenarios() { return <div style={{ padding: 24 }}><h2>Scenarios & Simulation</h2><p>Event DSL runner coming soon.</p></div>; }
function Diagnostics() { return <div style={{ padding: 24 }}><h2>History & Diagnostics</h2><p>Telemetry graphs coming soon.</p></div>; }

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="twin" element={<DigitalTwin />} />
          <Route path="components" element={<Components />} />
          <Route path="connections" element={<Connections />} />
          <Route path="scenarios" element={<Scenarios />} />
          <Route path="diagnostics" element={<Diagnostics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
