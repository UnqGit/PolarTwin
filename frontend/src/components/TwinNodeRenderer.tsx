/**
 * TwinNodeRenderer.tsx
 *
 * PolarTwin Architectural 3D Node Renderer:
 * - Real Antarctic modular station pod architecture (elevated hydraulic stilts, insulated panels)
 * - Multi-mode visualization: 'realistic' polar pods, 'holographic' tactical CAD, and 'thermal' heatmap
 * - Exploded view: smoothly lifts roofs and upper decks along the Y-axis to expose interior machinery
 * - Dynamic fault hazard strobes and animated operational indicators
 * - Depth-based centralized raycasting for seamless hover and selection
 */

import React, { useContext, useMemo, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { NodeLayout } from '../lib/layout';
import { resolveMaterial, isContainer } from '../lib/materials';
import { lookupMesh } from '../lib/meshRegistry';
import { MESH_COMPONENT_MAP } from './meshes';
import type { MeshProps } from './meshes';
import { HoverContext } from './HoverContext';
import { useSelection } from './SelectionContext';
import { useTwinVisual } from './TwinVisualContext';

// ─── Thermal False-Color Mapping Helper ───────────────────────────────────────

function getThermalColor(normVal: number): string {
  // 0.0 (Cold Blue) -> 0.35 (Cyan) -> 0.65 (Amber) -> 1.0 (Critical Radiant Red)
  if (normVal < 0.35) {
    const f = normVal / 0.35;
    return f > 0.5 ? '#06b6d4' : '#1e3a8a';
  } else if (normVal < 0.7) {
    const f = (normVal - 0.35) / 0.35;
    return f > 0.5 ? '#f59e0b' : '#10b981';
  } else {
    return '#ef4444';
  }
}

// ─── Emergency Hazard Strobe Beacon ───────────────────────────────────────────

function StrobeHazardBeacon({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    try {
      const strobe = Math.sin(state.clock.elapsedTime * 14) > 0;
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.15;
        const mat = meshRef.current.material as any;
        if (mat && !Array.isArray(mat) && mat.color && typeof mat.color.set === 'function') {
          mat.color.set(strobe ? '#ef4444' : '#7f1d1d');
        }
      }
      if (lightRef.current) {
        lightRef.current.intensity = strobe ? 2.5 : 0.2;
      }
    } catch (_) {
      // Guard against frame-time disposal or race conditions
    }
  });

  return (
    <group position={position}>
      {/* Base Collar */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.08, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Flashing Strobe Lens */}
      <mesh ref={meshRef} position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <pointLight ref={lightRef} color="#ef4444" distance={4} intensity={2} />
    </group>
  );
}

// ─── Polar Modular Station Pod (For 'block' containers) ───────────────────────

interface ModularPodProps {
  name: string;
  dims: { width: number; height: number; depth: number };
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  userData: Record<string, unknown>;
  isCutaway: boolean;
  explodedOffset: number;
  visualMode: 'realistic' | 'holographic' | 'thermal';
  thermalColor?: string;
  isStationOutermost: boolean;
  containerOcclusion?: 'off' | 'off_on_hover';
  isInteracting?: boolean;
}

const ModularPod: React.FC<ModularPodProps> = ({
  dims, color, metalness, roughness, opacity: _opacity, userData, isCutaway, explodedOffset, visualMode, thermalColor, isStationOutermost, containerOcclusion = 'off', isInteracting = false
}) => {
  const { width: w, height: h, depth: d } = dims;

  // Stilt elevation height for polar buildings
  const stiltH = 1.6;

  // Effective cutaway state: if containerOcclusion is 'off' (Translucent) or interacting (hover/selected/exploded), or holographic
  const effectiveCutaway = isCutaway || containerOcclusion === 'off' || isInteracting || visualMode === 'holographic';

  // Determine wall color & transparency based on visual mode and occlusion
  const wallColor = visualMode === 'thermal' ? (thermalColor || '#0284c7') : visualMode === 'holographic' ? '#0369a1' : color;
  const wallOpacity = visualMode === 'holographic' ? 0.18 : effectiveCutaway ? 0.22 : 0.98;
  const wallTransparent = effectiveCutaway;

  const edgeColor = visualMode === 'holographic' ? '#38bdf8' : '#0f172a';

  return (
    <group position={[0, (userData.yOffset as number ?? 0), 0]}>
      {/* ── 1. HITBOX MESH (Always covers entire volume for depth-based raycast) ── */}
      <mesh position={[0, h / 2, 0]} userData={userData}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 2. Heavy Hydraulic Elevation Stilts (Antarctic permafrost foundation) ── */}
      {isStationOutermost && (
        <group position={[0, 0, 0]}>
          {[
            [-w * 0.42, -d * 0.42],
            [w * 0.42, -d * 0.42],
            [-w * 0.42, d * 0.42],
            [w * 0.42, d * 0.42],
          ].map(([sx, sz], i) => (
            <group key={`stilt-${i}`} position={[sx, -stiltH / 2, sz]}>
              {/* Hydraulic Steel Pylon */}
              <mesh castShadow>
                <cylinderGeometry args={[0.14, 0.18, stiltH, 12]} />
                <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
              </mesh>
              {/* Massive Footing Pad on Ice */}
              <mesh position={[0, -stiltH / 2 + 0.08, 0]} receiveShadow>
                <cylinderGeometry args={[0.38, 0.45, 0.16, 16]} />
                <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.5} />
              </mesh>
              {/* Hydraulic Jack Ring */}
              <mesh position={[0, 0.2, 0]}>
                <torusGeometry args={[0.19, 0.03, 8, 16]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ── 3. Pod Base Plinth / Lower Chasis ── */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.98, 0.2, d * 0.98]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* ── 4. Main Insulated Polar Pod Wall Enclosure ── */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={wallColor}
          metalness={visualMode === 'holographic' ? 0.9 : metalness}
          roughness={roughness}
          opacity={wallOpacity}
          transparent={wallTransparent}
          depthWrite={!wallTransparent}
          side={THREE.DoubleSide}
        />
        <Edges scale={1} threshold={15} color={edgeColor} opacity={visualMode === 'holographic' ? 0.9 : 0.4} transparent />
      </mesh>

      {/* ── 5. Corner Structural Reinforced Columns ── */}
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([cx, cz], i) => (
        <mesh key={`col-${i}`} position={[cx, h / 2, cz]} castShadow>
          <boxGeometry args={[0.18, h, 0.18]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* ── 6. Polar Airlock Vestibule & Entry Door ── */}
      <group position={[0, h * 0.38, d / 2 + 0.08]}>
        {/* Airlock Frame */}
        <mesh castShadow>
          <boxGeometry args={[Math.min(1.4, w * 0.3), Math.min(2.0, h * 0.75), 0.15]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Door Surface */}
        <mesh position={[0, 0, 0.08]}>
          <planeGeometry args={[Math.min(1.2, w * 0.26), Math.min(1.8, h * 0.7)]} />
          <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Status Light above airlock */}
        <mesh position={[0, Math.min(2.0, h * 0.75) / 2 + 0.12, 0.08]}>
          <boxGeometry args={[0.15, 0.06, 0.06]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </group>

      {/* ── 7. Exploded View: Smoothly Lifting Roof Assembly ── */}
      <group position={[0, h + explodedOffset, 0]}>
        {/* Main Insulated Roof Slab */}
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[w * 1.02, 0.2, d * 1.02]} />
          <meshStandardMaterial
            color={wallColor}
            metalness={0.7}
            roughness={0.4}
            opacity={visualMode === 'holographic' ? 0.3 : effectiveCutaway ? 0.35 : 0.98}
            transparent={effectiveCutaway}
            depthWrite={!effectiveCutaway}
          />
          <Edges scale={1} threshold={15} color={edgeColor} opacity={0.6} transparent />
        </mesh>

        {/* Rooftop HVAC Vent Fan Box */}
        <group position={[-w * 0.25, 0.3, -d * 0.2]}>
          <mesh castShadow>
            <boxGeometry args={[Math.min(1.2, w * 0.25), 0.35, Math.min(1.2, d * 0.25)]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 16]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>

        {/* Rooftop Exhaust Flue / Antifreeze Pipe */}
        <group position={[w * 0.25, 0.4, -d * 0.2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <coneGeometry args={[0.14, 0.12, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.8} />
          </mesh>
        </group>

        {/* Rooftop Maintenance Access Hatch */}
        <mesh position={[0, 0.22, d * 0.25]} castShadow>
          <boxGeometry args={[0.6, 0.06, 0.6]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
};

// ─── Station Compound Perimeter (For 'station' container) ──────────────────────

interface StationCompoundProps {
  dims: { width: number; height: number; depth: number };
  userData: Record<string, unknown>;
  name: string;
}

const StationCompound: React.FC<StationCompoundProps> = ({ dims, userData }) => {
  const { width: w, height: h, depth: d } = dims;

  return (
    <group position={[0, (userData.yOffset as number ?? 0), 0]}>
      {/* Invisible Raycast Hitbox for station-level selection */}
      <mesh position={[0, h / 2, 0]} userData={userData}>
        <boxGeometry args={[w + 1.0, h, d + 1.0]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Station Compound Foundation Apron Curb */}
      <group position={[0, 0.02, 0]}>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[w + 2.0, 0.04, d + 2.0]} />
          <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.8} />
        </mesh>

        {/* Subtle Boundary Grid Wireframe */}
        <Edges scale={1} threshold={15} color="#38bdf8" opacity={0.25} transparent />
      </group>
    </group>
  );
};

// ─── Main TwinNodeRenderer Component ──────────────────────────────────────────

interface TwinNodeRendererProps {
  layout: NodeLayout;
  liveStateRef: React.MutableRefObject<Record<string, unknown>>;
  depth?: number;
  containerOcclusion?: 'off' | 'off_on_hover';
  hasNonCampusAncestor?: boolean;
  effectiveLayer?: number | null;
  buildLimit?: number;
}

export const TwinNodeRenderer: React.FC<TwinNodeRendererProps> = React.memo(({
  layout, liveStateRef, depth = 0, containerOcclusion = 'off', hasNonCampusAncestor = false, effectiveLayer = null, buildLimit = Infinity,
}) => {
  const { hoveredName, hoveredAssociated, selectedAssociated, hoveredAncestors, selectedAncestors, activeLayer, componentsInteractable } = useContext(HoverContext);
  const { selectedName, hiddenSet } = useSelection();
  const { visualMode, explodedFactor } = useTwinVisual();

  const hovered = hoveredName === layout.name;
  const isHoveredAssociated = hoveredAssociated.has(layout.name);
  const isSelectedAssociated = selectedAssociated.has(layout.name);
  const descendantHovered = hoveredAncestors?.has(layout.name) ?? false;
  const descendantSelected = selectedAncestors?.has(layout.name) ?? false;
  const selected = selectedName === layout.name;

  const [failed, setFailed] = useState(false);
  const [liveThermalValue, setLiveThermalValue] = useState(0.2);

  useFrame(() => {
    try {
      const state = liveStateRef.current?.[layout.name] as any;
      const s = (state?.status || '').toLowerCase();
      const isFailed = s === 'failure' || s === 'failed' || s === 'critical';
      if (isFailed !== failed) {
        setFailed(isFailed);
      }
      // Calculate simulated thermal load
      if (visualMode === 'thermal') {
        const val = state?.value ?? state?.temperature ?? state?.load;
        if (typeof val === 'number') {
          const norm = isFailed ? 1.0 : Math.min(Math.max((val - 15) / 50, 0.1), 0.95);
          if (Math.abs(norm - liveThermalValue) > 0.05) {
            setLiveThermalValue(norm);
          }
        } else if (isFailed && liveThermalValue !== 1.0) {
          setLiveThermalValue(1.0);
        }
      }
    } catch (_) {}
  });

  const mat = useMemo(
    () => resolveMaterial(layout.type, {
      hovered,
      hoveredAssociated: isHoveredAssociated,
      selected,
      selectedAssociated: isSelectedAssociated,
      failed
    }),
    [layout.type, hovered, isHoveredAssociated, selected, isSelectedAssociated, failed]
  );

  const container = isContainer(layout.type) && layout.children.length > 0;
  const meshKey = lookupMesh(layout.type);
  const MeshComp = (MESH_COMPONENT_MAP[meshKey] ?? MESH_COMPONENT_MAP['GenericMesh']) as React.FC<MeshProps>;

  const meshUserData = useMemo(
    () => ({ componentName: layout.name, depth, yOffset: layout.yOffset }),
    [layout.name, depth, layout.yOffset]
  );

  const isHidden = hiddenSet.has(layout.name);
  const isCampus = layout.type === 'campus';
  const isStation = layout.type === 'station';
  const isBlock = layout.type === 'block';
  const isOutermostNonCampus = !isCampus && !hasNonCampusAncestor;
  const nextHasNonCampusAncestor = hasNonCampusAncestor || !isCampus;

  const myEffectiveLayer = layout.type === 'floor' && typeof layout.level === 'number'
    ? layout.level
    : effectiveLayer;

  const isInteractive = activeLayer === null || myEffectiveLayer === null || activeLayer === myEffectiveLayer;

  // Determine interaction & cutaway states
  const isInteracting = explodedFactor > 0.05 || hovered || descendantHovered || descendantSelected || selected;
  const isCutaway = containerOcclusion === 'off' || isInteracting;

  const yOffset = layout.yOffset ?? 0;

  // Exploded lift for upper floors / roofs
  const floorLevel = typeof layout.level === 'number' ? layout.level : 0;
  const floorExplodedLift = floorLevel * explodedFactor * 3.5;
  const roofExplodedLift = isBlock ? explodedFactor * (layout.dims.height * 1.5 + 3.0) : 0;

  if (layout.buildIndex !== undefined && layout.buildIndex > buildLimit) {
    return null;
  }

  // Node position with vertical exploded lift
  const nodePosition: [number, number, number] = [
    layout.position[0],
    layout.position[1] + floorExplodedLift,
    layout.position[2],
  ];

  const thermalColor = visualMode === 'thermal' ? getThermalColor(liveThermalValue) : undefined;

  return (
    <group position={nodePosition} visible={!isHidden}>
      {isCampus ? (
        /* Campus Ground Perimeter */
        <mesh receiveShadow position={[0, yOffset, 0]} userData={isInteractive ? meshUserData : {}} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[layout.dims.width, layout.dims.depth]} />
          <meshStandardMaterial
            color={mat.color}
            metalness={mat.metalness}
            roughness={mat.roughness}
            opacity={0.12}
            transparent
            depthWrite={false}
          />
          <Edges scale={1} threshold={15} color="#38bdf8" opacity={0.3} transparent />
        </mesh>
      ) : isStation ? (
        /* Station Compound Perimeter & Base */
        <StationCompound dims={layout.dims} userData={isInteractive ? meshUserData : {}} name={layout.name} />
      ) : isBlock ? (
        /* Realistic Polar Modular Pod Architecture */
        <ModularPod
          name={layout.name}
          dims={layout.dims}
          color={mat.color}
          metalness={mat.metalness}
          roughness={mat.roughness}
          opacity={mat.opacity}
          userData={isInteractive ? meshUserData : {}}
          isCutaway={isCutaway}
          isInteracting={isInteracting}
          containerOcclusion={containerOcclusion}
          explodedOffset={roofExplodedLift}
          visualMode={visualMode}
          thermalColor={thermalColor}
          isStationOutermost={isOutermostNonCampus}
        />
      ) : container ? (
        /* Generic / Floor / System Container */
        <group position={[0, layout.dims.height / 2 + yOffset, 0]}>
          <mesh userData={isInteractive ? meshUserData : {}}>
            <boxGeometry args={[layout.dims.width, layout.dims.height, layout.dims.depth]} />
            <meshStandardMaterial
              color={thermalColor || mat.color}
              metalness={mat.metalness}
              roughness={mat.roughness}
              opacity={isCutaway ? 0.22 : 0.95}
              transparent={isCutaway || visualMode === 'holographic'}
              depthWrite={!isCutaway && visualMode !== 'holographic'}
              side={THREE.DoubleSide}
            />
            <Edges scale={1} threshold={15} color="#38bdf8" opacity={0.4} transparent />
          </mesh>
        </group>
      ) : (
        /* Leaf Machinery / Equipment */
        <>
          {/* Raycast Target Hitbox */}
          <mesh
            position={[0, layout.dims.height / 2 + yOffset, 0]}
            userData={isInteractive ? meshUserData : {}}
          >
            <boxGeometry args={[layout.dims.width, layout.dims.height, layout.dims.depth]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>

          {/* High-Fidelity 3D Visual Mesh Component */}
          <group position={[0, yOffset, 0]}>
            <MeshComp
              dims={layout.dims}
              color={thermalColor || mat.color}
              metalness={mat.metalness}
              roughness={mat.roughness}
              opacity={mat.opacity}
              transparent={mat.transparent}
            />

            {/* Active Emergency Strobe Beacon when Failed */}
            {failed && (
              <StrobeHazardBeacon position={[0, layout.dims.height + 0.05, 0]} />
            )}
          </group>
        </>
      )}

      {/* Selection / Hover Glowing Bounding Bracket */}
      {(selected || hovered) && (
        <mesh position={[0, layout.dims.height / 2 + yOffset, 0]}>
          <boxGeometry args={[layout.dims.width + 0.08, layout.dims.height + 0.08, layout.dims.depth + 0.08]} />
          <meshBasicMaterial color={selected ? '#facc15' : '#fef08a'} transparent opacity={0} depthWrite={false} />
          <Edges scale={1} threshold={1} color={selected ? '#facc15' : '#fef08a'} />
        </mesh>
      )}

      {/* Suspended Pylon Beams for Multi-Story Floors */}
      {layout.type === 'floor' && typeof layout.level === 'number' && layout.level > 0 && !isHidden && (
        <group position={[0, yOffset, 0]}>
          {[
            [-layout.dims.width / 2 + 0.2, -layout.dims.depth / 2 + 0.2],
            [layout.dims.width / 2 - 0.2, -layout.dims.depth / 2 + 0.2],
            [-layout.dims.width / 2 + 0.2, layout.dims.depth / 2 - 0.2],
            [layout.dims.width / 2 - 0.2, layout.dims.depth / 2 - 0.2],
          ].map(([bx, bz], i) => (
            <mesh key={`pylon-${i}`} position={[bx, -1.5, bz]}>
              <cylinderGeometry args={[0.12, 0.12, 3.0, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      )}

      {/* Recursively Render Child Nodes */}
      {layout.children.map((child) => (
        <TwinNodeRenderer
          key={child.name}
          layout={child}
          liveStateRef={liveStateRef}
          depth={depth + 1}
          containerOcclusion={containerOcclusion}
          hasNonCampusAncestor={nextHasNonCampusAncestor}
          effectiveLayer={myEffectiveLayer}
          buildLimit={buildLimit}
        />
      ))}
    </group>
  );
});
