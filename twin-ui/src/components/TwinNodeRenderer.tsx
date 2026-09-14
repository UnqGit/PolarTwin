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
import { Edges } from '@react-three/drei';
import type { NodeLayout } from '../lib/layout';
import { resolveMaterial, isContainer } from '../lib/materials';
import { lookupMesh } from '../lib/meshRegistry';
import { MESH_COMPONENT_MAP } from './meshes';
import type { MeshProps } from './meshes';
import { HoverContext } from './HoverContext';
import { useSelection } from './SelectionContext';

// ─── container slab ───────────────────────────────────────────────────────────

interface ContainerMeshProps {
  name: string;
  dims: { width: number; height: number; depth: number };
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  userData: Record<string, unknown>;
  showDoor?: boolean;
}

/**
 * Translucent bounding box for containers.
 * side=2 (THREE.DoubleSide) makes ALL faces — walls, top, bottom — respond to
 * raycasts regardless of the camera angle, including views from below.
 * No `raycast={() => {}}` suppression; the HoverManager's depth-based logic
 * ensures a deeper nested component always wins over this surface.
 */
const ContainerMesh: React.FC<ContainerMeshProps> = ({
  name, dims, color, metalness, roughness, opacity, userData, showDoor
}) => {
  let doorNode = null;
  if (showDoor) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = Math.imul(31, hash) + name.charCodeAt(i);
    const wallIndex = Math.abs(hash) % 4;
    
    const doorW = Math.min(1.0, (wallIndex % 2 === 0 ? dims.width : dims.depth) * 0.4);
    const doorH = Math.min(2.0, dims.height * 0.8);
    
    let pos = [0, doorH / 2 - dims.height / 2, 0];
    let args = [doorW, doorH, 0.05];
    
    switch(wallIndex) {
      case 0: // Front (+Z)
        pos[2] = dims.depth / 2 + 0.02;
        break;
      case 1: // Back (-Z)
        pos[2] = -dims.depth / 2 - 0.02;
        break;
      case 2: // Right (+X)
        pos[0] = dims.width / 2 + 0.02;
        args = [0.05, doorH, doorW];
        break;
      case 3: // Left (-X)
        pos[0] = -dims.width / 2 - 0.02;
        args = [0.05, doorH, doorW];
        break;
    }
    
    doorNode = (
      <mesh position={pos as [number, number, number]}>
        <boxGeometry args={args as [number, number, number]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.8} opacity={opacity} transparent={opacity < 1.0} depthWrite={opacity === 1.0} />
      </mesh>
    );
  }

  return (
    <mesh receiveShadow position={[0, dims.height / 2 + (userData.yOffset as number ?? 0), 0]} userData={userData}>
      <boxGeometry args={[dims.width, dims.height, dims.depth]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        opacity={opacity}
        transparent={opacity < 1.0}
        depthWrite={opacity === 1.0}
        side={2}  /* THREE.DoubleSide — works from all camera angles */
      />
      {doorNode}
      <Edges scale={1} threshold={15} color={color} opacity={0.6} transparent />
    </mesh>
  );
};

// ─── hover detail panel ───────────────────────────────────────────────────────



// ─── main renderer component ──────────────────────────────────────────────────

interface TwinNodeRendererProps {
  layout: NodeLayout;
  liveStateRef: React.MutableRefObject<Record<string, unknown>>;
  /** Nesting depth from root (root = 0).  Passed down to children as depth+1.
   *  HoverManager uses this to pick the most-specific hovered component. */
  depth?: number;
  containerOcclusion?: 'off' | 'off_on_hover';
  hasNonCampusAncestor?: boolean;
  effectiveLayer?: number | null;
}

export const TwinNodeRenderer: React.FC<TwinNodeRendererProps> = React.memo(({
  layout, liveStateRef, depth = 0, containerOcclusion = 'off', hasNonCampusAncestor = false, effectiveLayer = null,
}) => {
  // ── Read hover state from the centralized HoverContext ───────────────────
  const { hoveredNodes, hoveredAncestors, selectedAncestors, activeLayer, componentsInteractable } = useContext(HoverContext);
  const hovered = hoveredNodes.has(layout.name);
  const descendantHovered = hoveredAncestors?.has(layout.name) ?? false;
  const descendantSelected = selectedAncestors?.has(layout.name) ?? false;

  // ── Read / write selection state ────────────────────────────────────────
  const { selectedName, hiddenSet } = useSelection();
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
    () => resolveMaterial(layout.type, { hovered, failed, selected }),
    [layout.type, hovered, failed, selected]
  );

  const container = isContainer(layout.type) && layout.children.length > 0;

  // Mesh key resolved once via the registry.
  const meshKey  = lookupMesh(layout.type);
  const MeshComp = (MESH_COMPONENT_MAP[meshKey] ?? MESH_COMPONENT_MAP['GenericMesh']) as React.FC<MeshProps>;

  // userData stamped onto every raycast-target mesh for this component.
  // HoverManager reads this to identify which component was hit.
  const meshUserData = useMemo(
    () => ({ componentName: layout.name, depth, yOffset: layout.yOffset }),
    [layout.name, depth, layout.yOffset]
  );

  const isHidden = hiddenSet.has(layout.name);
  
  // ── Campus Logic ──
  const isCampus = layout.type === 'campus';
  const isOutermostNonCampus = !isCampus && !hasNonCampusAncestor;
  const nextHasNonCampusAncestor = hasNonCampusAncestor || !isCampus;
  
  // ── Interaction Layer Logic ──
  const myEffectiveLayer = layout.type === 'floor' && typeof layout.level === 'number' 
    ? layout.level 
    : effectiveLayer;
    
  // A node is interactive if no layer is selected, OR if it has no effective layer (e.g., Block outside a floor), OR if its layer matches.
  const isInteractive = activeLayer === null || myEffectiveLayer === null || activeLayer === myEffectiveLayer;

  const isOffOnHover = containerOcclusion === 'off_on_hover';
  let containerOpacity = mat.opacity;
  
  if (!componentsInteractable) {
    // If global interaction is disabled, all floors use equal normal translucency
    containerOpacity = mat.opacity;
  } else if (activeLayer !== null && containerOcclusion === 'off') {
    // If a specific layer is active and we want emphasis (occlusion is off)
    if (myEffectiveLayer !== null && activeLayer === myEffectiveLayer) {
      containerOpacity = 1.0;
    } else if (myEffectiveLayer !== null) {
      containerOpacity = mat.opacity * 0.15; // subdued
    }
  } else if (isOffOnHover) {
    // Normal off_on_hover logic using outermost non-campus
    containerOpacity = (isOutermostNonCampus || hovered || descendantHovered || descendantSelected || selected ? mat.opacity : 1.0);
  }

  const yOffset = layout.yOffset ?? 0;

  return (
    <group
      position={layout.position}
      visible={!isHidden}
    >
      {isCampus ? (
        // ── Campus: render as a flat reference plane ──
        <mesh receiveShadow position={[0, yOffset, 0]} userData={isInteractive ? meshUserData : {}} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[layout.dims.width, layout.dims.depth]} />
          <meshStandardMaterial
            color={hovered ? '#93c5fd' : mat.color}
            metalness={mat.metalness}
            roughness={mat.roughness}
            opacity={containerOpacity}
            transparent={containerOpacity < 1.0}
            depthWrite={containerOpacity === 1.0}
          />
          <Edges scale={1} threshold={15} color={mat.color} opacity={0.6} transparent />
        </mesh>
      ) : container ? (
        // ── Container: full DoubleSide slab (walls + top + bottom all raycastable)
        <ContainerMesh
          name={layout.name}
          dims={layout.dims}
          color={hovered ? '#93c5fd' : mat.color}
          metalness={mat.metalness}
          roughness={mat.roughness}
          opacity={containerOpacity}
          userData={isInteractive ? meshUserData : {}}
          showDoor={layout.type !== 'system' && layout.type !== 'floor'}
        />
      ) : (
        // ── Leaf: invisible DoubleSide bounding box carries the userData for
        //    raycasting; the visual MeshComp renders the actual shape on top.
        <>
          <mesh
            position={[0, layout.dims.height / 2 + yOffset, 0]}
            userData={isInteractive ? meshUserData : {}}
          >
            <boxGeometry args={[layout.dims.width, layout.dims.height, layout.dims.depth]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={2} />
          </mesh>
          <group position={[0, yOffset, 0]}>
            <MeshComp
              dims={layout.dims}
              color={hovered ? '#93c5fd' : mat.color}
              metalness={mat.metalness}
              roughness={mat.roughness}
              opacity={mat.opacity}
              transparent={mat.transparent}
            />
          </group>
        </>
      )}

      {/* Selection bounding-box outline — bright cyan ring when selected */}
      {selected && (
        <mesh position={[0, layout.dims.height / 2 + yOffset, 0]}>
          <boxGeometry args={[layout.dims.width + 0.05, layout.dims.height + 0.05, layout.dims.depth + 0.05]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0} depthWrite={false} />
          <Edges scale={1} threshold={1} color="#22d3ee" />
        </mesh>
      )}




      {/* Recursively render children — depth increments at each level */}
      {layout.children.map((child) => (
        <TwinNodeRenderer
          key={child.name}
          layout={child}
          liveStateRef={liveStateRef}
          depth={depth + 1}
          containerOcclusion={containerOcclusion}
          hasNonCampusAncestor={nextHasNonCampusAncestor}
          effectiveLayer={myEffectiveLayer}
        />
      ))}
    </group>
  );
});
