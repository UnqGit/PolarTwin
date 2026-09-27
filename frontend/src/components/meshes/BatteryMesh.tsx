/**
 * BatteryMesh.tsx
 *
 * Detailed industrial battery rack / cabinet with server-rack styling,
 * front glowing indicators, and top busbar terminals.
 * Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const BatteryMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const bodyH = h * 0.95;
  const termH = h * 0.05;
  const termR = Math.min(w, d) * 0.15;

  return (
    <group>
      {/* Main Cabinet */}
      <mesh castShadow receiveShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Front Panel Inset (Black screen area) */}
      <mesh position={[0, bodyH / 2, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.8, bodyH * 0.85, 0.02]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.8} />
      </mesh>

      {/* Battery Cell Ridges (Server rack look) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={`cell-${i}`} position={[0, bodyH * 0.15 + (i * bodyH * 0.12), d / 2 + 0.02]}>
          <mesh>
            <boxGeometry args={[w * 0.7, bodyH * 0.08, 0.02]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Glowing Status LED per cell */}
          <mesh position={[-w * 0.25, 0, 0.015]}>
            <boxGeometry args={[w * 0.05, bodyH * 0.02, 0.02]} />
            <meshStandardMaterial color="var(--accent-blue)" emissive="var(--accent-blue)" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Positive Terminal (Red Busbar base) */}
      <mesh position={[w * 0.25, bodyH + termH / 2, 0]} castShadow>
        <cylinderGeometry args={[termR, termR, termH, 16]} />
        <meshStandardMaterial color="#ef4444" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[w * 0.25, bodyH + termH + 0.02, 0]} castShadow>
        <boxGeometry args={[termR * 1.2, 0.04, termR * 1.2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Negative Terminal (Black Busbar base) */}
      <mesh position={[-w * 0.25, bodyH + termH / 2, 0]} castShadow>
        <cylinderGeometry args={[termR, termR, termH, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-w * 0.25, bodyH + termH + 0.02, 0]} castShadow>
        <boxGeometry args={[termR * 1.2, 0.04, termR * 1.2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};
