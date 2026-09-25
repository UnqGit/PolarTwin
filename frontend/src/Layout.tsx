import { Outlet } from 'react-router-dom';
import { Navbar } from './components/Navbar';

export function Layout() {
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
        overflow: 'hidden'
      }}>
        <Outlet />
      </main>
    </div>
  );
}
