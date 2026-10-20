import React, { useMemo, useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { ConnectionLayout, NodeLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';
import { HoverContext } from './HoverContext';
import { useTwinVisual } from './TwinVisualContext';

/** Build per-segment geometry data for beam connections. */
interface SegmentData {
  midPos: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
}

function buildSegments(path: [number, number, number][]): SegmentData[] {
  const segs: SegmentData[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const s = new THREE.Vector3(...path[i]);
    const e = new THREE.Vector3(...path[i + 1]);
    const dir = e.clone().sub(s);
    const len = dir.length();
    if (len < 0.001) continue;
    const mid = s.clone().lerp(e, 0.5);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
    segs.push({ midPos: mid, quaternion: q, length: len });
  }
  return segs;
}

/* ── Animated Flow Particle Bead ─────────────────────────────── */
interface FlowParticleProps {
  path: [number, number, number][];
  totalLength: number;
  color: string;
  isHighlighted: boolean;
  speed?: number;
}

const FlowParticle: React.FC<FlowParticleProps> = ({
  path,
  totalLength,
  color,
  isHighlighted,
  speed = 2.5,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current || totalLength < 0.1 || path.length < 2) return;
    const currentDist = (state.clock.elapsedTime * speed) % totalLength;

    // Find segment corresponding to currentDist
    let accumulated = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const s = new THREE.Vector3(...path[i]);
      const e = new THREE.Vector3(...path[i + 1]);
      const segLen = s.distanceTo(e);
      if (accumulated + segLen >= currentDist) {
        const factor = (currentDist - accumulated) / segLen;
        const pos = s.clone().lerp(e, factor);
        meshRef.current.position.set(pos.x, pos.y + 0.08, pos.z);
        break;
      }
      accumulated += segLen;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[isHighlighted ? 0.08 : 0.05, 8, 8]} />
      <meshBasicMaterial color={isHighlighted ? '#fde047' : color} />
    </mesh>
  );
};

// ─── unified connection geometry ──────────────────────────────────────────────

interface UnifiedConnectionProps {
  connection: ConnectionLayout;
}

const UnifiedConnection: React.FC<UnifiedConnectionProps> = ({ connection }) => {
  const { hoveredName, hoveredAssociated, selectedAssociated } = useContext(HoverContext);
  const { selectedName, hiddenSet } = useSelection();
  const { flowAnimationEnabled } = useTwinVisual();

  const hovered = hoveredName === connection.id;
  const isHoveredAssociated = hoveredAssociated.has(connection.id);
  const selected = selectedName === connection.id;
  const isSelectedAssociated = selectedAssociated.has(connection.id);
  const isHidden = hiddenSet.has(connection.id);

  const path = connection.path;
  const profile = connection.profile;
  let beamWidth = profile.width;
  let beamThickness = profile.height as number;
  if ((connection as any).isBus) {
    beamWidth *= 1.8;
    beamThickness *= 1.8;
  }

  const { segments, capSize, totalLength } = useMemo(() => {
    let len = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const s = new THREE.Vector3(...path[i]);
      const e = new THREE.Vector3(...path[i + 1]);
      len += s.distanceTo(e);
    }
    return {
      segments: buildSegments(path),
      capSize: beamWidth,
      totalLength: len,
    };
  }, [path, beamWidth]);

  const rawType = (connection.connectionType || '').toLowerCase();
  const isPassageway = rawType === 'passageway';

  // Enhanced vibrant connection palette
  let color = profile.color ?? '#64748b';
  if (rawType.includes('power')) color = '#ef4444';
  else if (rawType.includes('resource') || rawType.includes('fuel') || rawType.includes('water')) color = '#10b981';
  else if (rawType.includes('data')) color = '#0284c7';
  else if (rawType.includes('signal')) color = '#eab308';
  else if (isPassageway) color = '#475569';

  let matColor = color;
  if (selected) matColor = '#facc15'; // Golden
  else if (isSelectedAssociated) matColor = '#fde047'; // Paler golden
  else if (hovered) matColor = '#fef08a'; // Yellow
  else if (isHoveredAssociated) matColor = '#fef9c3'; // Paler yellow

  const isHighlighted = hovered || selected || isHoveredAssociated || isSelectedAssociated;
  const renderOrd = isHighlighted ? 10 : 0;
  const expandWidth = !isPassageway;
  const expandHeight = !isPassageway;

  const currentBeamWidth = isHighlighted && expandWidth ? beamWidth * 1.6 : beamWidth;
  const currentBeamThickness = isHighlighted && expandHeight ? beamThickness * 1.6 : beamThickness;
  const currentCapSize = isHighlighted && expandWidth ? capSize * 1.6 : capSize;

  // Add userData to participate in TwinViewer's global HoverManager raycast loop
  const userData = useMemo(
    () => ({ componentName: connection.id, depth: 999, isConnection: true }),
    [connection.id]
  );

  return (
    <group visible={!isHidden}>
      {/* One segment per path span */}
      {segments.map((seg, i) => {
        return (
          <group
            key={`seg-${i}`}
            position={seg.midPos.toArray() as [number, number, number]}
            quaternion={seg.quaternion}
          >
            {/* HITBOX MESH: Constant size, invisible to eye, contains userData */}
            <mesh userData={userData}>
              <boxGeometry args={[beamWidth, beamThickness, seg.length]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ff0000" />
            </mesh>

            {/* VISUAL MESH: Arctic Passageway Tubular Walkway vs Industrial Utility Conduit */}
            {isPassageway ? (
              <group renderOrder={renderOrd}>
                {/* Elevated Tubular Corridor */}
                <mesh position={[0, currentBeamThickness / 2, 0]}>
                  <boxGeometry args={[currentBeamWidth, currentBeamThickness, seg.length]} />
                  <meshStandardMaterial
                    color={matColor}
                    metalness={0.7}
                    roughness={0.3}
                    transparent
                    opacity={isHighlighted ? 1 : 0.9}
                  />
                </mesh>
                {/* Illuminated Observation Windows along the Corridor */}
                {Array.from({ length: Math.max(1, Math.floor(seg.length / 2)) }).map((_, wi) => (
                  <mesh
                    key={`win-${wi}`}
                    position={[
                      currentBeamWidth / 2 + 0.01,
                      currentBeamThickness * 0.6,
                      (wi - Math.floor(seg.length / 4)) * 1.5,
                    ]}
                  >
                    <planeGeometry args={[0.01, 0.25]} />
                    <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
                  </mesh>
                ))}
              </group>
            ) : (
              /* Standard High-Tech Pipe / Conduit Beam */
              <mesh renderOrder={renderOrd}>
                <boxGeometry args={[currentBeamWidth, currentBeamThickness, seg.length]} />
                <meshStandardMaterial
                  color={matColor}
                  metalness={0.4}
                  roughness={0.5}
                  emissive={isHighlighted ? matColor : '#000000'}
                  emissiveIntensity={isHighlighted ? 0.35 : 0}
                  transparent
                  opacity={isHighlighted ? 1 : 0.92}
                  depthWrite={false}
                  depthTest={!isHighlighted}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Square corner joints at every bend point to eliminate gaps */}
      {path.slice(1, -1).map((pt, i) => (
        <group key={`joint-${i}`} position={pt}>
          {/* HITBOX MESH */}
          <mesh userData={userData}>
            <boxGeometry args={[capSize, beamThickness, capSize]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ff0000" />
          </mesh>
          {/* VISUAL MESH */}
          <mesh renderOrder={renderOrd}>
            <boxGeometry args={[currentCapSize, currentBeamThickness, currentCapSize]} />
            <meshStandardMaterial
              color={matColor}
              metalness={0.4}
              roughness={0.5}
              emissive={isHighlighted ? matColor : '#000000'}
              emissiveIntensity={isHighlighted ? 0.35 : 0}
              transparent
              opacity={isHighlighted ? 1 : 0.92}
              depthWrite={false}
              depthTest={!isHighlighted}
            />
          </mesh>
        </group>
      ))}

      {/* Dynamic Animated Telemetry Flow Pulse */}
      {flowAnimationEnabled && !isPassageway && totalLength > 0.5 && (
        <FlowParticle
          path={path}
          totalLength={totalLength}
          color={color}
          isHighlighted={isHighlighted}
          speed={rawType.includes('power') ? 3.5 : 2.0}
        />
      )}
    </group>
  );
};

export interface ConnectionRendererProps {
  connections: ConnectionLayout[];
  root: NodeLayout;
}

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = React.memo(
  ({ connections, root }) => {
    const { hiddenSet } = useSelection();

    const hiddenAndDescendants = useMemo(() => {
      const set = new Set<string>();
      const traverse = (node: NodeLayout, implicitlyHidden: boolean) => {
        const isHidden = implicitlyHidden || hiddenSet.has(node.name);
        if (isHidden) {
          set.add(node.name);
        }
        node.children.forEach((c) => traverse(c, isHidden));
      };
      traverse(root, false);
      return set;
    }, [root, hiddenSet]);

    const visibleConnections = useMemo(() => {
      return connections.filter(
        (c) => !hiddenAndDescendants.has(c.source) && !hiddenAndDescendants.has(c.target)
      );
    }, [connections, hiddenAndDescendants]);

    return (
      <group name="ConnectionRendererGroup">
        {visibleConnections.map((conn) => (
          <UnifiedConnection key={conn.id} connection={conn} />
        ))}
      </group>
    );
  }
);
