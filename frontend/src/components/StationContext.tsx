import React, { createContext, useContext, useState, type ReactNode } from 'react';

// For now, load available stations from local JSON files.
// In a real app, we'd fetch this list from the /stations API endpoint.
const hierarchyFiles = import.meta.glob('../../../data/compiled/*/hierarchy.json', { eager: true, import: 'default' });
const availableTwins = Object.keys(hierarchyFiles).map((path) => {
  const match = path.match(/\.\.\/\.\.\/\.\.\/data\/compiled\/(.+)\/hierarchy\.json/);
  return match ? match[1] : '';
}).filter(Boolean);

interface StationContextType {
  availableStations: string[];
  selectedStation: string;
  setSelectedStation: (station: string) => void;
}

const StationContext = createContext<StationContextType>({
  availableStations: [],
  selectedStation: '',
  setSelectedStation: () => {}
});

export const useStation = () => useContext(StationContext);

export const StationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const defaultStation = availableTwins.length > 0 ? availableTwins[0] : 'new_station';
  const [selectedStation, setSelectedStationState] = useState<string>(() => {
    return localStorage.getItem('polartwin_selected_station') || defaultStation;
  });

  const setSelectedStation = (station: string) => {
    setSelectedStationState(station);
    localStorage.setItem('polartwin_selected_station', station);
  };

  return (
    <StationContext.Provider value={{ availableStations: availableTwins, selectedStation, setSelectedStation }}>
      {children}
    </StationContext.Provider>
  );
};
