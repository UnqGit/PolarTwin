import { useState, useEffect, useRef } from 'react';
import { Snowflake } from 'lucide-react';
import { TwinViewer, type LightingMode } from '../components/TwinViewer';
import { useStation } from '../components/StationContext';

export function DigitalTwin() {
  const { 
    selectedStation: selectedTwin, 
    hierarchy, 
    connections, 
    spec,
    isLoadingData
  } = useStation();

  const [lightingMode, setLightingMode] = useState<LightingMode>('off');
  const [containerOcclusion, setContainerOcclusion] = useState<'off' | 'off_on_hover'>('off');
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);

  useEffect(() => {
    setSelectedComponentName(null);
  }, [selectedTwin]);

  // liveStateRef will hold the latest telemetry without triggering React re-renders
  const liveStateRef = useRef<Record<string, unknown>>({});

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {hierarchy && connections && spec ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <TwinViewer
            topology={hierarchy}
            connections={connections}
            specification={spec}
            liveStateRef={liveStateRef}
            selectedName={selectedComponentName}
            onSelectName={setSelectedComponentName}
          />
        </div>
      ) : (
        <div style={{ color: 'white', padding: 24 }}>Loading or no twin selected...</div>
      )}
    </div>
  );
}


