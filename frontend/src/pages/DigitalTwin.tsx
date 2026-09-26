import { useState, useEffect } from 'react';
import { TwinViewer, type LightingMode } from '../components/TwinViewer';
import { useStation } from '../components/StationContext';

export function DigitalTwin() {
  const { 
    selectedStation: selectedTwin, 
    hierarchy, 
    connections, 
    spec,
    liveStateRef
  } = useStation();

  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);

  useEffect(() => {
    setSelectedComponentName(null);
  }, [selectedTwin]);


  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {hierarchy && connections && spec ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <TwinViewer
            topology={hierarchy}
            connections={connections}
            specification={spec}
            liveStateRef={liveStateRef}
            selectedName={selectedComponentName}
            onSelectName={setSelectedComponentName}
            hideEditInitials={true}
          />
        </div>
      ) : (
        <div style={{ color: 'white', padding: 24 }}>Loading or no twin selected...</div>
      )}
    </div>
  );
}


