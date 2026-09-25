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
}

export const StationContext = createContext<StationContextType>({
  availableStations: [],
  selectedStation: '',
  setSelectedStation: () => {},
  hierarchy: null,
  connections: null,
  spec: null,
  isLoadingData: false,
});

export const useStation = () => useContext(StationContext);

export const StationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [availableStations, setAvailableStations] = useState<string[]>([]);
  const [selectedStation, setSelectedStationState] = useState<string>(() => {
    return localStorage.getItem('polartwin_selected_station') || '';
  });
  
  const [hierarchy, setHierarchy] = useState<any | null>(null);
  const [connections, setConnections] = useState<any | null>(null);
  const [spec, setSpec] = useState<any | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Fetch available stations on mount
  useEffect(() => {
    api.getStations()
      .then(data => {
        const stationIds = data.map(s => s.station_id);
        setAvailableStations(stationIds);
        
        if (stationIds.length > 0 && (!selectedStation || !stationIds.includes(selectedStation))) {
          const defaultStation = stationIds[0];
          setSelectedStationState(defaultStation);
          localStorage.setItem('polartwin_selected_station', defaultStation);
        }
      })
      .catch(err => console.error("Failed to fetch stations:", err));
  }, []); // Run once on mount

  // Fetch data when selectedStation changes
  useEffect(() => {
    if (!selectedStation) {
      setHierarchy(null);
      setConnections(null);
      setSpec(null);
      return;
    }

    let isMounted = true;
    setIsLoadingData(true);

    Promise.all([
      api.getHierarchy(selectedStation),
      api.getConnections(selectedStation),
      api.getSpec(selectedStation)
    ])
    .then(([hierarchyData, connectionsData, specData]) => {
      if (!isMounted) return;
      setHierarchy(hierarchyData);
      setConnections(connectionsData);
      setSpec(specData);
      setIsLoadingData(false);
    })
    .catch(err => {
      console.error("Failed to fetch station data:", err);
      if (isMounted) setIsLoadingData(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedStation]);

  const setSelectedStation = (station: string) => {
    setSelectedStationState(station);
    localStorage.setItem('polartwin_selected_station', station);
  };

  return (
    <StationContext.Provider value={{ 
      availableStations, 
      selectedStation, 
      setSelectedStation,
      hierarchy,
      connections,
      spec,
      isLoadingData
    }}>
      {children}
    </StationContext.Provider>
  );
};
