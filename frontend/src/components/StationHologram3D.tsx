import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';
import { Zap, Wind, AlertTriangle, ShieldCheck, Eye, RotateCw } from 'lucide-react';

export type HologramMode = 'nominal' | 'blizzard' | 'fault';

interface HotspotInfo {
  id: string;
  name: string;
  category: string;
  metric: string;
  status: string;
  color: string;
}

const HOTSPOTS: Record<string, HotspotInfo> = {
  radome: {
    id: 'radome',
    name: 'Satellite Radome & LEO Comms',
    category: 'Telemetry Uplink',
    metric: '142 Mbps · Latency 14ms',
    status: 'ONLINE',
    color: '#38d9f5',
  },
  power: {
    id: 'power',
    name: 'Primary Diesel-Turbine Hub',
    category: 'Energy Infrastructure',
    metric: '3x 62.5 kVA · Bus: 400V AC',
    status: 'NOMINAL',
    color: '#50dbc0',
  },
  habitat: {
    id: 'habitat',
    name: 'Life Support & Living Habitat',
    category: 'Atmospheric Envelope',
    metric: 'Temp: +21.4°C · O₂: 20.9%',
    status: 'STABLE',
    color: '#a78bfa',
  },
  solar: {
    id: 'solar',
    name: 'Bifacial Solar Photovoltaic Array',
    category: 'Renewable Generation',
    metric: 'Tilt: 65° · Yield: 8.4 kW',
    status: 'ACTIVE',
    color: '#f8d57e',
  },
  wind: {
    id: 'wind',
    name: 'Vertical-Axis Katabatic Turbine',
    category: 'Wind Harvesting',
    metric: 'RPM: 185 · Gen: 12.8 kW',
    status: 'OPTIMAL',
    color: '#38d9f5',
  },
  fuel: {
    id: 'fuel',
    name: 'Cryogenic Fuel Reserve Tanks',
    category: 'Consumables',
    metric: 'Capacity: 92% (148 Days)',
    status: 'SECURED',
    color: '#4ade80',
  },
};

/* ── Wind Turbine with Rotating Blades ────────────────────────── */
function WindTurbine({ position, speed = 1 }: { position: [number, number, number]; speed?: number }) {
  const rotorRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (rotorRef.current) {
      rotorRef.current.rotation.y += delta * speed * 4;
    }
  });

  return (
    <group position={position}>
      {/* Tower Mast */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.08, 2.4, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Rotor hub */}
      <group ref={rotorRef} position={[0, 2.3, 0]}>
        {/* Central axis */}
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.8, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* 3 Vertical Blades (Darrieus curve) */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, idx) => (
          <group key={idx} rotation={[0, angle, 0]}>
            <mesh position={[0.45, 0, 0]}>
              <boxGeometry args={[0.04, 0.9, 0.12]} />
              <meshStandardMaterial color="#38d9f5" emissive="#38d9f5" emissiveIntensity={0.25} />
            </mesh>
            {/* Strut */}
            <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, 0.45, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ── Solar Photovoltaic Array ─────────────────────────────────── */
function SolarArray({ position, isBlizzard }: { position: [number, number, number]; isBlizzard: boolean }) {
  return (
    <group position={position} rotation={[-0.4, 0.3, 0]}>
      {/* Framework Support Legs */}
      <mesh position={[0, -0.3, -0.2]}>
        <boxGeometry args={[1.8, 0.04, 0.04]} />
        <meshStandardMaterial color="#475569" metalness={0.8} />
      </mesh>
      <mesh position={[-0.8, -0.45, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.8} />
      </mesh>
      <mesh position={[0.8, -0.45, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.8} />
      </mesh>

      {/* 4 PV Panels */}
      {[-0.65, -0.22, 0.22, 0.65].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <boxGeometry args={[0.38, 0.03, 0.8]} />
          <meshStandardMaterial
            color={isBlizzard ? '#1e293b' : '#0c4a6e'}
            emissive={isBlizzard ? '#000000' : '#0284c7'}
            emissiveIntensity={isBlizzard ? 0.05 : 0.4}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Blizzard Particle Storm ──────────────────────────────────── */
function BlizzardStorm({ active }: { active: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 350;

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Deterministic pseudo-random generation for React Compiler purity
      const seed1 = Math.sin(i * 12.9898 + 1.2) * 43758.5453;
      const r1 = seed1 - Math.floor(seed1);
      const seed2 = Math.sin(i * 78.233 + 4.5) * 43758.5453;
      const r2 = seed2 - Math.floor(seed2);
      const seed3 = Math.sin(i * 37.719 + 7.8) * 43758.5453;
      const r3 = seed3 - Math.floor(seed3);

      pos[i * 3] = (r1 - 0.5) * 16;
      pos[i * 3 + 1] = r2 * 8;
      pos[i * 3 + 2] = (r3 - 0.5) * 16;
      spd[i] = r1 * 0.15 + 0.08;
    }
    return [pos, spd];
  }, []);

  useFrame(() => {
    if (!pointsRef.current || !active) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      // Wind carries snow horizontally & downward
      pos[i * 3] += speeds[i] * 1.8;
      pos[i * 3 + 1] -= speeds[i] * 0.8;
      pos[i * 3 + 2] += speeds[i] * 0.6;

      // Wrap boundaries
      if (pos[i * 3] > 8) pos[i * 3] = -8;
      if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 7;
      if (pos[i * 3 + 2] > 8) pos[i * 3 + 2] = -8;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color="#ffffff"
        transparent
        opacity={0.75}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ── Main Station 3D Model Composite ──────────────────────────── */
function StationModel({
  mode,
  hoveredHotspot,
  onHoverHotspot,
}: {
  mode: HologramMode;
  hoveredHotspot: string | null;
  onHoverHotspot: (id: string | null) => void;
}) {
  const radarRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.PointLight>(null);

  const isBlizzard = mode === 'blizzard';
  const isFault = mode === 'fault';

  // Radar sweep animation
  useFrame((state) => {
    if (radarRef.current) {
      radarRef.current.rotation.y += 0.025;
    }
    if (beaconRef.current) {
      const pulse = isFault
        ? Math.sin(state.clock.elapsedTime * 8) > 0 ? 3.5 : 0.2
        : Math.sin(state.clock.elapsedTime * 2.5) * 0.5 + 1.2;
      beaconRef.current.intensity = pulse;
    }
  });

  // Base materials based on mode
  const moduleColor = isFault ? '#991b1b' : '#334155';
  const glowColor = isFault ? '#f87171' : isBlizzard ? '#38d9f5' : '#50dbc0';

  return (
    <group position={[0, -0.6, 0]}>
      {/* ── Terrain Foundation Grid ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[14, 14, 28, 28]} />
        <meshStandardMaterial
          color="#0b1329"
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      {/* Ice Sheet Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial
          color="#060c18"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* ── Module 1: Main Living & Command Habitat (Elevated on Stilts) ── */}
      <group
        position={[-0.8, 0.8, 0]}
        onPointerOver={(e) => { e.stopPropagation(); onHoverHotspot('habitat'); }}
        onPointerOut={() => onHoverHotspot(null)}
      >
        {/* Support Stilts (4 hydraulic pillars) */}
        {[[-0.9, -0.4, -0.6], [0.9, -0.4, -0.6], [-0.9, -0.4, 0.6], [0.9, -0.4, 0.6]].map((pos, i) => (
          <mesh key={i} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.06, 0.08, 0.8, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Aerodynamic Polar Habitat Pod */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.7, 1.5]} />
          <meshStandardMaterial
            color={hoveredHotspot === 'habitat' ? '#1e293b' : moduleColor}
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>

        {/* Illuminated Window Ribbon */}
        <mesh position={[0, 0.05, 0.76]}>
          <boxGeometry args={[1.8, 0.16, 0.02]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#fde047"
            emissiveIntensity={isFault ? 0.3 : 1.2}
          />
        </mesh>
        <mesh position={[0, 0.05, -0.76]}>
          <boxGeometry args={[1.8, 0.16, 0.02]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#fde047"
            emissiveIntensity={isFault ? 0.3 : 1.2}
          />
        </mesh>

        {/* Roof HVAC Enclosure */}
        <mesh position={[-0.4, 0.42, 0]}>
          <boxGeometry args={[0.8, 0.16, 0.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
      </group>

      {/* ── Connecting Enclosed Skyway Corridor ── */}
      <mesh position={[0.9, 0.8, 0]}>
        <boxGeometry args={[1.2, 0.45, 0.6]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── Module 2: Communications & Satellite Radome Block ── */}
      <group
        position={[2.0, 0.8, 0]}
        onPointerOver={(e) => { e.stopPropagation(); onHoverHotspot('radome'); }}
        onPointerOut={() => onHoverHotspot(null)}
      >
        {/* Support Stilts */}
        {[[-0.6, -0.4, -0.6], [0.6, -0.4, -0.6], [-0.6, -0.4, 0.6], [0.6, -0.4, 0.6]].map((pos, i) => (
          <mesh key={i} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.06, 0.08, 0.8, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Substation Base Block */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.7, 1.5]} />
          <meshStandardMaterial
            color={hoveredHotspot === 'radome' ? '#1e293b' : moduleColor}
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>

        {/* Geodesic Radome Sphere */}
        <mesh position={[0, 0.75, 0]}>
          <sphereGeometry args={[0.65, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial
            color="#e2e8f0"
            metalness={0.3}
            roughness={0.2}
            emissive={hoveredHotspot === 'radome' ? '#38d9f5' : '#000000'}
            emissiveIntensity={hoveredHotspot === 'radome' ? 0.3 : 0}
          />
        </mesh>

        {/* Rotating LEO Radar Dish */}
        <group ref={radarRef} position={[0, 1.35, 0]}>
          <mesh rotation={[0.4, 0, 0]}>
            <coneGeometry args={[0.3, 0.15, 12, 1, true]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.1, 0.15]}>
            <cylinderGeometry args={[0.015, 0.015, 0.25, 8]} />
            <meshStandardMaterial color="#38d9f5" emissive="#38d9f5" emissiveIntensity={0.8} />
          </mesh>
        </group>

        {/* Pulsing Beacon Light */}
        <pointLight
          ref={beaconRef}
          position={[0, 1.5, 0]}
          color={isFault ? '#ef4444' : '#38d9f5'}
          distance={6}
          decay={2}
        />
      </group>

      {/* ── Module 3: Diesel-Turbine Power Plant & HVAC Core ── */}
      <group
        position={[-1.2, 0.5, 2.0]}
        onPointerOver={(e) => { e.stopPropagation(); onHoverHotspot('power'); }}
        onPointerOut={() => onHoverHotspot(null)}
      >
        {/* Foundation */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.7, 1.4]} />
          <meshStandardMaterial
            color={isFault ? '#7f1d1d' : hoveredHotspot === 'power' ? '#0f766e' : '#1e293b'}
            metalness={0.7}
            roughness={0.4}
            emissive={isFault ? '#dc2626' : '#000000'}
            emissiveIntensity={isFault ? 0.4 : 0}
          />
        </mesh>

        {/* Dual Industrial Exhaust Stacks */}
        {[-0.4, 0.4].map((x, i) => (
          <group key={i} position={[x, 0.65, 0.2]}>
            <mesh>
              <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
              <meshStandardMaterial color="#334155" metalness={0.9} />
            </mesh>
            {/* Heat glow ring */}
            <mesh position={[0, 0.28, 0]}>
              <torusGeometry args={[0.085, 0.02, 8, 16]} />
              <meshStandardMaterial
                color={isFault ? '#f87171' : '#f97316'}
                emissive={isFault ? '#ef4444' : '#f97316'}
                emissiveIntensity={isFault ? 1.5 : 0.8}
              />
            </mesh>
          </group>
        ))}

        {/* High Voltage Transformer Core */}
        <mesh position={[0, 0.42, -0.4]}>
          <boxGeometry args={[0.9, 0.3, 0.4]} />
          <meshStandardMaterial color="#047857" metalness={0.6} />
        </mesh>
      </group>

      {/* ── Module 4: Cryogenic Fuel & Fluid Storage Tanks ── */}
      <group
        position={[1.2, 0.4, 2.2]}
        onPointerOver={(e) => { e.stopPropagation(); onHoverHotspot('fuel'); }}
        onPointerOut={() => onHoverHotspot(null)}
      >
        {/* Twin Cylindrical Tanks */}
        {[-0.35, 0.35].map((x, i) => (
          <mesh key={i} position={[x, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.35, 0.35, 0.9, 16]} />
            <meshStandardMaterial
              color="#cbd5e1"
              metalness={0.8}
              roughness={0.2}
              emissive={hoveredHotspot === 'fuel' ? '#10b981' : '#000000'}
              emissiveIntensity={hoveredHotspot === 'fuel' ? 0.2 : 0}
            />
          </mesh>
        ))}
        {/* Interconnecting Pipe manifold */}
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.8, 0.06, 0.06]} />
          <meshStandardMaterial color="#38d9f5" emissive="#38d9f5" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* ── Module 5: Photovoltaic Solar Farm Array ── */}
      <group
        onPointerOver={(e) => { e.stopPropagation(); onHoverHotspot('solar'); }}
        onPointerOut={() => onHoverHotspot(null)}
      >
        <SolarArray position={[-2.4, 0.3, -1.8]} isBlizzard={isBlizzard} />
      </group>

      {/* ── Module 6: Vertical-Axis Wind Turbines ── */}
      <group
        onPointerOver={(e) => { e.stopPropagation(); onHoverHotspot('wind'); }}
        onPointerOut={() => onHoverHotspot(null)}
      >
        <WindTurbine
          position={[2.8, 0, -1.8]}
          speed={isBlizzard ? 3.5 : 1.0}
        />
        <WindTurbine
          position={[3.8, 0, -0.6]}
          speed={isBlizzard ? 3.2 : 0.8}
        />
      </group>

      {/* ── Blizzard Particle System ── */}
      <BlizzardStorm active={isBlizzard} />

      {/* ── Dynamic Ambient Ground Lights ── */}
      <pointLight position={[-0.8, 0.2, 0]} intensity={isFault ? 0.3 : 1.2} color={glowColor} distance={4} />
      <pointLight position={[2.0, 0.2, 0]} intensity={1.0} color="#38d9f5" distance={4} />
      <pointLight position={[-1.2, 0.2, 2.0]} intensity={isFault ? 2.5 : 0.8} color={isFault ? '#ef4444' : '#10b981'} distance={3.5} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN EXPORTED COMPONENT: StationHologram3D
   ═══════════════════════════════════════════════════════ */
export function StationHologram3D({ isLight = false }: { isLight?: boolean }) {
  const [mode, setMode] = useState<HologramMode>('nominal');
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>('radome');
  const [autoRotate, setAutoRotate] = useState(true);

  const activeHotspot = hoveredHotspot ? HOTSPOTS[hoveredHotspot] : HOTSPOTS.radome;

  return (
    <div style={{
      width: '100%',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      position: 'relative',
      background: isLight
        ? 'radial-gradient(circle at 50% 30%, #e0f2fe 0%, #f1f5f9 60%, #e2e8f0 100%)'
        : 'radial-gradient(circle at 50% 30%, #0c192e 0%, #070d18 60%, #03060b 100%)',
      border: isLight ? '1.5px solid #cbd5e1' : '1px solid rgba(80, 219, 192, 0.25)',
      boxShadow: isLight
        ? '0 20px 45px -10px rgba(2, 132, 199, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.8) inset'
        : '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(80, 219, 192, 0.12) inset',
      height: '520px',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Top Header Controls & Mode Switcher ── */}
      <div style={{
        position: 'absolute',
        top: 16, left: 16, right: 16,
        zIndex: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        pointerEvents: 'none',
      }}>
        {/* Title badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(12, 16, 27, 0.85)',
          backdropFilter: 'blur(12px)',
          border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-sm)',
          pointerEvents: 'auto',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: mode === 'fault' ? '#ef4444' : mode === 'blizzard' ? '#38d9f5' : '#4ade80',
            boxShadow: `0 0 10px ${mode === 'fault' ? '#ef4444' : mode === 'blizzard' ? '#38d9f5' : '#4ade80'}`,
            animation: 'pulseDot 2s infinite'
          }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            3D Spatial Digital Twin · Live Model
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
            R3F / WebGL
          </span>
        </div>

        {/* Mode Selector Buttons */}
        <div style={{
          display: 'flex',
          gap: 6,
          background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(12, 16, 27, 0.85)',
          backdropFilter: 'blur(12px)',
          border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
          padding: 4,
          borderRadius: 'var(--radius-full)',
          pointerEvents: 'auto',
        }}>
          {[
            { id: 'nominal', label: 'Nominal State', icon: ShieldCheck, color: '#4ade80' },
            { id: 'blizzard', label: 'Katabatic Blizzard', icon: Wind, color: '#38d9f5' },
            { id: 'fault', label: 'Generator Trip', icon: AlertTriangle, color: '#f87171' },
          ].map(({ id, label, icon: Icon, color }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                onClick={() => setMode(id as HologramMode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: active ? (isLight ? '#0284c7' : 'var(--accent-primary)') : 'transparent',
                  color: active ? (isLight ? '#ffffff' : '#030a0f') : 'var(--text-secondary)',
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={13} style={{ color: active ? (isLight ? '#ffffff' : '#030a0f') : color }} />
                <span>{label}</span>
              </button>
            );
          })}

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? 'Pause Auto-Rotation' : 'Resume Auto-Rotation'}
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--radius-full)',
              background: autoRotate ? (isLight ? '#e0f2fe' : 'rgba(80, 219, 192, 0.15)') : 'transparent',
              color: autoRotate ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RotateCw size={13} style={{ animation: autoRotate ? 'spin 6s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── 3D Canvas Viewport ── */}
      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
          camera={{ position: [5.2, 4.0, 6.2], fov: 42 }}
          shadows
          style={{ width: '100%', height: '100%' }}
        >
          {/* Ambient Lighting */}
          <ambientLight intensity={isLight ? 1.0 : 0.65} />
          <directionalLight
            position={[8, 12, 6]}
            intensity={isLight ? 1.4 : 1.2}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#38d9f5" />
          <hemisphereLight args={['#38d9f5', '#0c101b', 0.4]} />

          {/* Model */}
          <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.15}>
            <StationModel
              mode={mode}
              hoveredHotspot={hoveredHotspot}
              onHoverHotspot={setHoveredHotspot}
            />
          </Float>

          {/* Controls */}
          <OrbitControls
            enableDamping
            dampingFactor={0.06}
            autoRotate={autoRotate}
            autoRotateSpeed={0.8}
            minDistance={4}
            maxDistance={12}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>

        {/* ── Floating Hover Telemetry HUD Overlay ── */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          maxWidth: 360,
          background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(10, 14, 24, 0.92)',
          backdropFilter: 'blur(16px)',
          border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(80, 219, 192, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          boxShadow: isLight ? '0 10px 25px rgba(0,0,0,0.08)' : '0 12px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: activeHotspot.color }}>
              {activeHotspot.category}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
              background: mode === 'fault' && activeHotspot.id === 'power' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(74, 222, 128, 0.15)',
              color: mode === 'fault' && activeHotspot.id === 'power' ? '#ef4444' : '#4ade80',
              border: `1px solid ${mode === 'fault' && activeHotspot.id === 'power' ? '#ef4444' : '#4ade80'}40`,
            }}>
              {mode === 'fault' && activeHotspot.id === 'power' ? 'OVERLOAD TRIP' : activeHotspot.status}
            </span>
          </div>

          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            {activeHotspot.name}
          </div>

          <div style={{
            fontSize: 11.5,
            fontFamily: 'monospace',
            color: 'var(--text-secondary)',
            background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.3)',
            padding: '5px 8px',
            borderRadius: 6,
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)'
          }}>
            {mode === 'fault' && activeHotspot.id === 'power'
              ? 'Bus Voltage: 34.2V (Under-voltage) · Temp: 98.5°C'
              : mode === 'blizzard' && activeHotspot.id === 'solar'
                ? 'Solar Irradiance: 0.0 W/m² (Blizzard Blackout)'
                : activeHotspot.metric}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 10.5, color: 'var(--text-tertiary)' }}>
            <Eye size={12} />
            <span>Hover or click components in 3D viewport to inspect live telemetry</span>
          </div>
        </div>

        {/* ── Viewport Hint Badge ── */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          fontSize: 11,
          fontFamily: 'monospace',
          color: isLight ? '#64748b' : 'rgba(255,255,255,0.5)',
          background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'none',
        }}>
          Orbit: Drag · Zoom: Scroll · Pan: Right-Click
        </div>
      </div>
    </div>
  );
}
