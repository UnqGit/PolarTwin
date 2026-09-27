/**
 * TankMesh.tsx
 *
 * Detailed industrial tank with base supports, domed top, and access hatch.
 * Scaled to fit within dims. Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const TankMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  // Radius of the main cylinder
  const radius = Math.min(w, d) / 2 * 0.9;
  const legHeight = h * 0.15;
  const bodyHeight = h * 0.75;
  const domeHeight = h * 0.1;

  return (
    <group>
      {/* 4 Support Legs */}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * radius * 0.7, legHeight / 2, z * radius * 0.7]} castShadow>
            <cylinderGeometry args={[radius * 0.1, radius * 0.15, legHeight, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
          </mesh>
        ))
      )}

      {/* Main Tank Body */}
      <mesh position={[0, legHeight + bodyHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, bodyHeight, 32]} />
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Top Dome */}
      <mesh position={[0, legHeight + bodyHeight, 0]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Bottom Dome */}
      <mesh position={[0, legHeight, 0]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Top Access Hatch */}
      <mesh position={[0, h - domeHeight * 0.1, radius * 0.3]} castShadow>
        <cylinderGeometry args={[radius * 0.25, radius * 0.25, radius * 0.1, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Side Pipe / Gauge */}
      <group position={[radius, legHeight + bodyHeight * 0.3, 0]}>
        <mesh position={[radius * 0.1, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[radius * 0.08, radius * 0.08, radius * 0.2, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[radius * 0.2, radius * 0.1, 0]} castShadow>
          <boxGeometry args={[radius * 0.2, radius * 0.3, radius * 0.2]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[radius * 0.3, radius * 0.1, 0]} rotation={[0, 0, -Math.PI/2]} castShadow>
           <cylinderGeometry args={[radius * 0.08, radius * 0.08, 0.05, 16]} />
           <meshStandardMaterial color="var(--accent-cyan)" emissive="var(--accent-cyan)" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  );
};
