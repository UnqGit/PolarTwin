/**
 * GenericMesh.tsx
 *
 * Fallback mesh for any component type that has no specialised mesh registered.
 * Simple box scaled to the resolved dimensions.  Bottom at local Y = 0.
 *
 * Also exports the shared MeshProps interface used by all mesh components.
 */

import React from 'react';
import type { Dims } from '../../lib/layout';

/** Shared prop interface for every mesh component in the registry. */
export interface MeshProps {
  dims: Dims;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
}

/**
 * Generic fallback mesh — plain box with correct dimensions.
 * Bottom sits at local Y = 0 (mesh centre at Y = height/2).
 */
export const GenericMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  return (
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
  );
};
