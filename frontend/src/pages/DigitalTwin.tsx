import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TwinViewer } from '../components/TwinViewer';
import { useStation } from '../components/StationContext';

export function DigitalTwin() {
  const { 
    selectedStation: selectedTwin, 
    hierarchy, 
    connections, 
    spec,
    liveStateRef
  } = useStation();

  const location = useLocation();
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(
    location.state?.selectedComponentName || null
  );

  useEffect(() => {
    if (location.state?.selectedComponentName) {
      setSelectedComponentName(location.state.selectedComponentName);
    }
  }, [location.state]);

  useEffect(() => {
    if (!location.state?.selectedComponentName) {
      setSelectedComponentName(null);
    }
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


