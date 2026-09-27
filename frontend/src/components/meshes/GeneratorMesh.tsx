/**
 * GeneratorMesh.tsx
 *
 * Detailed procedural generator: Base skid, engine block, alternator,
 * radiator fan grill, and exhaust stack.
 * Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const GeneratorMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;

  const baseH = h * 0.1;
  const bodyH = h * 0.6;
  const engineW = w * 0.6;
  const altW = w * 0.35;
  const radiatorW = w * 0.15;
  const exhaustR = Math.min(w, d) * 0.05;
  const exhaustH = h * 0.4;
  const centreY = baseH + bodyH / 2;

  return (
    <group>
      {/* Base Skid */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.5} />
      </mesh>

      {/* Engine Block */}
      <mesh position={[-w * 0.1, centreY, 0]} castShadow receiveShadow>
        <boxGeometry args={[engineW, bodyH, d * 0.7]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Alternator Cylinder */}
      <mesh position={[w * 0.3, centreY - bodyH * 0.1, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[d * 0.3, d * 0.3, altW, 16]} />
        <meshStandardMaterial color={color} metalness={metalness + 0.2} roughness={Math.max(roughness - 0.2, 0)} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Radiator Grill (Front) */}
      <mesh position={[-w / 2 + radiatorW / 2, centreY, 0]} castShadow receiveShadow>
        <boxGeometry args={[radiatorW, bodyH * 0.9, d * 0.8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.9} />
      </mesh>

      {/* Cooling Fan indent on Radiator */}
      <mesh position={[-w / 2 - 0.01, centreY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[d * 0.3, d * 0.3, 0.05, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Exhaust Pipe & Muffler */}
      <group position={[-w * 0.1, baseH + bodyH + exhaustH / 2, d * 0.2]}>
        {/* Pipe */}
        <mesh castShadow>
          <cylinderGeometry args={[exhaustR, exhaustR, exhaustH, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* Muffler Bulge */}
        <mesh position={[0, -exhaustH * 0.2, 0]} castShadow>
          <cylinderGeometry args={[exhaustR * 1.8, exhaustR * 1.8, exhaustH * 0.3, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.5} />
        </mesh>
        {/* Rain Cap */}
        <mesh position={[0, exhaustH / 2 + exhaustR, 0]} rotation={[Math.PI / 8, 0, 0]} castShadow>
          <cylinderGeometry args={[exhaustR * 1.5, exhaustR * 1.5, 0.02, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      
      {/* Small Control Panel on the side */}
      <mesh position={[w * 0.1, centreY, d * 0.35 + 0.02]} castShadow>
        <boxGeometry args={[w * 0.2, h * 0.2, 0.05]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
    </group>
  );
};
