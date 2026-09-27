/**
 * SensorMesh.tsx
 *
 * Detailed sensor device with a mounting base, technical stalk,
 * glowing data rings, and a glass-like antenna dome.
 * Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const SensorMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const radius = Math.min(w, d) / 2;
  const baseH = h * 0.2;
  const stalkH = h * 0.5;
  const domeR = radius * 0.6;

  return (
    <group>
      {/* Heavy Base / Mount */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, baseH, 16]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Technical Stalk */}
      <mesh position={[0, baseH + stalkH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.4, radius * 0.6, stalkH, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Data Transmission Ring (Glowing) */}
      <mesh position={[0, baseH + stalkH * 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.5, 0.02, 16, 32]} />
        <meshStandardMaterial color="var(--accent-amber)" emissive="var(--accent-amber)" emissiveIntensity={0.8} />
      </mesh>

      {/* Sensor Array Head */}
      <mesh position={[0, baseH + stalkH, 0]} castShadow>
        <cylinderGeometry args={[domeR, radius * 0.4, h * 0.1, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Antenna / Optical Dome */}
      <mesh position={[0, baseH + stalkH + h * 0.05, 0]}>
        <sphereGeometry args={[domeR * 0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="var(--accent-cyan)" metalness={0.9} roughness={0.1} emissive="var(--accent-cyan)" emissiveIntensity={0.4} transparent opacity={0.8} />
      </mesh>
      
      {/* Small indicator lights on the base */}
      <mesh position={[radius * 0.8, baseH / 2, 0]} rotation={[0, 0, -Math.PI / 2]}>
         <cylinderGeometry args={[0.02, 0.02, 0.05, 8]} />
         <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1} />
      </mesh>
    </group>
  );
};
