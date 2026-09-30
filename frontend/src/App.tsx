import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { LandingPage } from './pages/LandingPage';
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
        <Route path="/:stationId/*" element={<StationRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
