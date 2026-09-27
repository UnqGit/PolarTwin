/**
 * PumpMesh.tsx
 *
 * Detailed industrial pump with a motor housing, cooling fins, volute, and flanges.
 * Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const PumpMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  
  // Scale everything relative to the dimensions
  const scale = Math.min(w, h, d);
  const motorRadius = scale * 0.25;
  const motorLength = w * 0.5;
  const voluteRadius = scale * 0.4;
  const voluteWidth = w * 0.25;
  const baseHeight = h * 0.1;
  const baseWidth = w * 0.9;
  const baseDepth = d * 0.6;
  const centreY = baseHeight + voluteRadius;

  return (
    <group>
      {/* Base Plate */}
      <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.7} />
      </mesh>

      {/* Motor Housing (Horizontal Cylinder) */}
      <mesh position={[-w * 0.15, centreY, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[motorRadius, motorRadius, motorLength, 24]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Cooling Fins on Motor */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={`fin-${i}`} position={[-w * 0.15 - motorLength/2 + motorLength * 0.15 + (i * motorLength * 0.1), centreY, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[motorRadius * 1.15, motorRadius * 1.15, motorLength * 0.03, 24]} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness - 0.2} opacity={opacity} transparent={transparent} />
        </mesh>
      ))}

      {/* Pump Volute (Casing) */}
      <mesh position={[w * 0.2, centreY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[voluteRadius, voluteRadius, voluteWidth, 32]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Top Outlet Flange */}
      <mesh position={[w * 0.2, centreY + voluteRadius + h * 0.05, 0]} castShadow>
        <cylinderGeometry args={[motorRadius * 0.6, motorRadius * 0.6, h * 0.1, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[w * 0.2, centreY + voluteRadius + h * 0.1, 0]} castShadow>
        <cylinderGeometry args={[motorRadius * 0.8, motorRadius * 0.8, h * 0.02, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Front Inlet Flange */}
      <mesh position={[w * 0.2, centreY, voluteWidth / 2 + d * 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[motorRadius * 0.6, motorRadius * 0.6, d * 0.1, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[w * 0.2, centreY, voluteWidth / 2 + d * 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[motorRadius * 0.8, motorRadius * 0.8, d * 0.02, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Connecting Shaft Housing */}
      <mesh position={[w * 0.05, centreY, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[motorRadius * 0.5, motorRadius * 0.5, w * 0.1, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.5} />
      </mesh>
    </group>
  );
};
