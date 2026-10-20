import React, { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

export type VisualMode = 'realistic' | 'holographic' | 'thermal';
export type AtmosphereMode = 'polar_day' | 'aurora_night' | 'tactical_dark';

export interface TwinVisualSettings {
  visualMode: VisualMode;
  setVisualMode: (mode: VisualMode) => void;
  explodedFactor: number;
  setExplodedFactor: (factor: number) => void;
  weatherEnabled: boolean;
  setWeatherEnabled: (enabled: boolean) => void;
  atmosphereMode: AtmosphereMode;
  setAtmosphereMode: (mode: AtmosphereMode) => void;
  flowAnimationEnabled: boolean;
  setFlowAnimationEnabled: (enabled: boolean) => void;
}

const TwinVisualContext = createContext<TwinVisualSettings>({
  visualMode: 'realistic',
  setVisualMode: () => {},
  explodedFactor: 0,
  setExplodedFactor: () => {},
  weatherEnabled: true,
  setWeatherEnabled: () => {},
  atmosphereMode: 'polar_day',
  setAtmosphereMode: () => {},
  flowAnimationEnabled: true,
  setFlowAnimationEnabled: () => {},
});

export const useTwinVisual = () => useContext(TwinVisualContext);

interface TwinVisualProviderProps {
  children: ReactNode;
  initialVisualMode?: VisualMode;
  initialAtmosphereMode?: AtmosphereMode;
}

export const TwinVisualProvider: React.FC<TwinVisualProviderProps> = ({
  children,
  initialVisualMode = 'realistic',
  initialAtmosphereMode = 'polar_day',
}) => {
  const [visualMode, setVisualMode] = useState<VisualMode>(initialVisualMode);
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [weatherEnabled, setWeatherEnabled] = useState<boolean>(true);
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>(initialAtmosphereMode);
  const [flowAnimationEnabled, setFlowAnimationEnabled] = useState<boolean>(true);

  const value = useMemo(
    () => ({
      visualMode,
      setVisualMode,
      explodedFactor,
      setExplodedFactor,
      weatherEnabled,
      setWeatherEnabled,
      atmosphereMode,
      setAtmosphereMode,
      flowAnimationEnabled,
      setFlowAnimationEnabled,
    }),
    [visualMode, explodedFactor, weatherEnabled, atmosphereMode, flowAnimationEnabled]
  );

  return <TwinVisualContext.Provider value={value}>{children}</TwinVisualContext.Provider>;
};
