/**
 * AntennaMesh.tsx
 *
 * A communication antenna / radar dish.
 * Bottom at local Y = 0.
 */
import React from 'react';
import type { MeshProps } from './GenericMesh';

export const AntennaMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;
  const radius = Math.min(w, d) / 2;
  const baseH = h * 0.15;
  const stalkH = h * 0.6;
  const dishR = radius * 1.5;

  return (
    <group>
      {/* Base Mount */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.8, radius * 0.9, baseH, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.5} opacity={opacity} transparent={transparent} />
      </mesh>
      
      {/* Stalk */}
      <mesh position={[0, baseH + stalkH / 2, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.2, radius * 0.3, stalkH, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} opacity={opacity} transparent={transparent} />
      </mesh>
      
      {/* Dish Head */}
      <group position={[0, baseH + stalkH, 0]} rotation={[Math.PI / 6, 0, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[dishR, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} side={2} />
        </mesh>
        {/* Dish Receiver (Center spike) */}
        <mesh position={[0, dishR * 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.04, dishR * 0.8, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh position={[0, dishR * 1.0, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="var(--accent-cyan)" emissive="var(--accent-cyan)" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  );
};
