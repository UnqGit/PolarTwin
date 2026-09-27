/**
 * AlarmMesh.tsx
 *
 * Emergency Siren / Strobe Light.
 * Bottom at local Y = 0.
 */
import React from 'react';
import type { MeshProps } from './GenericMesh';

export const AlarmMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;
  const radius = Math.min(w, d) / 2;
  const baseH = h * 0.4;
  const strobeH = h * 0.6;

  return (
    <group>
      {/* Base Mount */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.9, radius, baseH, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} opacity={opacity} transparent={transparent} />
      </mesh>
      
      {/* Strobe Light / Siren Bulb */}
      <mesh position={[0, baseH + strobeH / 2, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.7, radius * 0.7, strobeH, 16]} />
        {/* Glow aggressively if it's an alarm */}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={0.9} />
      </mesh>
      
      {/* Protective Cage / Grill */}
      {[0, Math.PI / 2].map((angle, i) => (
        <mesh key={`cage-${i}`} position={[0, baseH + strobeH / 2, 0]} rotation={[0, angle, 0]} castShadow>
          <boxGeometry args={[radius * 1.6, strobeH + 0.05, 0.02]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      <mesh position={[0, baseH + strobeH + 0.02, 0]}>
         <cylinderGeometry args={[radius * 0.8, radius * 0.8, 0.05, 16]} />
         <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
};
