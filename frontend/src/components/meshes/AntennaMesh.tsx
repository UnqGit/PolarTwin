/**
 * AntennaMesh.tsx
 *
 * Polar communication antenna / rotating radar dish.
 * Bottom at local Y = 0.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MeshProps } from './GenericMesh';

export const AntennaMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;
  const radius = Math.min(w, d) / 2;
  const baseH = h * 0.15;
  const stalkH = h * 0.58;
  const dishR = radius * 1.4;

  const dishRotRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    if (dishRotRef.current) {
      dishRotRef.current.rotation.y += delta * 0.6; // Slow continuous radar sweep
    }
    if (beaconRef.current) {
      beaconRef.current.opacity = Math.sin(state.clock.elapsedTime * 6) > 0 ? 1 : 0.2;
    }
  });

  return (
    <group>
      {/* Heavy Base Mount Plinth */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.85, radius * 0.95, baseH, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.5} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Structural Tripod / Lattice Stalk */}
      <mesh position={[0, baseH + stalkH / 2, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.18, radius * 0.28, stalkH, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Rotating Azimuth Gimbal & Parabolic Dish Head */}
      <group position={[0, baseH + stalkH, 0]}>
        <group ref={dishRotRef}>
          {/* Gimbal Hub */}
          <mesh castShadow>
            <sphereGeometry args={[radius * 0.22, 12, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>

          {/* Tilted Dish Assembly */}
          <group position={[0, 0, 0]} rotation={[Math.PI / 5, 0, 0]}>
            {/* Parabolic Dish Shell */}
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[dishR, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
              <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} side={2} />
            </mesh>

            {/* Dish Central Feed Horn Horn (Center Spike) */}
            <mesh position={[0, dishR * 0.65, 0]} castShadow>
              <cylinderGeometry args={[0.02, 0.04, dishR * 0.85, 8]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} />
            </mesh>

            {/* Glowing Uplink Emitter Bulb */}
            <mesh position={[0, dishR * 1.08, 0]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial ref={beaconRef} color="#22d3ee" transparent opacity={0.9} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};
