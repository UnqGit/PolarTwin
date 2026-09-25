import React from 'react';

interface SimulationMonitorProps {
  simState: any;
}

export function SimulationMonitor({ simState }: SimulationMonitorProps) {
  if (!simState) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
        No simulation state available. Run the simulation to see runtime details.
      </div>
    );
  }

  const { components = [], connections = [], external = {}, active_events = [], upcoming_events = [] } = simState;

  // Component Summary
  const compActive = components.filter((c: any) => c.status === 'active').length;
  const compInactive = components.filter((c: any) => c.status === 'inactive').length;
  const compFailure = components.filter((c: any) => c.status === 'failure').length;

  // Connection Summary
  const connActive = connections.filter((c: any) => c.status === 'active').length;
  const connInactive = connections.filter((c: any) => c.status === 'inactive').length;
  const connFailure = connections.filter((c: any) => c.status === 'failure').length;

  return (
    <div style={{ padding: '16px', height: '100%', overflowY: 'auto', color: 'var(--text-primary)', fontSize: '13px' }}>
      
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-blue)', marginBottom: '8px', textTransform: 'uppercase' }}>Station Overview</h3>
        <div style={{ display: 'flex', gap: '16px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Time</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>{simState.simulation_time?.toFixed(1)} h</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Status</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{simState.status}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Telemetry</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{simState.telemetry_publishing ? 'REC' : 'OFF'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Components</h3>
          <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Active</span> <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{compActive}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Inactive</span> <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>{compInactive}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Failure</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{compFailure}</span></div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Connections</h3>
          <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Active</span> <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{connActive}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Inactive</span> <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>{connInactive}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Failure</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{connFailure}</span></div>
          </div>
        </div>
      </div>

      {external.weather && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>External Conditions</h3>
          <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>Weather</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Temp</span> <span>{external.weather.temperature} °C</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Wind</span> <span>{external.weather.wind_speed} km/h</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Humidity</span> <span>{external.weather.humidity}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Visibility</span> <span>{external.weather.visibility} m</span></div>
            </div>
            
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', marginTop: '16px', marginBottom: '8px' }}>Network</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bandwidth</span> <span>{external.network.bandwidth} Mbps</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mainland</span> <span style={{ color: external.network.mainland_connectivity ? 'var(--accent-green)' : '#ef4444' }}>{external.network.mainland_connectivity ? 'Connected' : 'Offline'}</span></div>
            </div>

            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', marginTop: '16px', marginBottom: '8px' }}>Supplies</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ETA</span> <span>{external.supplies.eta_days} days</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mode</span> <span style={{ textTransform: 'capitalize' }}>{external.supplies.transport_mode}</span></div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Active Events</h3>
        {active_events.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No active events</div>
        ) : (
          active_events.map((ev: any, idx: number) => (
            <div key={idx} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', padding: '8px', marginBottom: '8px', borderRadius: '0 4px 4px 0' }}>
              <div style={{ fontWeight: 'bold' }}>{ev.event_id}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Target: {ev.node_key}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Affects: {ev.field_path} = {JSON.stringify(ev.value)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Start: {ev.start_time} h | End: {ev.end_time === Infinity || ev.end_time === null ? 'Infinite' : `${ev.end_time} h`}
              </div>
            </div>
          ))
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Upcoming Events</h3>
        {upcoming_events.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No upcoming events</div>
        ) : (
          upcoming_events.slice(0, 5).map((ev: any, idx: number) => (
            <div key={idx} style={{ backgroundColor: 'var(--bg-input)', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>{ev.event_ref}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{ev.selector ? `Target: ${ev.selector}` : 'Global'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                At: {ev.at} h | For: {ev.duration === Infinity || ev.duration === null ? 'Infinite' : `${ev.duration} h`}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
