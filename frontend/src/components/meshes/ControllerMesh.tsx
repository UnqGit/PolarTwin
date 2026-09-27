/**
 * ControllerMesh.tsx
 *
 * Detailed electrical cabinet / control panel style mesh.
 * Features a glowing touch screen, physical buttons, vent grill, and a handle.
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
      {/* Main Cabinet Body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Screen Bezel */}
      <mesh position={[0, h * 0.7, d / 2 + 0.01]} castShadow>
        <boxGeometry args={[w * 0.7, h * 0.35, 0.02]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Glowing Touch Screen */}
      <mesh position={[0, h * 0.7, d / 2 + 0.02]}>
        <boxGeometry args={[w * 0.65, h * 0.3, 0.01]} />
        <meshStandardMaterial color="var(--bg-main)" emissive="var(--accent-cyan)" emissiveIntensity={0.6} />
      </mesh>

      {/* Physical Buttons (Emergency Stop and Start) */}
      <group position={[0, h * 0.45, d / 2 + 0.01]}>
        {/* Red E-Stop */}
        <mesh position={[w * 0.2, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[w * 0.06, w * 0.06, 0.04, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.5} />
        </mesh>
        {/* Green Start */}
        <mesh position={[w * 0.05, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[w * 0.05, w * 0.05, 0.03, 16]} />
          <meshStandardMaterial color="#10b981" roughness={0.5} />
        </mesh>
      </group>

      {/* Cabinet Handle */}
      <group position={[w * 0.4, h * 0.5, d / 2 + 0.02]} castShadow>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.02, h * 0.2, 0.04]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Lower Ventilation Grill */}
      <group position={[0, h * 0.15, d / 2 + 0.01]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`vent-${i}`} position={[0, (i - 2) * (h * 0.04), 0]}>
            <boxGeometry args={[w * 0.6, h * 0.015, 0.01]} />
            <meshStandardMaterial color="#020617" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
