/**
 * TwinNodeRenderer.tsx
 *
 * Renders one node from the pre-computed NodeLayout tree.
 *
 * Key design rules
 * ────────────────
 * • Component identity is the stable `name` string, never an array index.
 * • Containers (station / block / system) render as a translucent slab so
 *   their children remain visible through them.
 * • Leaf meshes are selected via the MeshRegistry — no hardcoded type names.
 * • Name labels are hidden by default and appear ONLY on hover.
 * • Hover also shows a live-telemetry HTML panel.
 * • Children are rendered recursively inside the same group.
 * • Every mesh places its bottom at local Y = 0 (no extra group wrapper).
 *
 * Hover priority — depth-based centralized raycasting
 * ─────────────────────────────────────────────────────
 * Hover state is NOT driven by per-group onPointerOver/onPointerOut.
 * Instead, TwinViewer runs a frame-level raycaster (HoverManager) that:
 *   1. Calls raycaster.intersectObjects(scene, recursive=true) each frame.
 *   2. For every intersection, reads userData.componentName + userData.depth.
 *   3. Picks the component with the HIGHEST depth (most-specific / deepest).
 *   4. Stores that name in HoverContext.
 * Each TwinNodeRenderer reads from HoverContext and compares its own name.
 *
 * For this to work, every raycastable surface of a component must store:
 *   mesh.userData = { componentName: layout.name, depth: <nesting depth> }
 *
 * • ContainerMesh: full DoubleSide box — raycastable from all angles,
 *   including walls, top, bottom, and when viewed from below.
 * • Leaf nodes: an invisible DoubleSide bounding-box mesh provides the
 *   userData target; the visual MeshComp renders on top.
 * • NO ContainerHoverFloor needed (the full box handles floor + walls).
 * • NO onPointerOver/onPointerOut on groups (hover comes from context).
 */

import React, { useContext, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html, Edges } from '@react-three/drei';
import type { NodeLayout } from '../lib/layout';
import { resolveMaterial, isContainer } from '../lib/materials';
import { lookupMesh } from '../lib/meshRegistry';
import { MESH_COMPONENT_MAP } from './meshes';
import type { MeshProps } from './meshes';
import { HoverContext } from './HoverContext';
import { useSelection } from './SelectionContext';

// ─── container slab ───────────────────────────────────────────────────────────

interface ContainerMeshProps {
  dims: { width: number; height: number; depth: number };
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  userData: Record<string, unknown>;
}

/**
 * Translucent bounding box for containers.
 * side=2 (THREE.DoubleSide) makes ALL faces — walls, top, bottom — respond to
 * raycasts regardless of the camera angle, including views from below.
 * No `raycast={() => {}}` suppression; the HoverManager's depth-based logic
 * ensures a deeper nested component always wins over this surface.
 */
const ContainerMesh: React.FC<ContainerMeshProps> = ({
  dims, color, metalness, roughness, opacity, userData,
}) => (
  <mesh receiveShadow position={[0, dims.height / 2, 0]} userData={userData}>
    <boxGeometry args={[dims.width, dims.height, dims.depth]} />
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      opacity={opacity}
      transparent
      depthWrite={false}
      side={2}  /* THREE.DoubleSide — works from all camera angles */
    />
    <Edges scale={1} threshold={15} color={color} opacity={0.6} transparent />
  </mesh>
);

// ─── hover detail panel ───────────────────────────────────────────────────────

interface HoverInfoProps {
  layout: NodeLayout;
  liveStateRef: React.MutableRefObject<Record<string, unknown>>;
  visible: boolean;
  panelY: number;
}

const HoverInfo: React.FC<HoverInfoProps> = ({
  layout, liveStateRef, visible, panelY,
}) => {
  const [metrics, setMetrics] = useState<[string, unknown][]>([]);

  useFrame(() => {
    if (!visible) return;
    const state = (liveStateRef.current?.[layout.name] ?? {}) as Record<string, unknown>;
    const newMetrics = Object.entries(state)
      .filter(([k]) => k !== 'inputs')
      .slice(0, 4);
      
    if (JSON.stringify(newMetrics) !== JSON.stringify(metrics)) {
      setMetrics(newMetrics);
    }
  });

  if (!visible) return null;

  return (
    <Html position={[0, panelY + 0.8, 0]} center style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(10,12,20,0.94)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(147,197,253,0.3)',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#f1f5f9',
        minWidth: 160,
        maxWidth: 220,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: 13,
          marginBottom: 6,
          color: '#93c5fd',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 4,
        }}>
          {layout.name}
        </div>
        <div style={{ color: '#94a3b8', marginBottom: 4, fontSize: 11 }}>
          type: <span style={{ color: '#cbd5e1' }}>{layout.type}</span>
        </div>
        {metrics.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            marginTop: 4,
          }}>
            {metrics.map(([k, v]) => (
              <React.Fragment key={k}>
                <span style={{ color: '#64748b', fontSize: 10 }}>{k}</span>
                <span style={{ color: '#e2e8f0' }}>
                  {typeof v === 'number' ? v.toFixed(2) : String(v)}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>no live data</div>
        )}
      </div>
    </Html>
  );
};

// ─── main renderer component ──────────────────────────────────────────────────

interface TwinNodeRendererProps {
  layout: NodeLayout;
  liveStateRef: React.MutableRefObject<Record<string, unknown>>;
  /** Nesting depth from root (root = 0).  Passed down to children as depth+1.
   *  HoverManager uses this to pick the most-specific hovered component. */
  depth?: number;
}

export const TwinNodeRenderer: React.FC<TwinNodeRendererProps> = React.memo(({
  layout, liveStateRef, depth = 0,
}) => {
  // ── Read hover state from the centralized HoverContext ──────────────────
  const { hoveredName } = useContext(HoverContext);
  const hovered = hoveredName === layout.name;

  // ── Read / write selection state ────────────────────────────────────────
  const { selectedName, setSelectedName } = useSelection();
  const selected = selectedName === layout.name;

  const [failed, setFailed] = useState(false);

  useFrame(() => {
    const state = liveStateRef.current?.[layout.name] as any;
    const isFailed = state?.running === false;
    if (isFailed !== failed) {
      setFailed(isFailed);
    }
  });

  const mat = useMemo(
    () => resolveMaterial(layout.type, { hovered, failed }),
    [layout.type, hovered, failed]
  );

  const container = isContainer(layout.type) && layout.children.length > 0;

  // Mesh key resolved once via the registry.
  const meshKey  = lookupMesh(layout.type);
  const MeshComp = (MESH_COMPONENT_MAP[meshKey] ?? MESH_COMPONENT_MAP['GenericMesh']) as React.FC<MeshProps>;

  // userData stamped onto every raycast-target mesh for this component.
  // HoverManager reads this to identify which component was hit.
  const meshUserData = useMemo(
    () => ({ componentName: layout.name, depth }),
    [layout.name, depth]
  );

  const topY = layout.dims.height;

  return (
    <group
      position={layout.position}
      onClick={(e) => { e.stopPropagation(); setSelectedName(selected ? null : layout.name); }}
    >
      {container ? (
        // ── Container: full DoubleSide slab (walls + top + bottom all raycastable)
        <ContainerMesh
          dims={layout.dims}
          color={hovered ? '#93c5fd' : mat.color}
          metalness={mat.metalness}
          roughness={mat.roughness}
          opacity={mat.opacity}
          userData={meshUserData}
        />
      ) : (
        // ── Leaf: invisible DoubleSide bounding box carries the userData for
        //    raycasting; the visual MeshComp renders the actual shape on top.
        <>
          <mesh
            position={[0, layout.dims.height / 2, 0]}
            userData={meshUserData}
          >
            <boxGeometry args={[layout.dims.width, layout.dims.height, layout.dims.depth]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={2} />
          </mesh>
          <MeshComp
            dims={layout.dims}
            color={hovered ? '#93c5fd' : mat.color}
            metalness={mat.metalness}
            roughness={mat.roughness}
            opacity={mat.opacity}
            transparent={mat.transparent}
          />
        </>
      )}

      {/* Selection bounding-box outline — bright cyan ring when selected */}
      {selected && (
        <mesh position={[0, layout.dims.height / 2, 0]}>
          <boxGeometry args={[layout.dims.width + 0.05, layout.dims.height + 0.05, layout.dims.depth + 0.05]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0} depthWrite={false} />
          <Edges scale={1} threshold={1} color="#22d3ee" />
        </mesh>
      )}

      {/* Name label — only appears on hover */}
      {hovered && (
        <Text
          position={[0, topY + 0.35, 0]}
          fontSize={0.22}
          color="#93c5fd"
          anchorX="center"
          anchorY="bottom"
          outlineColor="#0f172a"
          outlineWidth={0.012}
          renderOrder={1}
        >
          {layout.name}
        </Text>
      )}

      {/* Live-telemetry hover panel */}
      <HoverInfo
        layout={layout}
        liveStateRef={liveStateRef}
        visible={hovered}
        panelY={topY}
      />

      {/* Recursively render children — depth increments at each level */}
      {layout.children.map((child) => (
        <TwinNodeRenderer
          key={child.name}
          layout={child}
          liveStateRef={liveStateRef}
          depth={depth + 1}
        />
      ))}
    </group>
  );
});
