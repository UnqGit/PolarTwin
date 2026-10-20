/**
 * ControllerMesh.tsx
 *
 * Industrial PLC automation controller cabinet with touchscreen HMI,
 * emergency stop push-button with safety collar, stack light, and status LEDs.
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
      {/* Heavy Industrial Enclosure Body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Screen Bezel Frame */}
      <mesh position={[0, h * 0.7, d / 2 + 0.01]} castShadow>
        <boxGeometry args={[w * 0.75, h * 0.38, 0.02]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Glowing Touchscreen HMI Display */}
      <mesh position={[0, h * 0.7, d / 2 + 0.022]}>
        <boxGeometry args={[w * 0.68, h * 0.32, 0.005]} />
        <meshBasicMaterial color="#0284c7" />
      </mesh>
      {/* Screen Graph / Scope Line Overlay */}
      <mesh position={[0, h * 0.7, d / 2 + 0.026]}>
        <planeGeometry args={[w * 0.58, h * 0.22]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} wireframe />
      </mesh>

      {/* Control Console Shelf / Push-buttons */}
      <group position={[0, h * 0.44, d / 2 + 0.015]}>
        {/* Yellow E-Stop Safety Collar */}
        <mesh position={[w * 0.22, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[w * 0.07, w * 0.07, 0.02, 16]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
        {/* Red Mushroom E-Stop Head */}
        <mesh position={[w * 0.22, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[w * 0.055, w * 0.055, 0.03, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} />
        </mesh>

        {/* Green Start Button */}
        <mesh position={[w * 0.06, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[w * 0.045, w * 0.045, 0.02, 16]} />
          <meshStandardMaterial color="#10b981" roughness={0.4} />
        </mesh>

        {/* Amber Reset Button */}
        <mesh position={[-w * 0.08, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[w * 0.04, w * 0.04, 0.02, 16]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.4} />
        </mesh>
      </group>

      {/* Industrial Quarter-Turn Door Latch */}
      <group position={[w * 0.4, h * 0.5, d / 2 + 0.018]} castShadow>
        <mesh>
          <boxGeometry args={[0.02, h * 0.18, 0.03]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Top Multi-Color Stack Light (Andon Light Tower) */}
      <group position={[w * 0.35, h, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 12]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Green Lamp */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        {/* Amber Lamp */}
        <mesh position={[0, 0.145, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
          <meshBasicMaterial color="#eab308" transparent opacity={0.6} />
        </mesh>
        {/* Red Lamp */}
        <mesh position={[0, 0.19, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.4} />
        </mesh>
      </group>

      {/* Lower Air Filter Louvers */}
      <group position={[0, h * 0.16, d / 2 + 0.01]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`grill-${i}`} position={[0, (i - 1.5) * (h * 0.035), 0]}>
            <boxGeometry args={[w * 0.6, h * 0.018, 0.01]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        ))}
      </group>
    </group>
  );
};
