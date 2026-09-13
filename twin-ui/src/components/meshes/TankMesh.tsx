/**
 * TankMesh.tsx
 *
 * Vertical cylindrical tank scaled to dims.
 * Radius = min(width, depth) / 2.  Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const TankMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const radius = Math.min(w, d) / 2;
  return (
    <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
      <cylinderGeometry args={[radius, radius, h, 24]} />
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
