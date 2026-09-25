/**
 * PumpMesh.tsx
 *
 * Sphere-style mesh for pumps, motors, and similar rotating machinery.
 * Radius = min(width, height, depth) / 2.
 * Sphere centre at local Y = radius so bottom touches Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const PumpMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const radius = Math.min(w, h, d) / 2;
  return (
    <mesh castShadow receiveShadow position={[0, radius, 0]}>
      <sphereGeometry args={[radius, 20, 20]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        opacity={opacity}
        transparent={transparent}
      />
    </mesh>
  );
};
