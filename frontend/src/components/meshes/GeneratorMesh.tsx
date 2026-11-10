/**
 * GeneratorMesh.tsx
 *
 * Detailed procedural industrial diesel/turbine generator: Base skid with vibration isolators,
 * engine block, alternator, active spinning cooling fan, exhaust muffler stack, and status panel.
 * Bottom at local Y = 0.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MeshProps } from './GenericMesh';

export const GeneratorMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;

  const baseH = h * 0.1;
  const bodyH = h * 0.6;
  const engineW = w * 0.58;
  const altW = w * 0.35;
  const radiatorW = w * 0.16;
  const exhaustR = Math.min(w, d) * 0.055;
  const exhaustH = h * 0.42;
  const centreY = baseH + bodyH / 2;

  const fanRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (fanRef.current) {
      fanRef.current.rotation.x += delta * 18; // Smooth spinning fan
    }
  });

  return (
    <group>
      {/* Heavy Steel Base Skid */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.4} />
      </mesh>

      {/* Vibration Damper Isolators (4 corners under skid) */}
      {[-w * 0.45, w * 0.45].map((x, xi) =>
        [-d * 0.4, d * 0.4].map((z, zi) => (
          <mesh key={`damper-${xi}-${zi}`} position={[x, baseH * 0.25, z]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.06, Math.min(w, d) * 0.06, baseH * 0.5, 8]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
          </mesh>
        ))
      )}

      {/* Heavy Engine Block */}
      <mesh position={[-w * 0.08, centreY, 0]} castShadow receiveShadow>
        <boxGeometry args={[engineW, bodyH, d * 0.72]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Engine Cylinder Head Covers (Top twin valve covers) */}
      {[-d * 0.18, d * 0.18].map((z, zi) => (
        <mesh key={`cover-${zi}`} position={[-w * 0.08, baseH + bodyH + 0.03, z]} castShadow>
          <boxGeometry args={[engineW * 0.85, 0.06, d * 0.26]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* Alternator Cylinder */}
      <mesh position={[w * 0.3, centreY - bodyH * 0.08, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[d * 0.32, d * 0.32, altW, 24]} />
        <meshStandardMaterial color={color} metalness={Math.min(metalness + 0.2, 1)} roughness={Math.max(roughness - 0.2, 0)} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Alternator End Cap & Wiring Terminal Box */}
      <mesh position={[w * 0.3 + altW / 2 + 0.02, centreY - bodyH * 0.08, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[d * 0.25, d * 0.25, 0.04, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Radiator Housing (Front) */}
      <mesh position={[-w / 2 + radiatorW / 2, centreY, 0]} castShadow receiveShadow>
        <boxGeometry args={[radiatorW, bodyH * 0.95, d * 0.82]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.8} />
      </mesh>

      {/* Spinning Radiator Fan Assembly inside the shroud */}
      <group position={[-w / 2 + radiatorW * 0.3, centreY, 0]}>
        {/* Protective Fan Shroud Ring */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[d * 0.34, d * 0.34, 0.04, 24, 1, true]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        {/* Animated Rotating 6-blade Fan */}
        <group ref={fanRef} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
          {[0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3].map((ang, i) => (
            <mesh key={`blade-${i}`} rotation={[0, ang, 0.3]} position={[0, 0, 0]}>
              <boxGeometry args={[0.02, d * 0.3, 0.05]} />
              <meshStandardMaterial color="#06b6d4" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Exhaust Pipe & Muffler */}
      <group position={[-w * 0.1, baseH + bodyH + exhaustH / 2, d * 0.22]}>
        {/* Primary Exhaust Flue */}
        <mesh castShadow>
          <cylinderGeometry args={[exhaustR, exhaustR, exhaustH, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* Heavy Muffler Silencer Bulge */}
        <mesh position={[0, -exhaustH * 0.15, 0]} castShadow>
          <cylinderGeometry args={[exhaustR * 1.9, exhaustR * 1.9, exhaustH * 0.38, 20]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Rain Cap Weather Flap */}
        <mesh position={[0, exhaustH / 2 + exhaustR, 0]} rotation={[Math.PI / 6, 0, 0]} castShadow>
          <cylinderGeometry args={[exhaustR * 1.6, exhaustR * 1.6, 0.02, 14]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>

      {/* Heavy-Duty SCADA Control Panel & Analog Gauges */}
      <group position={[w * 0.12, centreY, d * 0.36 + 0.015]}>
        <mesh castShadow>
          <boxGeometry args={[w * 0.24, h * 0.28, 0.04]} />
          <meshStandardMaterial color="#020617" metalness={0.5} roughness={0.7} />
        </mesh>
        {/* Glowing Status Screen */}
        <mesh position={[0, 0.02, 0.022]}>
          <planeGeometry args={[w * 0.18, h * 0.16]} />
          <meshBasicMaterial color="#06b6d4" />
        </mesh>
        {/* Analog Pressure Dial */}
        <mesh position={[w * 0.07, -h * 0.08, 0.025]} rotation={[0, 0, 0]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
};
