/**
 * ServerMesh.tsx
 *
 * Data center server rack with glowing blade servers and networking lights.
 * Bottom at local Y = 0.
 */
import React from 'react';
import { Edges } from '@react-three/drei';
import type { MeshProps } from './GenericMesh';

export const ServerMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;

  return (
    <group>
      {/* Rack Cabinet */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
        <Edges scale={1} threshold={15} color="#0f172a" opacity={0.6} transparent />
      </mesh>
      
      {/* Server Blades / U-slots (Front) */}
      <group position={[0, h / 2, d / 2 + 0.01]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w * 0.85, h * 0.95, 0.02]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        
        {/* Render 10 blades stacked vertically */}
        {Array.from({ length: 10 }).map((_, i) => (
          <group key={`blade-${i}`} position={[0, -h * 0.42 + (i * h * 0.09), 0.01]}>
            {/* Blade face */}
            <mesh>
               <boxGeometry args={[w * 0.8, h * 0.07, 0.02]} />
               <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.4} />
            </mesh>
            {/* Blinking Data LEDs */}
            <mesh position={[-w * 0.3, 0, 0.01]}>
               <boxGeometry args={[w * 0.08, h * 0.02, 0.01]} />
               {/* Slightly randomize the emission intensity per blade */}
               <meshStandardMaterial color="var(--accent-cyan)" emissive="var(--accent-cyan)" emissiveIntensity={0.6 + (i % 3) * 0.2} />
            </mesh>
            <mesh position={[-w * 0.15, 0, 0.01]}>
               <boxGeometry args={[w * 0.05, h * 0.02, 0.01]} />
               <meshStandardMaterial color="var(--accent-blue)" emissive="var(--accent-blue)" emissiveIntensity={0.4 + (i % 2) * 0.4} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};
