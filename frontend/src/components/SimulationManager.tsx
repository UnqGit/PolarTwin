import { useState, useEffect } from 'react';
import { Server, X, Square, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

export function SimulationManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [simulations, setSimulations] = useState<any[]>([]);
  
  const fetchSimulations = async () => {
    try {
      const sims = await api.listSimulations();
      setSimulations(sims);
    } catch (e) {
      console.error("Failed to fetch simulations", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSimulations();
      const interval = setInterval(fetchSimulations, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleStop = async (runId: string) => {
    try {
      await api.pauseSimulation(runId);
      await api.resetSimulation(runId);
      fetchSimulations();
    } catch (e) {
      console.error("Failed to stop simulation", e);
    }
  };

  const handleDelete = async (runId: string) => {
    try {
      await api.deleteSimulation(runId);
      fetchSimulations();
    } catch (e) {
      console.error("Failed to delete simulation", e);
    }
  };

  const activeSims = simulations.filter(s => s.status === 'running' || s.status === 'paused');

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          color: activeSims.length > 0 ? '#ef4444' : 'var(--icon-color)',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
          position: 'relative'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-overlay)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="Background Simulations"
      >
        <Server size={18} />
        {activeSims.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '0',
            right: '0',
            width: '8px',
            height: '8px',
            backgroundColor: '#ef4444',
            borderRadius: '50%',
            border: '2px solid var(--bg-main)'
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          marginTop: '8px',
          width: '320px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '400px'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>Background Simulations</h3>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
          
          <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {simulations.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                No active simulations
              </div>
            ) : (
              simulations.map((sim, idx) => (
                <div key={idx} style={{
                  padding: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
                      {sim.run_id.substring(0, 12)}
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      backgroundColor: sim.status === 'running' ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-main)',
                      color: sim.status === 'running' ? '#22c55e' : 'var(--text-secondary)'
                    }}>
                      {sim.status.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Scenario: {sim.scenario_id || 'None'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      Time: {sim.simulation_time?.toFixed(1)} h
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(sim.status === 'running' || sim.status === 'paused') && (
                        <button 
                          onClick={() => handleStop(sim.run_id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Square size={10} /> Stop
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          if (confirm('Delete simulation run?')) {
                            handleDelete(sim.run_id);
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
