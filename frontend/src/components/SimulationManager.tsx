import { useState, useEffect, useRef } from 'react';
import { Server, X, Square, Trash2, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';

export function SimulationManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [simulations, setSimulations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSimulations = async () => {
    try {
      setIsLoading(true);
      const sims = await api.listSimulations();
      setSimulations(sims);
    } catch (e) {
      console.error('Failed to fetch simulations', e);
    } finally {
      setIsLoading(false);
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
      await api.stopSimulation(runId);
      fetchSimulations();
    } catch (e) {
      console.error('Failed to stop simulation', e);
    }
  };

  const handleDelete = async (runId: string) => {
    try {
      await api.deleteSimulation(runId);
      fetchSimulations();
    } catch (e) {
      console.error('Failed to delete simulation', e);
    }
  };

  const activeSims = simulations.filter(s => s.status === 'running' || s.status === 'paused');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getStatusClass = (status: string) => {
    if (status === 'running') return 'sim-chip-running';
    if (status === 'paused') return 'sim-chip-paused';
    if (status === 'stopped' || status === 'completed') return 'sim-chip-stopped';
    return 'sim-chip-error';
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-icon"
        style={{
          color: activeSims.length > 0 ? 'var(--accent-red)' : 'var(--icon-color)',
          borderRadius: 'var(--radius-full)',
          position: 'relative',
          gap: 5,
          padding: '7px 11px',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Background Simulations"
      >
        <Server size={15} />
        {activeSims.length > 0 && (
          <>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{activeSims.length}</span>
            <div style={{
              position: 'absolute',
              top: 4, right: 4,
              width: 6, height: 6,
              background: 'var(--accent-red)',
              borderRadius: '50%',
              border: '1.5px solid var(--bg-main)',
              animation: 'pulseDot 2s infinite'
            }} />
          </>
        )}
        <ChevronDown size={12} style={{
          opacity: 0.6,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }} />
      </button>

      {isOpen && (
        <div className="dropdown-menu" style={{ minWidth: 340 }}>
          <div className="dropdown-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={14} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Active Simulations
              </span>
              {activeSims.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: 'rgba(248,113,113,0.15)',
                  color: 'var(--accent-red)',
                  padding: '1px 7px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid rgba(248,113,113,0.3)'
                }}>
                  {activeSims.length} LIVE
                </span>
              )}
            </div>
            <button onClick={() => setIsOpen(false)} className="btn-icon" style={{ padding: 4 }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {isLoading && simulations.length === 0 ? (
              <div className="loading-container" style={{ padding: '32px 16px' }}>
                <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 13 }}>Loading...</span>
              </div>
            ) : simulations.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <Server size={28} className="empty-state-icon" />
                <span className="empty-state-title">No simulations</span>
                <span className="empty-state-desc">Start a scenario to see it here</span>
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {simulations.map((sim, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    marginBottom: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'border-color 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono, monospace)',
                        letterSpacing: '-0.01em'
                      }}>
                        {sim.run_id.substring(0, 14)}…
                      </span>
                      <span className={`sim-chip ${getStatusClass(sim.status)}`}>
                        <div className="pulse-dot" style={{ width: 5, height: 5 }} />
                        {sim.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {sim.scenario_id && (
                        <span>Scenario: <strong style={{ color: 'var(--text-primary)' }}>{sim.scenario_id}</strong></span>
                      )}
                      {sim.simulation_time != null && (
                        <span>T: <strong style={{ color: 'var(--text-primary)' }}>{sim.simulation_time.toFixed(1)}h</strong></span>
                      )}
                    </div>

                    {(sim.status === 'running' || sim.status === 'paused') && (
                      <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                        <button
                          onClick={() => handleStop(sim.run_id)}
                          className="btn btn-sm btn-danger"
                          style={{ flex: 1 }}
                        >
                          <Square size={11} /> Stop
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this simulation run?')) handleDelete(sim.run_id); }}
                          className="btn btn-sm btn-ghost"
                          style={{ flex: 1 }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                    {sim.status !== 'running' && sim.status !== 'paused' && (
                      <button
                        onClick={() => { if (confirm('Delete this simulation run?')) handleDelete(sim.run_id); }}
                        className="btn btn-sm btn-ghost"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
