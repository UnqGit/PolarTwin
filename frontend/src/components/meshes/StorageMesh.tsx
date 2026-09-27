/**
 * StorageMesh.tsx
 *
 * Storage container / Silo or racking system.
 * Bottom at local Y = 0.
 */
import React from 'react';
import { Edges } from '@react-three/drei';
import type { MeshProps } from './GenericMesh';

export const StorageMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;

  return (
    <group>
      {/* Corrugated Shipping Container look */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
        <Edges scale={1} threshold={5} color="#1e293b" opacity={0.5} transparent />
      </mesh>
      
      {/* Front Doors */}
      <group position={[0, h / 2, d / 2 + 0.01]}>
        <mesh position={[-w / 4, 0, 0]}>
          <boxGeometry args={[w * 0.45, h * 0.9, 0.02]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.6} />
        </mesh>
        <mesh position={[w / 4, 0, 0]}>
          <boxGeometry args={[w * 0.45, h * 0.9, 0.02]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.6} />
        </mesh>
        {/* Door Lock Bars */}
        {[-w * 0.3, -w * 0.2, w * 0.2, w * 0.3].map((x, i) => (
           <mesh key={`bar-${i}`} position={[x, 0, 0.02]} castShadow>
             <cylinderGeometry args={[0.02, 0.02, h * 0.8, 8]} />
             <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
           </mesh>
        ))}
      </group>
    </group>
  );
};
