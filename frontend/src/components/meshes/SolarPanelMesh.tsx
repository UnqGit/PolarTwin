/**
 * SolarPanelMesh.tsx
 *
 * Solar array tilted on a stand.
 * Bottom at local Y = 0.
 */
import React from 'react';
import type { MeshProps } from './GenericMesh';

export const SolarPanelMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;
  const baseH = h * 0.1;
  const standH = h * 0.6;
  const panelThick = 0.05;

  return (
    <group>
      {/* Heavy Base Plate */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.5, baseH, d * 0.5]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Center Stand / Pivot */}
      <mesh position={[0, baseH + standH / 2, 0]} castShadow>
        <cylinderGeometry args={[w * 0.05, w * 0.1, standH, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Main Panel Array — Tilted at 30 degrees (Math.PI/6) facing front (-Z) */}
      <group position={[0, baseH + standH, 0]} rotation={[Math.PI / 6, 0, 0]}>
        {/* Panel Frame */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, panelThick, d]} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
        </mesh>
        
        {/* Photovoltaic Cells (Dark Blue/Black glassy surface) */}
        <mesh position={[0, panelThick / 2 + 0.01, 0]}>
          <boxGeometry args={[w * 0.95, 0.01, d * 0.95]} />
          <meshStandardMaterial color="#0a192f" metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* Cell Grid Lines */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`grid-x-${i}`} position={[-w * 0.3 + (i * w * 0.2), panelThick / 2 + 0.02, 0]}>
             <boxGeometry args={[0.01, 0.01, d * 0.95]} />
             <meshStandardMaterial color="#64748b" />
          </mesh>
        ))}
        {Array.from({ length: 3 }).map((_, i) => (
          <mesh key={`grid-z-${i}`} position={[0, panelThick / 2 + 0.02, -d * 0.25 + (i * d * 0.25)]}>
             <boxGeometry args={[w * 0.95, 0.01, 0.01]} />
             <meshStandardMaterial color="#64748b" />
          </mesh>
        ))}
      </group>
    </group>
  );
};
