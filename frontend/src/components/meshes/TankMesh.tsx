/**
 * TankMesh.tsx
 *
 * Detailed industrial panel tank (rooftop style) with a rectangular body,
 * ribbed side panels, access hatch, ladder, and control panel.
 * Scaled to fit within dims. Bottom at local Y = 0.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

export const TankMesh: React.FC<MeshProps> = ({
  dims, color, metalness = 0.6, roughness = 0.4, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  
  const tankWidth = w * 0.9;
  const tankDepth = d * 0.9;
  
  const legHeight = h * 0.1;
  const bodyHeight = h * 0.9;
  
  const panelColor = color || "#cbd5e1"; // Lighter metallic gray for panel tanks
  const frameColor = "#94a3b8";
  
  return (
    <group>
      {/* Base Support Frame (I-Beam style grid base) */}
      <mesh position={[0, legHeight / 2, 0]} castShadow>
        <boxGeometry args={[tankWidth * 0.95, legHeight, tankDepth * 0.95]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.5} />
      </mesh>

      {/* Main Rectangular Tank Body */}
      <mesh position={[0, legHeight + bodyHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[tankWidth, bodyHeight, tankDepth]} />
        <meshStandardMaterial
          color={panelColor}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Ribbed Panels (Vertical & Horizontal frame lines to simulate sectional panels) */}
      {/* Horizontal Belts */}
      {[-0.25, 0, 0.25].map((yOffset, i) => (
        <mesh key={`h-belt-${i}`} position={[0, legHeight + bodyHeight / 2 + bodyHeight * yOffset, 0]} castShadow>
          <boxGeometry args={[tankWidth * 1.02, bodyHeight * 0.02, tankDepth * 1.02]} />
          <meshStandardMaterial color={frameColor} metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      
      {/* Vertical Belts Front/Back */}
      {[-0.25, 0, 0.25].map((xOffset, i) => (
        <mesh key={`v-belt-fb-${i}`} position={[tankWidth * xOffset, legHeight + bodyHeight / 2, 0]} castShadow>
          <boxGeometry args={[tankWidth * 0.02, bodyHeight, tankDepth * 1.02]} />
          <meshStandardMaterial color={frameColor} metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      
      {/* Vertical Belts Left/Right */}
      {[-0.25, 0, 0.25].map((zOffset, i) => (
        <mesh key={`v-belt-lr-${i}`} position={[0, legHeight + bodyHeight / 2, tankDepth * zOffset]} castShadow>
          <boxGeometry args={[tankWidth * 1.02, bodyHeight, tankDepth * 0.02]} />
          <meshStandardMaterial color={frameColor} metalness={0.7} roughness={0.5} />
        </mesh>
      ))}

      {/* Top Roof (Slightly pitched for drainage) */}
      <mesh position={[0, legHeight + bodyHeight + bodyHeight * 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0, Math.sqrt(tankWidth*tankWidth + tankDepth*tankDepth)/2, bodyHeight * 0.04, 4, 1, false, Math.PI/4]} />
        <meshStandardMaterial
          color={panelColor}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Top Access Hatch & Vent */}
      <group position={[tankWidth * 0.25, legHeight + bodyHeight, tankDepth * 0.25]}>
        <mesh castShadow>
          <boxGeometry args={[tankWidth * 0.25, bodyHeight * 0.1, tankDepth * 0.25]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Hatch Lid */}
        <mesh position={[0, bodyHeight * 0.06, 0]} castShadow>
          <boxGeometry args={[tankWidth * 0.27, bodyHeight * 0.02, tankDepth * 0.27]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Inner glow (indicating active substance/sensor inside) */}
        <mesh position={[0, bodyHeight * 0.07, 0]}>
          <planeGeometry args={[tankWidth * 0.15, tankDepth * 0.15]} />
          <meshBasicMaterial color="var(--accent-cyan)" opacity={0.6} transparent />
        </mesh>
      </group>

      {/* Side Ladder */}
      <group position={[tankWidth / 2 + tankWidth * 0.05, legHeight + bodyHeight / 2, 0]}>
        {/* Left rail */}
        <mesh position={[0, 0, -tankDepth * 0.1]} castShadow>
          <boxGeometry args={[tankWidth * 0.03, bodyHeight * 0.9, tankDepth * 0.02]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Right rail */}
        <mesh position={[0, 0, tankDepth * 0.1]} castShadow>
          <boxGeometry args={[tankWidth * 0.03, bodyHeight * 0.9, tankDepth * 0.02]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Rungs */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`rung-${i}`} position={[0, (i - 3.5) * (bodyHeight * 0.11), 0]} castShadow>
            <boxGeometry args={[tankWidth * 0.02, bodyHeight * 0.015, tankDepth * 0.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Modern Control Panel on front side */}
      <group position={[0, legHeight + bodyHeight * 0.4, tankDepth / 2 + tankDepth * 0.05]}>
        <mesh castShadow>
          <boxGeometry args={[tankWidth * 0.4, bodyHeight * 0.3, tankDepth * 0.1]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, bodyHeight * 0.05, tankDepth * 0.06]} castShadow>
          <boxGeometry args={[tankWidth * 0.3, bodyHeight * 0.15, 0.02]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* Screen Glow */}
        <mesh position={[0, bodyHeight * 0.05, tankDepth * 0.072]}>
          <planeGeometry args={[tankWidth * 0.25, bodyHeight * 0.12]} />
          <meshBasicMaterial color="var(--accent-cyan)" opacity={0.7} transparent />
        </mesh>
      </group>
    </group>
  );
};
