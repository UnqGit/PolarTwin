import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type StationManifest } from '../lib/api';

interface StationContextType {
  availableStations: string[];
  selectedStation: string;
  setSelectedStation: (station: string) => void;
  
  // Loaded models for the active station
  hierarchy: any | null;
  connections: any | null;
  spec: any | null;
  isLoadingData: boolean;

  // Simulation and Scenario state
  liveStateRef: React.MutableRefObject<Record<string, unknown>>;
  selectedScenarioId: string | null;
  setSelectedScenarioId: React.Dispatch<React.SetStateAction<string | null>>;
  scenarioSource: string;
  setScenarioSource: React.Dispatch<React.SetStateAction<string>>;
  runId: string | null;
  setRunId: React.Dispatch<React.SetStateAction<string | null>>;
  simStatus: string;
  setSimStatus: React.Dispatch<React.SetStateAction<string>>;
  simTime: number;
  setSimTime: React.Dispatch<React.SetStateAction<number>>;
  simLog: any[];
  setSimLog: React.Dispatch<React.SetStateAction<any[]>>;
  simState: any | null;
  setSimState: React.Dispatch<React.SetStateAction<any | null>>;
}

export const StationContext = createContext<StationContextType>({
  availableStations: [],
  selectedStation: '',
  setSelectedStation: () => {},
  hierarchy: null,
  connections: null,
  spec: null,
  isLoadingData: false,
  
  // Dummy defaults for simulation state
  liveStateRef: { current: {} },
  selectedScenarioId: null,
  setSelectedScenarioId: () => {},
  scenarioSource: '',
  setScenarioSource: () => {},
  runId: null,
  setRunId: () => {},
  simStatus: 'Ready',
  setSimStatus: () => {},
  simTime: 0,
  setSimTime: () => {},
  simLog: [],
  setSimLog: () => {},
  simState: null,
  setSimState: () => {},
});

export const useStation = () => useContext(StationContext);

export const StationProvider: React.FC<{ children: ReactNode, stationId?: string }> = ({ children, stationId }) => {
  const [availableStations, setAvailableStations] = useState<string[]>([]);
  
  // We use the route param if provided, otherwise fallback (for safety)
  const selectedStation = stationId || '';
  
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [connections, setConnections] = useState<any | null>(null);
  const [spec, setSpec] = useState<any | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Simulation and Scenario state
  const liveStateRef = React.useRef<Record<string, unknown>>({});
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioSource, setScenarioSource] = useState<string>('');
  const [runId, setRunId] = useState<string | null>(null);
  const [simStatus, setSimStatus] = useState<string>('Ready');
  const [simTime, setSimTime] = useState<number>(0);
  const [simLog, setSimLog] = useState<any[]>([]);
  const [simState, setSimState] = useState<any | null>(null);

  // Fetch available stations on mount
  useEffect(() => {
    api.getStations()
      .then(data => {
        const stationIds = data.map(s => s.station_id);
        setAvailableStations(stationIds);
      })
      .catch(err => console.error("Failed to fetch stations:", err));
  }, []);

  // Fetch data when selectedStation changes
  useEffect(() => {
    if (!selectedStation) {
      setHierarchy(null);
      setConnections(null);
      setSpec(null);
      return;
    }

    setIsLoadingData(true);
    
    Promise.all([
      api.getHierarchy(selectedStation).catch(e => { console.error(e); return null; }),
      api.getConnections(selectedStation).catch(e => { console.error(e); return null; }),
      api.getSpec(selectedStation).catch(e => { console.error(e); return null; })
    ])
    .then(([hData, cData, sData]) => {
      setHierarchy(hData);
      setConnections(cData);
      setSpec(sData);
      setIsLoadingData(false);
    })
    .catch(err => {
      console.error("Failed to load station data:", err);
      setIsLoadingData(false);
    });

  }, [selectedStation]);

  // Telemetry loop
  useEffect(() => {
    if (runId && simStatus === 'running') {
      const interval = setInterval(() => {
        api.getSimulationState(runId).then(data => {
          setSimStatus(data.status);
          setSimTime(data.simulation_time);
          setSimState(data);
          
          if (data.components) {
            const newState: Record<string, unknown> = {};
            data.components.forEach((c: any) => {
              if (c.value) {
                Object.assign(newState, c.value);
              }
            });
            liveStateRef.current = newState;
          }
        }).catch(err => console.error("Error polling sim state:", err));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [runId, simStatus]);

  return (
    <StationContext.Provider value={{
      availableStations,
      selectedStation,
      setSelectedStation: () => {}, // No-op now, driven by URL
      hierarchy,
      connections,
      spec,
      isLoadingData,
      liveStateRef,
      selectedScenarioId,
      setSelectedScenarioId,
      scenarioSource,
      setScenarioSource,
      runId,
      setRunId,
      simStatus,
      setSimStatus,
      simTime,
      setSimTime,
      simLog,
      setSimLog,
      simState,
      setSimState,
    }}>
      {children}
    </StationContext.Provider>
  );
};
