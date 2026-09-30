import { useLocation, Navigate, useParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Overview } from './pages/Overview';
import { DigitalTwin } from './pages/DigitalTwin';
import { ComponentsPage } from './pages/ComponentsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

export function Layout() {
  const location = useLocation();
  const { stationId } = useParams<{ stationId: string }>();
  
  const pathParts = location.pathname.split('/').filter(Boolean);
  
  if (pathParts.length < 2) {
    return <Navigate to={`/${stationId}/overview`} replace />;
  }

  const page = pathParts[1].toLowerCase();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--bg-main)',
      overflow: 'hidden'
    }}>
      <Navbar />
      <main style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: page === 'overview' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <Overview />
        </div>
        <div style={{ display: page === 'twin' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <DigitalTwin />
        </div>
        <div style={{ display: page === 'components' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <ComponentsPage />
        </div>
        <div style={{ display: page === 'connections' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <ConnectionsPage />
        </div>
        <div style={{ display: page === 'scenarios' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <ScenariosPage />
        </div>
        <div style={{ display: page === 'diagnostics' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <DiagnosticsPage />
        </div>
      </main>
    </div>
  );
}
