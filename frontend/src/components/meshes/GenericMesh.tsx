/**
 * GenericMesh.tsx
 *
 * Fallback mesh for any component type that has no specialised mesh registered.
 * Designed as an industrial hardware skid module with corner lifting lugs,
 * recessed technical faceplate, and cyan status trim. Bottom at local Y = 0.
 *
 * Also exports the shared MeshProps interface used by all mesh components.
 */

import React from 'react';
import { Edges } from '@react-three/drei';
import type { Dims } from '../../lib/layout';

/** Shared prop interface for every mesh component in the registry. */
export interface MeshProps {
  dims: Dims;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
}

export const GenericMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const bezel = 0.05;

  return (
    <group>
      {/* Main Module Block */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
        <Edges scale={1} threshold={15} color="#0f172a" opacity={0.4} transparent />
      </mesh>

      {/* 4 Corner Lifting Eye-Bolts / Lugs on Top */}
      {[-w * 0.42, w * 0.42].map((x, xi) =>
        [-d * 0.42, d * 0.42].map((z, zi) => (
          <group key={`lug-${xi}-${zi}`} position={[x, h + 0.03, z]}>
            <mesh>
              <torusGeometry args={[0.03, 0.01, 8, 16]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))
      )}

      {/* Inset Hardware Panels (Front & Back) */}
      <mesh position={[0, h / 2, d / 2 + 0.005]}>
        <boxGeometry args={[w - bezel * 4, h - bezel * 4, 0.01]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, h / 2, -d / 2 - 0.005]}>
        <boxGeometry args={[w - bezel * 4, h - bezel * 4, 0.01]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* Glowing Status Accent Bar on Top Front Edge */}
      <mesh position={[0, h - 0.01, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.4, 0.02, 0.02]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
};
