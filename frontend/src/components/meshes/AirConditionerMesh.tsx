/**
 * AirConditionerMesh.tsx
 *
 * HVAC / AC External Unit with active rotating fan blades and protective grill.
 * Bottom at local Y = 0.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MeshProps } from './GenericMesh';

export const AirConditionerMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;
  const isTall = h > d;
  const fanR = Math.min(w, isTall ? h : d) * 0.4;

  const bladesRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (bladesRef.current) {
      bladesRef.current.rotation.z += delta * 15;
    }
  });

  return (
    <group>
      {/* Main Compressor Unit Box */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Radiator Coils (Side Vents) */}
      <mesh position={[w / 2 + 0.01, h / 2, 0]}>
        <boxGeometry args={[0.02, h * 0.8, d * 0.8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-w / 2 - 0.01, h / 2, 0]}>
        <boxGeometry args={[0.02, h * 0.8, d * 0.8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Fan Mount Area */}
      <group position={
        isTall ? [0, h / 2, d / 2 + 0.02] : [0, h + 0.02, 0]
      } rotation={
        isTall ? [0, 0, 0] : [-Math.PI / 2, 0, 0]
      }>
        {/* Fan Shroud */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[fanR * 1.1, fanR * 1.1, 0.02, 32]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>

        {/* Interior Fan Cavity */}
        <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[fanR, fanR, 0.01, 32]} />
          <meshStandardMaterial color="#020617" />
        </mesh>

        {/* Animated Rotating Fan Blades */}
        <group ref={bladesRef} position={[0, 0, 0.005]}>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
            <mesh key={`blade-${i}`} rotation={[0, 0, angle]}>
              <boxGeometry args={[fanR * 1.6, 0.06, 0.01]} />
              <meshStandardMaterial color="#0284c7" metalness={0.7} />
            </mesh>
          ))}
        </group>

        {/* Protective Fan Grill */}
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`grill-${i}`} rotation={[0, 0, (i * Math.PI) / 6]} position={[0, 0, 0.02]}>
            <boxGeometry args={[fanR * 2, 0.02, 0.02]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
        ))}

        {/* Center Hub Cap */}
        <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[fanR * 0.2, fanR * 0.2, 0.02, 16]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>
    </group>
  );
};
