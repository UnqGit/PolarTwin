/**
 * TankMesh.tsx
 *
 * Detailed industrial tank with base supports, domed top, access hatch,
 * ribbed support rings, and a ladder to give it a premium industrial look.
 * Scaled to fit within dims. Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const TankMesh: React.FC<MeshProps> = ({
  dims, color, metalness = 0.8, roughness = 0.2, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  // Radius of the main cylinder
  const radius = Math.min(w, d) / 2 * 0.85;
  const legHeight = h * 0.15;
  const bodyHeight = h * 0.70;
  const domeHeight = h * 0.15;

  return (
    <group>
      {/* 4 Support Legs */}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`leg-${x}-${z}`} position={[x * radius * 0.7, legHeight / 2, z * radius * 0.7]} castShadow>
            <cylinderGeometry args={[radius * 0.12, radius * 0.18, legHeight, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
          </mesh>
        ))
      )}

      {/* Main Tank Body */}
      <mesh position={[0, legHeight + bodyHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, bodyHeight, 48]} />
        <meshStandardMaterial
          color={color || "#64748b"}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Outer Support Rings (Ribbing) */}
      {[-0.3, 0, 0.3].map((yOffset) => (
        <mesh key={`ring-${yOffset}`} position={[0, legHeight + bodyHeight / 2 + bodyHeight * yOffset, 0]} castShadow>
          <torusGeometry args={[radius * 1.01, radius * 0.04, 16, 48]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Top Dome */}
      <mesh position={[0, legHeight + bodyHeight, 0]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={color || "#64748b"}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Bottom Dome */}
      <mesh position={[0, legHeight, 0]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial
          color={color || "#64748b"}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Top Access Hatch & Railing */}
      <group position={[0, legHeight + bodyHeight + radius * 0.7, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[radius * 0.3, radius * 0.35, radius * 0.15, 24]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Hatch Lid */}
        <mesh position={[0, radius * 0.08, 0]} castShadow>
          <cylinderGeometry args={[radius * 0.32, radius * 0.32, radius * 0.04, 24]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Inner glow (indicating active substance) */}
        <mesh position={[0, radius * 0.09, 0]}>
          <cylinderGeometry args={[radius * 0.15, radius * 0.15, 0.02, 16]} />
          <meshStandardMaterial color="var(--accent-cyan)" emissive="var(--accent-cyan)" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Side Ladder */}
      <group position={[radius * 1.05, legHeight + bodyHeight / 2, 0]}>
        {/* Left rail */}
        <mesh position={[0, 0, -radius * 0.15]} castShadow>
          <cylinderGeometry args={[radius * 0.03, radius * 0.03, bodyHeight * 0.9, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Right rail */}
        <mesh position={[0, 0, radius * 0.15]} castShadow>
          <cylinderGeometry args={[radius * 0.03, radius * 0.03, bodyHeight * 0.9, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Rungs */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`rung-${i}`} position={[0, (i - 3.5) * (bodyHeight * 0.11), 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[radius * 0.02, radius * 0.02, radius * 0.3, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Modern Control Panel on side */}
      <group position={[0, legHeight + bodyHeight * 0.4, radius * 1.02]}>
        <mesh castShadow>
          <boxGeometry args={[radius * 0.5, radius * 0.6, radius * 0.1]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, radius * 0.1, radius * 0.06]} castShadow>
          <boxGeometry args={[radius * 0.35, radius * 0.25, 0.02]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* Screen Glow */}
        <mesh position={[0, radius * 0.1, radius * 0.07]}>
          <planeGeometry args={[radius * 0.3, radius * 0.2]} />
          <meshBasicMaterial color="var(--accent-cyan)" opacity={0.6} transparent />
        </mesh>
      </group>
    </group>
  );
};
