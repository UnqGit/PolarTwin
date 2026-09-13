/**
 * BatteryMesh.tsx
 *
 * Tall box (battery body) with two cylindrical terminals on top.
 * Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const BatteryMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const termR = w * 0.12;
  const termH = h * 0.08;

  return (
    <group>
      {/* Battery body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {/* Positive terminal (wider) */}
      <mesh position={[w * 0.2, h + termH / 2, 0]}>
        <cylinderGeometry args={[termR, termR, termH, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Negative terminal (narrower) */}
      <mesh position={[-w * 0.2, h + termH / 2, 0]}>
        <cylinderGeometry args={[termR * 0.8, termR * 0.8, termH, 12]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
};
