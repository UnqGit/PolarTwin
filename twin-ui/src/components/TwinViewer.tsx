/**
 * TwinViewer.tsx
 *
 * Top-level canvas.  Compiles the raw topology + spec JSON into a NodeLayout
 * tree (done once on mount / when inputs change), then delegates all rendering
 * to TwinNodeRenderer.
 *
 * Accepts:
 *   topology    – raw topology/relation JSON (from relation.json / topology.json)
 *   specification – raw spec JSON (from spec.json / specification.json)
 *   liveState   – live state map keyed by component name
 */

import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds } from '@react-three/drei';
import { buildLayout } from '../lib/layout';
import { TwinNodeRenderer } from './TwinNodeRenderer';

interface TwinViewerProps {
  topology: any;
  specification: any;
  liveState: Record<string, unknown>;
}

export const TwinViewer: React.FC<TwinViewerProps> = ({ topology, specification, liveState }) => {
  if (!topology) {
    return <div style={{ color: 'white', padding: 24 }}>No topology provided.</div>;
  }

  // Build the layout tree once; only recompute when topology/spec change.
  // liveState intentionally excluded — it updates frequently and only affects colours.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rootLayout = useMemo(() => buildLayout(topology, specification), [topology, specification]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f172a' }}>
      <Canvas
        camera={{ position: [14, 10, 14], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0f172a']} />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[12, 20, 8]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-10, 10, -8]} intensity={0.4} />
        <hemisphereLight args={['#1e293b', '#0f172a', 0.3]} />

        <Suspense fallback={null}>
          <Environment preset="warehouse" />
          <Bounds fit clip observe margin={1.3}>
            <TwinNodeRenderer layout={rootLayout} liveState={liveState} />
          </Bounds>
        </Suspense>

        <OrbitControls makeDefault enablePan enableRotate enableZoom />
        <gridHelper args={[60, 60, '#1e293b', '#0f172a']} position={[0, -0.02, 0]} />
      </Canvas>
    </div>
  );
};
