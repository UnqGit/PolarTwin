/**
 * VehicleMesh.tsx
 *
 * Rover / truck geometry with wheels and a cabin.
 * Bottom at local Y = 0.
 */
import React from 'react';
import type { MeshProps } from './GenericMesh';

export const VehicleMesh: React.FC<MeshProps> = ({
  dims, color, metalness, roughness, opacity, transparent
}) => {
  const { width: w, height: h, depth: d } = dims;
  const wheelR = h * 0.25;
  const wheelW = w * 0.2;
  const chassisH = h * 0.3;
  const cabinH = h * 0.4;
  
  // Wheel positions (4 wheels)
  const wheels = [
    [-w / 2 + wheelW / 2, -d * 0.3], // front left
    [w / 2 - wheelW / 2, -d * 0.3],  // front right
    [-w / 2 + wheelW / 2, d * 0.3],  // rear left
    [w / 2 - wheelW / 2, d * 0.3]    // rear right
  ];

  return (
    <group>
      {/* 4 Wheels */}
      {wheels.map(([wx, wz], i) => (
        <mesh key={`wheel-${i}`} position={[wx, wheelR, wz]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[wheelR, wheelR, wheelW, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      ))}

      {/* Main Chassis */}
      <mesh position={[0, wheelR + chassisH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, chassisH, d * 0.9]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>

      {/* Driver Cabin (Front / -Z) */}
      <mesh position={[0, wheelR + chassisH + cabinH / 2, -d * 0.15]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.7, cabinH, d * 0.4]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>
      
      {/* Windshield */}
      <mesh position={[0, wheelR + chassisH + cabinH / 2, -d * 0.35 - 0.01]} castShadow>
        <boxGeometry args={[w * 0.6, cabinH * 0.6, 0.05]} />
        <meshStandardMaterial color="#020617" metalness={0.9} roughness={0.1} opacity={0.8} transparent />
      </mesh>
      
      {/* Rear Bed / Cargo Area */}
      <mesh position={[0, wheelR + chassisH + chassisH * 0.3, d * 0.25]} castShadow>
        <boxGeometry args={[w * 0.8, chassisH * 0.6, d * 0.4]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
};
