/**
 * SensorMesh.tsx
 *
 * Small device-box for sensors, thermometers, alarms, toggles, and similar
 * embedded measurement components.
 *
 * Adds a small glowing indicator sphere on top to make sensors visually
 * distinct from plain boxes.  Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const SensorMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const indicatorR = w * 0.12;
  return (
    <group>
      {/* Main body */}
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
      {/* Status indicator light on top */}
      <mesh position={[0, h + indicatorR, 0]}>
        <sphereGeometry args={[indicatorR, 8, 8]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.7}
        />
      </mesh>
    </group>
  );
};
