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
import { TwinVisualProvider } from './TwinVisualContext';
import { PolarEnvironment } from './PolarEnvironment';
import { TwinViewerToolbar } from './TwinViewerToolbar';

// ─── types ────────────────────────────────────────────────────────────────────

export type LightingMode = 'dynamic' | 'static' | 'off';

class ViewerErrorBoundary extends React.Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any, info: any) {
    console.warn('TwinViewer 3D Canvas error caught:', err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main, #0b111e)', color: 'var(--text-secondary, #94a3b8)', gap: '12px' }}>
          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '14px' }}>3D Scene View Recovery</div>
          <div style={{ fontSize: '12px', maxWidth: '360px', textAlign: 'center' }}>
            A visual rendering glitch occurred during simulation. The simulation engine and telemetry remain active.
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ padding: '6px 14px', borderRadius: '4px', background: 'var(--accent-blue, #38d9f5)', color: '#000', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Reset 3D Canvas
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const skyColor = theme === 'light' ? '#e2e8f0' : '#0d111c';
  const groundColor = theme === 'light' ? '#f0f4f8' : '#06060c';

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

  const [hasPointerMoved, setHasPointerMoved] = useState(false);
  const isPointerInside = React.useRef(true);

  useEffect(() => {
    const el = gl?.domElement;
    if (!el) return;
    const onMove = () => {
      setHasPointerMoved(true);
      isPointerInside.current = true;
    };
    const onLeave = () => {
      isPointerInside.current = false;
      if (hoveredNameRef.current !== null) {
        hoveredNameRef.current = null;
        setHoveredName(null);
        if (onHoverChange) onHoverChange(null);
      }
    };
    const onEnter = () => {
      isPointerInside.current = true;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerenter', onEnter);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerenter', onEnter);
    };
  }, [gl, setHoveredName, onHoverChange, hoveredNameRef]);

  useFrame(({ raycaster, scene }) => {
    if (!hasPointerMoved || !isPointerInside.current) return;
    
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
  leftPanelOpen?: boolean;
  setLeftPanelOpen?: (open: boolean) => void;
  rightOffset?: number;
  bottomOffset?: number;
  hideEditInitials?: boolean;
  isEditingInitials?: boolean;
  setIsEditingInitials?: (val: boolean) => void;
  onSetInitials?: (component: string, key: string, value: number) => void;
  onResetInitials?: (component: string) => void;
  valueOverrides?: Record<string, Record<string, number>>;
  runtime?: any[] | null;
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
  customSidebarTabs,
  leftPanelOpen,
  setLeftPanelOpen,
  rightOffset = 20,
  bottomOffset = 20,
  hideEditInitials = false,
  isEditingInitials,
  setIsEditingInitials,
  onSetInitials,
  onResetInitials,
  valueOverrides = {},
  runtime = null
}) => {
  const { theme } = useTheme();
  const bgMain = theme === 'light' ? '#f0f4f8' : '#06060c';

  const sceneLayout = useMemo(
    () => {
      try {
        return buildSceneLayout(topology, connections, specification);
      } catch (err) {
        console.error("Layout error:", err);
        return { root: null, connections: [], allNodes: new Map<string, any>(), connectionRouterGenerator: function*() {} };
      }
    },
    [topology, connections, specification]
  );

  const [renderedConnections, setRenderedConnections] = useState<any[]>([]);
  const [buildLimit, setBuildLimit] = useState(0);

  // Progressive node build animation
  useEffect(() => {
    if (!sceneLayout.root) return;
    const totalNodes = sceneLayout.allNodes.size;
    setBuildLimit(0);
    setRenderedConnections([]);

    let limit = 0;
    let animFrame: number;
    const animateNodes = () => {
      limit += Math.max(1, Math.floor(totalNodes / 60)); // Animate over ~60 frames
      setBuildLimit(limit);
      if (limit < totalNodes) {
        animFrame = requestAnimationFrame(animateNodes);
      } else {
        // Once nodes are done, start routing connections progressively
        if (sceneLayout.connectionRouterGenerator) {
          const gen = sceneLayout.connectionRouterGenerator();
          const tickConnections = () => {
            const res = gen.next();
            setRenderedConnections([...sceneLayout.connections]);
            if (!res.done) {
              requestAnimationFrame(tickConnections);
            }
          };
          requestAnimationFrame(tickConnections);
        }
      }
    };
    animFrame = requestAnimationFrame(animateNodes);
    return () => cancelAnimationFrame(animFrame);
  }, [sceneLayout]);

  const hoveredNameRef = useRef<string | null>(null);
  const [internalHoveredName, setInternalHoveredName] = useState<string | null>(null);

  const [internalComponentsInteractable, setInternalComponentsInteractable] = useState(true);
  const [internalConnectionsInteractable, setInternalConnectionsInteractable] = useState(true);
  const [internalLightingMode, setInternalLightingMode] = useState<LightingMode>(lightingMode || 'dynamic');
  const [internalOcclusion, setInternalOcclusion] = useState<'off' | 'off_on_hover'>('off');

  useEffect(() => {
    if (lightingMode) setInternalLightingMode(lightingMode);
  }, [lightingMode]);

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

  const hoveredAssociated = useMemo(() => {
    const set = new Set<string>();
    if (internalHoveredName) {
      const conn = sceneLayout.connections.find((c: any) => c.id === internalHoveredName);
      if (conn) {
        set.add(conn.source);
        set.add(conn.target);
      } else {
        const relatedConns = sceneLayout.connections.filter(
          (c: any) => c.source === internalHoveredName || c.target === internalHoveredName
        );
        for (const rc of relatedConns) set.add(rc.id);
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
  
  const selectedAssociated = useMemo(() => {
    const set = new Set<string>();
    if (effectiveSelected) {
      const conn = sceneLayout.connections.find((c: any) => c.id === effectiveSelected);
      if (conn) {
        set.add(conn.source);
        set.add(conn.target);
      } else {
        const relatedConns = sceneLayout.connections.filter(
          (c: any) => c.source === effectiveSelected || c.target === effectiveSelected
        );
        for (const rc of relatedConns) set.add(rc.id);
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
      <TwinVisualProvider>
        <HoverContext.Provider value={{ 
          hoveredName: internalHoveredName, 
          hoveredAssociated,
          selectedAssociated,
          hoveredAncestors, 
          selectedAncestors, 
          activeLayer,
          componentsInteractable: activeComponentsInteractable,
          connectionsInteractable: activeConnectionsInteractable,
          setHoveredName: handleHoverChange,
        }}>
          <div style={{ width: '100%', height: '100%', background: 'var(--bg-main)', position: 'relative' }}>
            {/* Mission Control 3D Toolbar */}
            <TwinViewerToolbar onResetCamera={handleResetCamera} />

            <ViewerErrorBoundary>
              <Canvas
                camera={{ position: [35, 25, 35], fov: 50 }}
                shadows={internalLightingMode !== 'off'}
                gl={{ antialias: true }}
              >
                <RaycasterConfig />

                <Suspense fallback={null}>
                  <Environment preset="warehouse" />
                  <PolarEnvironment lightingMode={internalLightingMode} />
                  <HoverManager 
                    hoveredNameRef={hoveredNameRef} 
                    onHoverChange={handleHoverChange}
                    componentsInteractable={activeComponentsInteractable}
                    connectionsInteractable={activeConnectionsInteractable}
                  >
                    <Bounds margin={1.3}>
                      {!hideAllComponents && (
                        <TwinNodeRenderer
                          layout={sceneLayout.root}
                          depth={0}
                          liveStateRef={liveStateRef}
                          containerOcclusion={internalOcclusion}
                          buildLimit={buildLimit}
                        />
                      )}
                      {!hideAllConnections && (
                        <ConnectionRenderer
                          connections={renderedConnections}
                          root={sceneLayout.root}
                        />
                      )}
                    </Bounds>
                  </HoverManager>
                </Suspense>

                <OrbitControls ref={controlsRef} makeDefault enablePan enableRotate enableZoom />
              </Canvas>
            </ViewerErrorBoundary>
          
          <RightUIStack root={sceneLayout.root} connections={renderedConnections} liveStateRef={liveStateRef} rightOffset={rightOffset} bottomOffset={bottomOffset}>
          </RightUIStack>

          <HierarchyPanel 
            isOpen={leftPanelOpen}
            onIsOpenChange={setLeftPanelOpen}
            root={sceneLayout.root}
            connections={renderedConnections}
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
            bottomOffset={bottomOffset}
            hideEditInitials={hideEditInitials}
            isEditingInitials={isEditingInitials}
            setIsEditingInitials={setIsEditingInitials}
            onSetInitials={onSetInitials}
            onResetInitials={onResetInitials}
            valueOverrides={valueOverrides}
            runtime={runtime}
          />

          {isGraphOpen && (
            <GraphModal 
              onClose={() => setIsGraphOpen(false)}
              connections={renderedConnections}
              allNodes={sceneLayout.allNodes}
              root={sceneLayout.root}
              liveStateRef={liveStateRef}
            />
          )}



          {children}
        </div>
      </HoverContext.Provider>
      </TwinVisualProvider>
    </SelectionProvider>
  );
});
