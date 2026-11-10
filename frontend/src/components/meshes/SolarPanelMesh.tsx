/**
 * SolarPanelMesh.tsx
 *
 * Bifacial photovoltaic solar array with monocrystalline anti-reflective sheen,
 * silver busbar grid lines, and hydraulic angle actuator stand.
 * Bottom at local Y = 0.
 */
import React from 'react';
import type { MeshProps } from './GenericMesh';

export const SolarPanelMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;
  const baseH = h * 0.1;
  const standH = h * 0.58;
  const panelThick = 0.05;

  return (
    <group>
      {/* Heavy Ballast Base Footing */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.6, baseH, d * 0.6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* Center Pivot Mast & Hydraulic Tilt Arm */}
      <mesh position={[0, baseH + standH / 2, 0]} castShadow>
        <cylinderGeometry args={[w * 0.05, w * 0.08, standH, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Rear Hydraulic Ram Strut */}
      <mesh position={[0, baseH + standH * 0.45, -d * 0.15]} rotation={[0.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, standH * 0.8, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Main Panel Array — Tilted at 35 degrees facing front (-Z) for polar latitude */}
      <group position={[0, baseH + standH, 0]} rotation={[Math.PI / 5.2, 0, 0]}>
        {/* Rigid Perimeter Frame */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, panelThick, d]} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
        </mesh>

        {/* Monocrystalline PV Glass with Anti-Reflective Blue Sheen */}
        <mesh position={[0, panelThick / 2 + 0.005, 0]}>
          <boxGeometry args={[w * 0.96, 0.005, d * 0.96]} />
          <meshStandardMaterial
            color="#07192f"
            emissive="#0284c7"
            emissiveIntensity={0.2}
            metalness={0.95}
            roughness={0.08}
          />
        </mesh>

        {/* Metallic Silver Conductor Grid Lines */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`grid-x-${i}`} position={[-w * 0.3 + (i * w * 0.2), panelThick / 2 + 0.01, 0]}>
            <boxGeometry args={[0.012, 0.006, d * 0.95]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
        {Array.from({ length: 3 }).map((_, i) => (
          <mesh key={`grid-z-${i}`} position={[0, panelThick / 2 + 0.01, -d * 0.25 + (i * d * 0.25)]}>
            <boxGeometry args={[w * 0.95, 0.006, 0.012]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
