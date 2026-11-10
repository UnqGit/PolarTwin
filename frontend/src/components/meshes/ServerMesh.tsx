/**
 * ServerMesh.tsx
 *
 * Polar data center blade server rack with dynamic blinking networking activity LEDs.
 * Bottom at local Y = 0.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { MeshProps } from './GenericMesh';

export const ServerMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;

  const ledsGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ledsGroupRef.current) return;
    const t = state.clock.elapsedTime * 6;
    ledsGroupRef.current.children.forEach((child, i) => {
      // Staggered activity LED flicker
      const on = Math.sin(t * (1.2 + (i % 5) * 0.4) + i * 2.1) > 0.1;
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        (mesh.material as THREE.MeshBasicMaterial).opacity = on ? 0.95 : 0.2;
      }
    });
  });

  return (
    <group>
      {/* Heavy Steel Server Enclosure Cabinet */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
        <Edges scale={1} threshold={15} color="#0f172a" opacity={0.6} transparent />
      </mesh>

      {/* Recessed Server Bay (Front) */}
      <group position={[0, h / 2, d / 2 + 0.008]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w * 0.88, h * 0.94, 0.015]} />
          <meshStandardMaterial color="#0b1120" metalness={0.8} roughness={0.4} />
        </mesh>

        {/* 8 Blade Server Modules */}
        {Array.from({ length: 8 }).map((_, i) => (
          <group key={`blade-${i}`} position={[0, -h * 0.4 + (i * h * 0.11), 0.012]}>
            {/* Blade Faceplate */}
            <mesh castShadow>
              <boxGeometry args={[w * 0.82, h * 0.08, 0.02]} />
              <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
            </mesh>

            {/* Perforated Vent Indent */}
            <mesh position={[w * 0.12, 0, 0.012]}>
              <boxGeometry args={[w * 0.45, h * 0.045, 0.005]} />
              <meshStandardMaterial color="#020617" roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* Dynamic Activity LEDs Group */}
        <group ref={ledsGroupRef}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={`led-a-${i}`} position={[-w * 0.28, -h * 0.4 + (i * h * 0.11), 0.025]}>
              <boxGeometry args={[w * 0.05, h * 0.025, 0.005]} />
              <meshBasicMaterial color="#06b6d4" transparent opacity={0.9} />
            </mesh>
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={`led-b-${i}`} position={[-w * 0.18, -h * 0.4 + (i * h * 0.11), 0.025]}>
              <boxGeometry args={[w * 0.04, h * 0.02, 0.005]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};
