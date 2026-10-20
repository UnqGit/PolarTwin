/**
 * BatteryMesh.tsx
 *
 * Detailed industrial battery rack / cabinet with server-rack styling,
 * dynamic animated LED charge indicators, and top busbar terminals.
 * Bottom at local Y = 0.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MeshProps } from './GenericMesh';

export const BatteryMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent,
}) => {
  const { width: w, height: h, depth: d } = dims;
  const bodyH = h * 0.94;
  const termH = h * 0.06;
  const termR = Math.min(w, d) * 0.14;

  const ledsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ledsRef.current) return;
    const t = state.clock.elapsedTime * 3;
    ledsRef.current.children.forEach((child, idx) => {
      const pulse = Math.sin(t + idx * 0.6) * 0.3 + 0.7;
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = pulse;
      }
    });
  });

  return (
    <group>
      {/* Heavy Industrial Enclosure Cabinet */}
      <mesh castShadow receiveShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Front Panel Inset (Matte Black Technical Bay) */}
      <mesh position={[0, bodyH / 2, d / 2 + 0.005]}>
        <boxGeometry args={[w * 0.86, bodyH * 0.9, 0.015]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.5} />
      </mesh>

      {/* 5-Tier Battery Module Drawers */}
      {Array.from({ length: 5 }).map((_, i) => (
        <group key={`cell-${i}`} position={[0, bodyH * 0.12 + (i * bodyH * 0.18), d / 2 + 0.012]}>
          {/* Module Drawer Face */}
          <mesh castShadow>
            <boxGeometry args={[w * 0.8, bodyH * 0.14, 0.02]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Recessed Grip Handles */}
          {[-w * 0.32, w * 0.32].map((hx, hi) => (
            <mesh key={`handle-${hi}`} position={[hx, 0, 0.015]}>
              <boxGeometry args={[w * 0.08, bodyH * 0.03, 0.015]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Dynamic Animated Status LEDs Column */}
      <group ref={ledsRef} position={[-w * 0.22, 0, d / 2 + 0.025]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`led-${i}`} position={[0, bodyH * 0.12 + (i * bodyH * 0.18), 0]}>
            <boxGeometry args={[w * 0.08, bodyH * 0.03, 0.01]} />
            <meshBasicMaterial color={i === 4 ? '#38bdf8' : '#22c55e'} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>

      {/* High-Voltage Danger Label Badge */}
      <mesh position={[w * 0.18, bodyH * 0.86, d / 2 + 0.02]}>
        <planeGeometry args={[w * 0.22, bodyH * 0.07]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>

      {/* Positive Terminal Busbar (+ Red) */}
      <group position={[w * 0.25, bodyH, 0]}>
        <mesh position={[0, termH / 2, 0]} castShadow>
          <cylinderGeometry args={[termR, termR, termH, 16]} />
          <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, termH + 0.015, 0]} castShadow>
          <boxGeometry args={[termR * 1.3, 0.03, termR * 1.3]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>

      {/* Negative Terminal Busbar (- Black) */}
      <group position={[-w * 0.25, bodyH, 0]}>
        <mesh position={[0, termH / 2, 0]} castShadow>
          <cylinderGeometry args={[termR, termR, termH, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, termH + 0.015, 0]} castShadow>
          <boxGeometry args={[termR * 1.3, 0.03, termR * 1.3]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
};
