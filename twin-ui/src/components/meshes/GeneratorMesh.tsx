/**
 * GeneratorMesh.tsx
 *
 * Procedural generator geometry:
 *   - Main body box (70 % of total height)
 *   - Cylindrical exhaust stack on top-right
 *   - Small control-panel inset on the front face
 *
 * All geometry places its bottom at local Y = 0.
 * Dimensions are driven entirely by the resolved { width, height, depth } dims.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const GeneratorMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness,
}) => {
  const { width: w, height: h, depth: d } = dims;

  const bodyH  = h * 0.7;
  const stackR = Math.min(w, d) * 0.08;
  const stackH = h * 0.55;
  const stackX = w * 0.35;
  const panelW = w * 0.30;
  const panelH = h * 0.40;

  return (
    <group>
      {/* Main body — bottom at Y = 0, centre at Y = bodyH / 2 */}
      <mesh castShadow receiveShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      </mesh>

      {/* Exhaust stack — sits on top of the body */}
      <mesh castShadow position={[stackX, bodyH + stackH / 2, 0]}>
        <cylinderGeometry args={[stackR, stackR * 1.2, stackH, 12]} />
        <meshStandardMaterial
          color={color}
          metalness={Math.min(metalness + 0.1, 1)}
          roughness={Math.max(roughness - 0.1, 0)}
        />
      </mesh>

      {/* Control panel — inset on the front face, centred at mid-body height */}
      <mesh position={[0, bodyH * 0.5, -d / 2 - 0.01]}>
        <boxGeometry args={[panelW, panelH, 0.05]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.1} roughness={0.9} />
      </mesh>
    </group>
  );
};
