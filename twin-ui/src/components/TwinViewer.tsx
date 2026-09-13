/**
 * TwinViewer.tsx
 *
 * Top-level Canvas.  Calls buildSceneLayout (once per topology/spec change) to
 * produce:
 *   - root NodeLayout tree  → rendered by TwinNodeRenderer
 *   - ConnectionLayout list → rendered by ConnectionRenderer
 *
 * liveStateRef is intentionally excluded from the memo so fast-changing telemetry
 * does not trigger a full layout recompute — it only updates material colours
 * via useFrame in each TwinNodeRenderer.
 *
 * ── Hover system ─────────────────────────────────────────────────────────────
 * HoverManager runs a useFrame loop raycasting every frame.  The
 * highest-depth (most-specific) hit wins and is stored in HoverContext.
 *
 * ── Selection system ─────────────────────────────────────────────────────────
 * Clicking a component (or a hierarchy item) updates SelectionContext.
 * TwinNodeRenderer renders a selection bounding box for the selected component.
 *
 * ── Lighting modes ───────────────────────────────────────────────────────────
 *   'dynamic' — full real-time lights + shadow casting (default, current behaviour)
 *   'static'  — lights remain but BakeShadows freezes shadow maps after first render
 *   'off'     — ambient-only, no shadow casting, maximum GPU performance
 */

import React, { Suspense, useMemo, useState, useRef, useEffect, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds, BakeShadows } from '@react-three/drei';
import { buildSceneLayout } from '../lib/layout';
import { TwinNodeRenderer } from './TwinNodeRenderer';
import { ConnectionRenderer } from './ConnectionRenderer';
import { HoverContext } from './HoverContext';
import { SelectionContext } from './SelectionContext';
import { HierarchyPanel } from './HierarchyPanel';

// ─── types ────────────────────────────────────────────────────────────────────

export type LightingMode = 'dynamic' | 'static' | 'off';

// ─── raycaster configurator ───────────────────────────────────────────────────

const RaycasterConfig: React.FC = () => {
  const { raycaster } = useThree();
  useEffect(() => {
    raycaster.params.Line = raycaster.params.Line || { threshold: 0.35 };
    raycaster.params.Points = raycaster.params.Points || { threshold: 0.1 };
    raycaster.params.Line.threshold   = 0.35;
    raycaster.params.Points.threshold = 0.1;
  }, [raycaster]);
  return null;
};

// ─── lighting ─────────────────────────────────────────────────────────────────

interface SceneLightsProps {
  mode: LightingMode;
}

/**
 * Renders the appropriate lights for the given mode.
 * Keeps all light JSX in one place so switching modes never leaks old lights.
 *
 * 'dynamic' — full lights with shadow-casting directional light.
 * 'static'  — same lights but shadows are baked (frozen after first render via BakeShadows).
 * 'off'     — ambient-only, no shadows, maximum performance.
 */
const SceneLights: React.FC<SceneLightsProps> = ({ mode }) => {
  if (mode === 'off') {
    return (
      <>
        <ambientLight intensity={1.2} />
        {/* No shadow-casting lights in 'off' mode */}
      </>
    );
  }

  if (mode === 'static') {
    return (
      <>
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[12, 20, 8]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-10, 10, -8]} intensity={0.4} />
        <hemisphereLight args={['#1e293b', '#0f172a', 0.3]} />
        {/*
          BakeShadows freezes the shadow map after the first render pass.
          It does NOT perform physical lightmap baking — it simply calls
          renderer.shadowMap.needsUpdate = false after the first frame, which
          prevents repeated shadow-map recalculation each frame.
          This is effective for static scenes where components don't move.
        */}
        <BakeShadows />
      </>
    );
  }

  // 'dynamic' — standard real-time lights.
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[12, 20, 8]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-10, 10, -8]} intensity={0.4} />
      <hemisphereLight args={['#1e293b', '#0f172a', 0.3]} />
    </>
  );
};

// ─── hover manager ────────────────────────────────────────────────────────────

const HoverManager: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const prevRef = useRef<string | null>(null);

  useFrame(({ raycaster, scene }) => {
    const intersects = raycaster.intersectObjects(scene.children, true);

    let maxDepth = -1;
    let bestName: string | null = null;

    for (const hit of intersects) {
      const ud = hit.object.userData;
      if (typeof ud?.componentName !== 'string') continue;
      if (typeof ud?.depth !== 'number') continue;
      if (ud.depth > maxDepth) {
        maxDepth = ud.depth;
        bestName = ud.componentName;
      }
    }

    if (bestName !== prevRef.current) {
      prevRef.current = bestName;
      setHoveredName(bestName);
    }
  });

  useEffect(() => {
    document.body.style.cursor = hoveredName ? 'pointer' : '';
    return () => { document.body.style.cursor = ''; };
  }, [hoveredName]);

  return (
    <HoverContext.Provider value={{ hoveredName }}>
      {children}
    </HoverContext.Provider>
  );
};

// ─── viewer ───────────────────────────────────────────────────────────────────

interface TwinViewerProps {
  topology: any;
  specification: any;
  liveStateRef: React.MutableRefObject<Record<string, unknown>>;
  lightingMode?: LightingMode;
  selectedName?: string | null;
  onSelectName?: (name: string | null) => void;
}

export const TwinViewer: React.FC<TwinViewerProps> = React.memo(({
  topology, specification, liveStateRef,
  lightingMode = 'dynamic',
  selectedName = null,
  onSelectName,
}) => {
  if (!topology) {
    return <div style={{ color: 'white', padding: 24 }}>No topology provided.</div>;
  }

  // Build layout + connections once; recompute only when topology / spec change.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const sceneLayout = useMemo(
    () => buildSceneLayout(topology, specification),
    [topology, specification]
  );

  // Internal selection state (if no external handler provided).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const effectiveSelected = onSelectName ? selectedName : internalSelected;
  const effectiveSetSelected = onSelectName ?? setInternalSelected;

  const selectionValue = useMemo(
    () => ({ selectedName: effectiveSelected, setSelectedName: effectiveSetSelected }),
    [effectiveSelected, effectiveSetSelected]
  );

  const [hierarchyCollapsed, setHierarchyCollapsed] = useState(false);

  return (
    <SelectionContext.Provider value={selectionValue}>
      <div style={{ width: '100%', height: '100%', background: '#0f172a', position: 'relative' }}>
        <Canvas
          camera={{ position: [14, 10, 14], fov: 50 }}
          shadows={lightingMode !== 'off'}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#0f172a']} />

          <RaycasterConfig />

          {/* Key-driven: switching lightingMode unmounts the old lights cleanly */}
          <SceneLights key={lightingMode} mode={lightingMode} />

          <Suspense fallback={null}>
            <Environment preset="warehouse" />
            <HoverManager>
              <Bounds fit clip observe margin={1.3}>
                <TwinNodeRenderer
                  layout={sceneLayout.root}
                  liveStateRef={liveStateRef}
                  depth={0}
                />
                <ConnectionRenderer connections={sceneLayout.connections} />
              </Bounds>
            </HoverManager>
          </Suspense>

          <OrbitControls makeDefault enablePan enableRotate enableZoom />
          <gridHelper args={[60, 60, '#1e293b', '#0f172a']} position={[0, -0.02, 0]} />
        </Canvas>
        
        <HierarchyPanel 
          root={sceneLayout.root}
          connections={sceneLayout.connections}
          collapsed={hierarchyCollapsed}
          onToggleCollapse={() => setHierarchyCollapsed(c => !c)}
        />
      </div>
    </SelectionContext.Provider>
  );
});
