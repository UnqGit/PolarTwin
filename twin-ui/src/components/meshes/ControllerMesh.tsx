/**
 * ControllerMesh.tsx
 *
 * Panel-style controller box with a glowing screen inset on the front face.
 * Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const ControllerMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  return (
    <group>
      {/* Main panel body */}
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
      {/* Glowing display screen — inset on the front face */}
      <mesh position={[0, h * 0.65, -d / 2 - 0.005]}>
        <boxGeometry args={[w * 0.70, h * 0.40, 0.01]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive="#1e3a5f"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};
