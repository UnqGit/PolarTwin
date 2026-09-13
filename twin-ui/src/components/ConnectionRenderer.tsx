import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { Html, Text } from '@react-three/drei';
import type { ConnectionLayout } from '../lib/layout';

// ─── path utilities ───────────────────────────────────────────────────────────

/** Compute the midpoint of a multi-segment path for tooltip placement. */
function pathMidpoint(path: [number, number, number][]): [number, number, number] {
  if (path.length === 0) return [0, 0, 0];
  if (path.length === 1) return path[0];
  // Compute total length and find the halfway point.
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1][0] - path[i][0];
    const dy = path[i + 1][1] - path[i][1];
    const dz = path[i + 1][2] - path[i][2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    segLens.push(len);
    totalLen += len;
  }
  let target = totalLen / 2;
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i]) {
      const t = segLens[i] > 0 ? target / segLens[i] : 0;
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * t,
        path[i][1] + (path[i + 1][1] - path[i][1]) * t,
        path[i][2] + (path[i + 1][2] - path[i][2]) * t,
      ];
    }
    target -= segLens[i];
  }
  return path[path.length - 1];
}

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

// ─── shared tooltip ───────────────────────────────────────────────────────────

interface TooltipProps {
  connection: ConnectionLayout;
  accentColor: string;
  midPos: [number, number, number];
}

const ConnectionTooltip: React.FC<TooltipProps> = ({
  connection, accentColor, midPos,
}) => (
  <Html
    position={[midPos[0], midPos[1] + 1.0, midPos[2]]}
    center
    style={{ pointerEvents: 'none' }}
  >
    <div style={{
      background: 'rgba(10,12,20,0.94)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${accentColor}55`,
      borderRadius: 7,
      padding: '7px 12px',
      color: '#f1f5f9',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 11,
      whiteSpace: 'nowrap',
      boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight: 700, color: accentColor, marginBottom: 3 }}>
        {connection.connectionType} connection
      </div>
      <div style={{ color: '#cbd5e1' }}>
        {connection.source}{' '}
        <span style={{ color: '#475569' }}>{connection.direction}</span>{' '}
        {connection.target}
      </div>
    </div>
  </Html>
);

// ─── unified connection geometry ──────────────────────────────────────────────

interface UnifiedConnectionProps {
  connection: ConnectionLayout;
}

const UnifiedConnection: React.FC<UnifiedConnectionProps> = ({ connection }) => {
  const [hovered, setHovered] = useState(false);
  const path = connection.path;
  const profile = connection.profile;
  const beamWidth = profile.width;
  const beamThickness = profile.height as number;

  const { segments, mid, capSize } = useMemo(() => {
    return {
      segments: buildSegments(path),
      mid: pathMidpoint(path),
      capSize: beamWidth,
    };
  }, [path, beamWidth]);

  const color = profile.color ?? '#6b7280';
  const hoverColor = '#93c5fd';
  const matColor = hovered ? hoverColor : color;

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e)  => { e.stopPropagation(); setHovered(false); }}
    >
      {/* One box per path segment */}
      {segments.map((seg, i) => (
        <mesh
          key={`seg-${i}`}
          position={seg.midPos.toArray() as [number, number, number]}
          quaternion={seg.quaternion}
        >
          <boxGeometry args={[beamWidth, beamThickness, seg.length]} />
          <meshStandardMaterial
            color={matColor}
            metalness={0.05}
            roughness={0.95}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Square corner joints at every bend point to eliminate gaps */}
      {path.slice(1, -1).map((pt, i) => (
        <mesh
          key={`joint-${i}`}
          position={pt}
        >
          <boxGeometry args={[capSize, beamThickness, capSize]} />
          <meshStandardMaterial
            color={matColor}
            metalness={0.05}
            roughness={0.95}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 3D Label attached to the geometry */}
      <Text
        position={[mid[0], mid[1] + (beamThickness / 2) + 0.05, mid[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={Math.max(0.2, beamWidth * 0.4)}
        color={hovered ? '#ffffff' : '#e2e8f0'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {connection.connectionType}
      </Text>

      {hovered && (
        <ConnectionTooltip
          connection={connection}
          accentColor={hoverColor}
          midPos={mid}
        />
      )}
    </group>
  );
};

// ─── public component ─────────────────────────────────────────────────────────

export interface ConnectionRendererProps {
  connections: ConnectionLayout[];
}

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({ connections }) => (
  <>
    {connections.map((conn) => (
      <UnifiedConnection key={conn.id} connection={conn} />
    ))}
  </>
);
