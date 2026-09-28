import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { useStation } from '../../components/StationContext';
import { useGraphData } from './useGraphData';
import { useElkLayout } from './useElkLayout';

export const GraphSpike: React.FC = () => {
  const { hierarchy: rawHierarchy, connections: rawConnections, isLoadingData } = useStation();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // We assume sceneLayout is already built globally or we use the raw hierarchy.
  // Wait, `useGraphData` expects the flat array of NodeLayouts and ConnectionLayouts.
  // Let's import buildSceneLayout and build it.
  
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#111' }} />
  );
};
