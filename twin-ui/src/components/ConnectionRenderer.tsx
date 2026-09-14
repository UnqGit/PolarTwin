import React, { useMemo, useContext } from 'react';
import * as THREE from 'three';

import type { ConnectionLayout, NodeLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';
import { HoverContext } from './HoverContext';

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

// ─── unified connection geometry ──────────────────────────────────────────────

interface UnifiedConnectionProps {
  connection: ConnectionLayout;
}

const UnifiedConnection: React.FC<UnifiedConnectionProps> = ({ connection }) => {
  const { hoveredName } = useContext(HoverContext);
  const { selectedName, hiddenSet } = useSelection();
  
  const hovered = hoveredName === connection.id;
  const selected = selectedName === connection.id;
  const isHidden = hiddenSet.has(connection.id);

  const path = connection.path;
  const profile = connection.profile;
  const beamWidth = profile.width;
  const beamThickness = profile.height as number;

  const { segments, capSize } = useMemo(() => {
    return {
      segments: buildSegments(path),
      capSize: beamWidth,
    };
  }, [path, beamWidth]);

  const color = profile.color ?? '#6b7280';
  const hoverColor = '#fde047'; // yellow for hover
  const selectedColor = '#f59e0b'; // amber for selected
  const matColor = selected ? selectedColor : hovered ? hoverColor : color;
  
  // To ensure hovered/selected connections are clearly visible even when overlapping:
  // 1. Draw them last (higher renderOrder)
  // 2. Disable depthTest so they draw over everything
  // 3. Make them slightly thicker
  const renderOrd = hovered || selected ? 10 : 0;
  const isHighlighted = hovered || selected;
  const type = (connection.connectionType || '').toLowerCase();
  const expandWidth = type !== 'road';
  const expandHeight = type !== 'hallway';
  
  const currentBeamWidth = isHighlighted && expandWidth ? beamWidth * 1.6 : beamWidth;
  const currentBeamThickness = isHighlighted && expandHeight ? beamThickness * 1.6 : beamThickness;
  const currentCapSize = isHighlighted && expandWidth ? capSize * 1.6 : capSize;

  // Add userData to participate in TwinViewer's global HoverManager raycast loop
  const userData = useMemo(() => ({ componentName: connection.id, depth: 999, isConnection: true }), [connection.id]);

  return (
    <group visible={!isHidden}>
      {/* One box per path segment */}
      {segments.map((seg, i) => (
        <group key={`seg-${i}`} position={seg.midPos.toArray() as [number, number, number]} quaternion={seg.quaternion}>
          {/* HITBOX MESH: Constant size, invisible to eye, contains userData */}
          <mesh userData={userData}>
            <boxGeometry args={[beamWidth, beamThickness, seg.length]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} color="#ff0000" />
          </mesh>
          {/* VISUAL MESH: Scales up on hover, ignored by raycaster (no userData) */}
          <mesh renderOrder={renderOrd}>
            <boxGeometry args={[currentBeamWidth, currentBeamThickness, seg.length]} />
            <meshStandardMaterial
              color={matColor}
              metalness={0.05}
              roughness={0.95}
              transparent
              opacity={isHighlighted ? 1 : 0.88}
              depthWrite={false}
              depthTest={!isHighlighted}
            />
          </mesh>
        </group>
      ))}

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
              metalness={0.05}
              roughness={0.95}
              transparent
              opacity={isHighlighted ? 1 : 0.88}
              depthWrite={false}
              depthTest={!isHighlighted}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export interface ConnectionRendererProps {
  connections: ConnectionLayout[];
  root: NodeLayout;
}

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({ connections, root }) => {
  const { hiddenSet } = useSelection();
  
  const hiddenAndDescendants = useMemo(() => {
    const set = new Set<string>();
    const traverse = (node: NodeLayout, implicitlyHidden: boolean) => {
      const isHidden = implicitlyHidden || hiddenSet.has(node.name);
      if (isHidden) {
        set.add(node.name);
      }
      node.children.forEach(c => traverse(c, isHidden));
    };
    traverse(root, false);
    return set;
  }, [root, hiddenSet]);

  const visibleConnections = useMemo(() => {
    return connections.filter(c => !hiddenAndDescendants.has(c.source) && !hiddenAndDescendants.has(c.target));
  }, [connections, hiddenAndDescendants]);

  return (
    <group name="ConnectionRendererGroup">
      {visibleConnections.map((conn) => (
        <UnifiedConnection key={conn.id} connection={conn} />
      ))}
    </group>
  );
};
