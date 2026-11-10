/**
 * VentMesh.tsx
 *
 * HVAC Vent / Duct with angled louvers and active spinning exhaust fan.
 * Bottom at local Y = 0.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MeshProps } from './GenericMesh';

export const VentMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;

  const topFanRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (topFanRef.current) {
      topFanRef.current.rotation.y += delta * 12;
    }
  });

  return (
    <group>
      {/* Vent Duct Housing */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Louvers (Front) */}
      <group position={[0, h / 2, d / 2 + 0.01]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w * 0.8, h * 0.8, 0.02]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`louver-${i}`} position={[0, h * 0.3 - i * (h * 0.12), 0.01]} rotation={[Math.PI / 6, 0, 0]}>
            <boxGeometry args={[w * 0.8, h * 0.08, 0.01]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Top Exhaust Fan Shroud */}
      <mesh position={[0, h + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Math.min(w, d) * 0.35, Math.min(w, d) * 0.35, 0.02, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Animated Rotating Exhaust Fan */}
      <group ref={topFanRef} position={[0, h + 0.02, 0]}>
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
          <mesh key={`blade-${i}`} rotation={[0, angle, 0]}>
            <boxGeometry args={[Math.min(w, d) * 0.6, 0.01, 0.05]} />
            <meshStandardMaterial color="#06b6d4" />
          </mesh>
        ))}
      </group>
    </group>
  );
};
