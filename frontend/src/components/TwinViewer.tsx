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
import { GraphModal } from './GraphModal';
import { useTheme } from './ThemeContext';

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
  theme: 'light' | 'dark';
}

/**
 * Renders the appropriate lights for the given mode.
 * Keeps all light JSX in one place so switching modes never leaks old lights.
 *
 * 'dynamic' — full lights with shadow-casting directional light.
 * 'static'  — same lights but shadows are baked (frozen after first render via BakeShadows).
 * 'off'     — ambient-only, no shadows, maximum performance.
 */
const SceneLights: React.FC<SceneLightsProps> = ({ mode, theme }) => {
  const skyColor = theme === 'light' ? '#cbd5e1' : '#1e293b';
  const groundColor = theme === 'light' ? '#f8fafc' : '#0f172a';

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
        <hemisphereLight args={[skyColor, groundColor, 0.3]} />
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
      <hemisphereLight args={[skyColor, groundColor, 0.3]} />
    </>
  );
};

// ─── hover manager ────────────────────────────────────────────────────────────

interface HoverManagerProps {
  children: ReactNode;
  onHoverChange?: (name: string | null) => void;
  hoveredNameRef: React.MutableRefObject<string | null>;
  componentsInteractable: boolean;
  connectionsInteractable: boolean;
}

const HoverManager: React.FC<HoverManagerProps> = ({ 
  children, onHoverChange, hoveredNameRef, componentsInteractable, connectionsInteractable 
}) => {
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const { gl } = useThree();
  const { selectedName, setSelectedName } = React.useContext(SelectionContext);

  useFrame(({ raycaster, scene }) => {
    const intersects = raycaster.intersectObjects(scene.children, true);

    let maxDepth = -1;
    let bestName: string | null = null;

    for (const hit of intersects) {
      let curr: any = hit.object;
      let isVisible = true;
      while (curr) {
        if (curr.visible === false) {
          isVisible = false;
          break;
        }
        curr = curr.parent;
      }
      if (!isVisible) continue;

      const ud = hit.object.userData;
      if (typeof ud?.componentName !== 'string') continue;
      if (typeof ud?.depth !== 'number') continue;
      
      const isConn = !!ud.isConnection;
      if (isConn && !connectionsInteractable) continue;
      if (!isConn && !componentsInteractable) continue;

      if (ud.depth > maxDepth) {
        maxDepth = ud.depth;
        bestName = ud.componentName;
      }
    }

    if (bestName !== hoveredNameRef.current) {
      hoveredNameRef.current = bestName;
      setHoveredName(bestName);
      if (onHoverChange) onHoverChange(bestName);
    }
  });

  // Pointer drag check (delta distance)
  useEffect(() => {
    const el = gl?.domElement;
    if (!el) return;
    
    let downPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent) => {
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > 4) {
        return; // Dragged, so ignore click
      }
      const clickedName = hoveredNameRef.current;
      if (clickedName === selectedName) {
        setSelectedName(null);
      } else {
        setSelectedName(clickedName);
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClick);
    };
  }, [gl, setSelectedName, selectedName, hoveredNameRef]);

  useEffect(() => {
    document.body.style.cursor = hoveredName ? 'pointer' : '';
    return () => { document.body.style.cursor = ''; };
  }, [hoveredName]);

  return <>{children}</>;
};

// ─── viewer ───────────────────────────────────────────────────────────────────

import { Target } from 'lucide-react';
import { SelectionProvider } from './SelectionContext';
import { RightUIStack } from './RightUIStack';
import { HoverCard } from './HoverCard';

interface TwinViewerProps {
  topology: any;
  connections: any;
  specification: any;
  liveStateRef: React.MutableRefObject<Record<string, unknown>>;
  lightingMode?: LightingMode;
  selectedName?: string | null;
  onSelectName?: (name: string | null) => void;
  onHoverChange?: (name: string | null) => void;
  onConnectionHoverChange?: (conn: any | null) => void;
  componentsInteractable?: boolean;
  connectionsInteractable?: boolean;
  onComponentsInteractableChange?: (val: boolean) => void;
  onConnectionsInteractableChange?: (val: boolean) => void;
  children?: ReactNode; // For the HUD overlay
  customSidebarTabs?: { id: string, icon: React.ReactNode, title: string, content: React.ReactNode }[];
}

export const TwinViewer: React.FC<TwinViewerProps> = React.memo(({
  topology, connections, specification, liveStateRef,
  lightingMode = 'dynamic',
  selectedName = null,
  onSelectName,
  onHoverChange,
  onConnectionHoverChange,
  componentsInteractable = true,
  connectionsInteractable = true,
  onComponentsInteractableChange,
  onConnectionsInteractableChange,
  children,
  customSidebarTabs
}) => {
  const { theme } = useTheme();
  const bgMain = theme === 'light' ? '#f8fafc' : '#0f172a';

  const sceneLayout = useMemo(
    () => {
      try {
        return buildSceneLayout(topology, connections, specification);
      } catch (err) {
        console.error("Layout error:", err);
        return { root: null, connections: [], allNodes: new Map<string, any>() };
      }
    },
    [topology, connections, specification]
  );


  const hoveredNameRef = useRef<string | null>(null);
  const [internalHoveredName, setInternalHoveredName] = useState<string | null>(null);

  const [internalComponentsInteractable, setInternalComponentsInteractable] = useState(true);
  const [internalConnectionsInteractable, setInternalConnectionsInteractable] = useState(true);
  const [internalLightingMode, setInternalLightingMode] = useState<LightingMode>('dynamic');
  const [internalOcclusion, setInternalOcclusion] = useState<'off' | 'off_on_hover'>('off');

  const controlsRef = useRef<any>(null);

  const [activeLayer, setActiveLayer] = useState<number | null>(0);

    const handleResetCamera = React.useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  const [hideAllComponents, setHideAllComponents] = useState(false);
  const [hideAllConnections, setHideAllConnections] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  const activeComponentsInteractable = onComponentsInteractableChange ? componentsInteractable : internalComponentsInteractable;
  const activeConnectionsInteractable = onConnectionsInteractableChange ? connectionsInteractable : internalConnectionsInteractable;
  
  const handleComponentsInteractable = onComponentsInteractableChange || setInternalComponentsInteractable;
  const handleConnectionsInteractable = onConnectionsInteractableChange || setInternalConnectionsInteractable;

  const handleHoverChange = useMemo(() => (name: string | null) => {
    setInternalHoveredName(name);
    if (name && sceneLayout.connections.some((c: any) => c.id === name)) {
      if (onConnectionHoverChange) onConnectionHoverChange(sceneLayout.connections.find((c: any) => c.id === name));
      if (onHoverChange) onHoverChange(null);
    } else {
      if (onConnectionHoverChange) onConnectionHoverChange(null);
      if (onHoverChange) onHoverChange(name);
    }
  }, [sceneLayout, onHoverChange, onConnectionHoverChange]);

  const hoveredNodes = useMemo(() => {
    const set = new Set<string>();
    if (internalHoveredName) {
      set.add(internalHoveredName);
      const conn = sceneLayout.connections.find((c: any) => c.id === internalHoveredName);
      if (conn) {
        set.add(conn.source);
        set.add(conn.target);
      }
    }
    return set;
  }, [internalHoveredName, sceneLayout.connections]);

  const hoveredAncestors = useMemo(() => {
    const set = new Set<string>();
    if (internalHoveredName) {
      const node = sceneLayout.allNodes.get(internalHoveredName);
      if (node && node.ancestors) {
        for (const anc of node.ancestors) {
          set.add(anc);
        }
      }
      const relatedConns = sceneLayout.connections.filter(
        (c: any) => c.id === internalHoveredName || c.source === internalHoveredName || c.target === internalHoveredName
      );
      for (const conn of relatedConns) {
        const srcNode = sceneLayout.allNodes.get(conn.source);
        if (srcNode && srcNode.ancestors) {
          for (const anc of srcNode.ancestors) set.add(anc);
        }
        const tgtNode = sceneLayout.allNodes.get(conn.target);
        if (tgtNode && tgtNode.ancestors) {
          for (const anc of tgtNode.ancestors) set.add(anc);
        }
      }
    }
    return set;
  }, [internalHoveredName, sceneLayout.allNodes, sceneLayout.connections]);

  const internalSelected = null;
  const effectiveSelected = onSelectName !== undefined ? selectedName : internalSelected;
  
  const selectionNodes = useMemo(() => {
    const set = new Set<string>();
    if (effectiveSelected) {
      set.add(effectiveSelected);
      const conn = sceneLayout.connections.find((c: any) => c.id === effectiveSelected);
      if (conn) {
        set.add(conn.source);
        set.add(conn.target);
      }
    }
    return set;
  }, [effectiveSelected, sceneLayout.connections]);

  const selectedAncestors = useMemo(() => {
    const set = new Set<string>();
    if (effectiveSelected) {
      const node = sceneLayout.allNodes.get(effectiveSelected);
      if (node && node.ancestors) {
        for (const anc of node.ancestors) {
          set.add(anc);
        }
      }
      const relatedConns = sceneLayout.connections.filter(
        (c: any) => c.id === effectiveSelected || c.source === effectiveSelected || c.target === effectiveSelected
      );
      for (const conn of relatedConns) {
        const srcNode = sceneLayout.allNodes.get(conn.source);
        if (srcNode && srcNode.ancestors) {
          for (const anc of srcNode.ancestors) set.add(anc);
        }
        const tgtNode = sceneLayout.allNodes.get(conn.target);
        if (tgtNode && tgtNode.ancestors) {
          for (const anc of tgtNode.ancestors) set.add(anc);
        }
      }
    }
    return set;
  }, [effectiveSelected, sceneLayout.allNodes, sceneLayout.connections]);

  if (!topology || !sceneLayout.root) {
    return <div style={{ color: 'white', padding: 24 }}>No topology provided.</div>;
  }

  return (
    <SelectionProvider externalSelection={onSelectName !== undefined ? [selectedName, onSelectName] : undefined}>
      <HoverContext.Provider value={{ 
        hoveredName: internalHoveredName, 
        hoveredNodes: new Set([...hoveredNodes, ...selectionNodes]), 
        hoveredAncestors, 
        selectedAncestors, 
        activeLayer,
        componentsInteractable: activeComponentsInteractable,
        connectionsInteractable: activeConnectionsInteractable,
        setHoveredName: handleHoverChange,
      }}>
        <div style={{ width: '100%', height: '100%', background: 'var(--bg-main)', position: 'relative' }}>
          <Canvas
            camera={{ position: [35, 25, 35], fov: 50 }}
            shadows={lightingMode !== 'off'}
            gl={{ antialias: true }}
          >
            <color attach="background" args={[bgMain]} />

            <RaycasterConfig />

            <SceneLights key={`${internalLightingMode}-${theme}`} mode={internalLightingMode} theme={theme} />

            <Suspense fallback={null}>
              <Environment preset="warehouse" />
              <HoverManager 
                hoveredNameRef={hoveredNameRef} 
                onHoverChange={handleHoverChange}
                componentsInteractable={activeComponentsInteractable}
                connectionsInteractable={activeConnectionsInteractable}
              >
                <Bounds fit clip margin={1.3}>
                  {!hideAllComponents && (
                    <TwinNodeRenderer
                      layout={sceneLayout.root}
                      depth={0}
                      liveStateRef={liveStateRef}
                      containerOcclusion={internalOcclusion}
                    />
                  )}
                  {!hideAllConnections && (
                    <ConnectionRenderer
                      connections={sceneLayout.connections}
                      root={sceneLayout.root}
                    />
                  )}
                </Bounds>
              </HoverManager>
            </Suspense>

            <OrbitControls ref={controlsRef} makeDefault enablePan enableRotate enableZoom />
            
            {/* Floor / Reference Plane + Axis Lines */}
            <group position={[0, -0.01, 0]}>
              {/* X axis line (red) */}
              <line>
                <bufferGeometry>
                  <bufferAttribute attach="attributes-position" args={[new Float32Array([-30,0,0, 30,0,0]), 3]} />
                </bufferGeometry>
                <lineBasicMaterial color="#ef4444" opacity={0.5} transparent />
              </line>
              {/* Z axis line (blue) */}
              <line>
                <bufferGeometry>
                  <bufferAttribute attach="attributes-position" args={[new Float32Array([0,0,-30, 0,0,30]), 3]} />
                </bufferGeometry>
                <lineBasicMaterial color="#3b82f6" opacity={0.5} transparent />
              </line>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <shadowMaterial transparent opacity={0.2} />
              </mesh>
            </group>
          </Canvas>
          
          <RightUIStack root={sceneLayout.root} connections={sceneLayout.connections} liveStateRef={liveStateRef}>
          </RightUIStack>

          <HierarchyPanel 
            root={sceneLayout.root}
            connections={sceneLayout.connections}
            componentsInteractable={activeComponentsInteractable}
            connectionsInteractable={activeConnectionsInteractable}
            onComponentsInteractableChange={handleComponentsInteractable}
            onConnectionsInteractableChange={handleConnectionsInteractable}
            hideAllComponents={hideAllComponents}
            hideAllConnections={hideAllConnections}
            onHideAllComponentsChange={setHideAllComponents}
            onHideAllConnectionsChange={setHideAllConnections}
            liveStateRef={liveStateRef}
            onResetCamera={handleResetCamera}
            activeLayer={activeLayer}
            setActiveLayer={setActiveLayer}
            onShowGraph={() => setIsGraphOpen(true)}
            customSidebarTabs={customSidebarTabs}
            lightingMode={internalLightingMode}
            onLightingModeChange={setInternalLightingMode}
            containerOcclusion={internalOcclusion}
            onContainerOcclusionChange={setInternalOcclusion}
          />

          {isGraphOpen && (
            <GraphModal 
              onClose={() => setIsGraphOpen(false)}
              connections={sceneLayout.connections}
              allNodes={sceneLayout.allNodes}
              root={sceneLayout.root}
              liveStateRef={liveStateRef}
            />
          )}



          {children}
        </div>
      </HoverContext.Provider>
    </SelectionProvider>
  );
});
