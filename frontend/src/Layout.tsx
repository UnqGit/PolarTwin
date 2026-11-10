import { useLocation, Navigate, useParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { PageErrorBoundary } from './components/PageErrorBoundary';
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
          <PageErrorBoundary pageName="Overview" resetKey={page}>
            <Overview />
          </PageErrorBoundary>
        </div>
        <div style={{ display: page === 'twin' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <PageErrorBoundary pageName="Digital Twin" resetKey={page}>
            <DigitalTwin />
          </PageErrorBoundary>
        </div>
        <div style={{ display: page === 'components' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <PageErrorBoundary pageName="Components" resetKey={page}>
            <ComponentsPage />
          </PageErrorBoundary>
        </div>
        <div style={{ display: page === 'connections' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <PageErrorBoundary pageName="Connections" resetKey={page}>
            <ConnectionsPage />
          </PageErrorBoundary>
        </div>
        <div style={{ display: page === 'scenarios' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <PageErrorBoundary pageName="Scenarios" resetKey={page}>
            <ScenariosPage />
          </PageErrorBoundary>
        </div>
        <div style={{ display: page === 'diagnostics' ? 'block' : 'none', flex: 1, height: '100%', width: '100%' }}>
          <PageErrorBoundary pageName="Diagnostics" resetKey={page}>
            <DiagnosticsPage />
          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}
