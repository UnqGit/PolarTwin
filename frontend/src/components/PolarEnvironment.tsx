import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BakeShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useTwinVisual } from './TwinVisualContext';
import { useTheme } from './ThemeContext';

/* ── Volumetric Polar Blizzard Storm Particles ─────────────────── */
function BlizzardStorm({ active }: { active: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 1600;

  // Precompute random particle states: initial positions, fall speeds, swirl frequencies, and phases
  const [positions, particleData] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    // [fallSpeed, driftSpeed, phaseX, phaseZ, freq]
    const data = new Float32Array(count * 5);

    for (let i = 0; i < count; i++) {
      const s1 = Math.sin(i * 12.9898 + 1.234) * 43758.5453;
      const r1 = s1 - Math.floor(s1);
      const s2 = Math.sin(i * 78.233 + 4.567) * 43758.5453;
      const r2 = s2 - Math.floor(s2);
      const s3 = Math.sin(i * 37.719 + 8.912) * 43758.5453;
      const r3 = s3 - Math.floor(s3);
      const s4 = Math.sin(i * 53.179 + 3.141) * 43758.5453;
      const r4 = s4 - Math.floor(s4);

      // Broad 3D volume covering camera viewport and entire station
      pos[i * 3] = (r1 - 0.5) * 160;      // X: -80 to +80
      pos[i * 3 + 1] = r2 * 50 + 0.2;     // Y: 0.2 to 50
      pos[i * 3 + 2] = (r3 - 0.5) * 160;  // Z: -80 to +80

      data[i * 5] = r1 * 2.2 + 1.6;       // fall speed: 1.6 to 3.8
      data[i * 5 + 1] = r2 * 3.5 + 3.0;   // base wind drift: 3.0 to 6.5
      data[i * 5 + 2] = r3 * Math.PI * 2; // phaseX
      data[i * 5 + 3] = r4 * Math.PI * 2; // phaseZ
      data[i * 5 + 4] = r1 * 1.5 + 0.8;   // frequency
    }
    return [pos, data];
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current || !active) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = state.clock.getElapsedTime();
    // Gentle macro wind gust
    const gustX = Math.sin(time * 0.35) * 1.8;
    const gustZ = Math.cos(time * 0.25) * 1.2;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const dIdx = i * 5;
      const fallSpd = particleData[dIdx];
      const driftSpd = particleData[dIdx + 1];
      const phaseX = particleData[dIdx + 2];
      const phaseZ = particleData[dIdx + 3];
      const freq = particleData[dIdx + 4];

      // Swirling harmonic turbulence (curling eddy motion instead of parallel lines)
      const swirlX = Math.sin(time * freq + phaseX) * 2.2;
      const swirlZ = Math.cos(time * freq * 0.85 + phaseZ) * 2.0;
      const flutterY = Math.sin(time * 1.8 + phaseX) * 0.4;

      // Update positions with natural variable drift
      pos[idx] += (driftSpd + gustX + swirlX) * delta;
      pos[idx + 1] -= (fallSpd + flutterY) * delta;
      pos[idx + 2] += (swirlZ + gustZ) * delta;

      // Continuous volumetric wrap-around with randomized reinjection
      if (pos[idx + 1] < 0.2) {
        pos[idx + 1] = 48 + Math.sin(i + time) * 2;
        pos[idx] = (Math.sin(i * 17.3 + time) * 0.5) * 160;
        pos[idx + 2] = (Math.cos(i * 29.1 + time) * 0.5) * 160;
      }
      if (pos[idx] > 80) {
        pos[idx] = -80;
        pos[idx + 1] = Math.random() * 45 + 5;
      }
      if (pos[idx + 2] > 80) {
        pos[idx + 2] = -80;
      } else if (pos[idx + 2] < -80) {
        pos[idx + 2] = 80;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.24}
        color="#e0f2fe"
        transparent
        opacity={0.78}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/* ── Perimeter Snow Marker Poles with Synchronous Strobe Beacon ── */
function PerimeterBeacons() {
  const beaconLightRef = useRef<THREE.Group>(null);
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // 8 Perimeter markers placed along the station boundary
  const markerPositions: [number, number, number][] = useMemo(
    () => [
      [-36, 0, -36],
      [0, 0, -42],
      [36, 0, -36],
      [42, 0, 0],
      [36, 0, 36],
      [0, 0, 42],
      [-36, 0, 36],
      [-42, 0, 0],
    ],
    []
  );

  useFrame((state) => {
    // Sharp Antarctic aviation beacon pulse (double strobe every 2 seconds)
    const t = state.clock.elapsedTime % 2.0;
    const isFlash = (t > 0.05 && t < 0.18) || (t > 0.32 && t < 0.45);
    if (flashMatRef.current) {
      flashMatRef.current.color.set(isFlash ? '#f97316' : '#7c2d12');
    }
  });

  return (
    <group ref={beaconLightRef}>
      {markerPositions.map(([x, y, z], i) => (
        <group key={`marker-${i}`} position={[x, y, z]}>
          {/* Support Mast (Orange/White warning segments) */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 2.4, 8]} />
            <meshStandardMaterial color="#ea580c" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Reflective White Middle Band */}
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.4, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.2} />
          </mesh>
          {/* Top Strobe Lamp */}
          <mesh position={[0, 2.45, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.16, 8]} />
            <meshBasicMaterial ref={flashMatRef} color="#f97316" />
          </mesh>
          {/* Protective Cage Wire */}
          <mesh position={[0, 2.45, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.18, 6]} />
            <meshStandardMaterial color="#475569" wireframe />
          </mesh>
          {/* Snow Footing Mound */}
          <mesh position={[0, 0.1, 0]}>
            <coneGeometry args={[0.6, 0.25, 12]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── 3D Polar Compass Rose ────────────────────────────────────── */
function PolarCompassRose({ position = [0, 0.01, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Outer Radar Azimuth Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[14.8, 15.0, 64]} />
        <meshBasicMaterial color="#38bdf8" opacity={0.35} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[29.8, 30.0, 64]} />
        <meshBasicMaterial color="#38bdf8" opacity={0.25} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[44.8, 45.0, 64]} />
        <meshBasicMaterial color="#38bdf8" opacity={0.15} transparent side={THREE.DoubleSide} />
      </mesh>

      {/* Crosshairs & Diagonal Spokes */}
      {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((angle, i) => (
        <group key={`spoke-${i}`} rotation={[0, angle, 0]}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([-45, 0.02, 0, 45, 0.02, 0]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#38bdf8" opacity={0.18} transparent />
          </line>
        </group>
      ))}

      {/* True North Arrow Indicator (Pointing along -Z) */}
      <group position={[0, 0.03, -15.8]}>
        {/* Red North Needle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.5, 1.4, 3]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* Cardinal Labels Placed at Ring Edge */}
      {/* North */}
      <mesh position={[0, 0.04, -17.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 0.9]} />
        <meshBasicMaterial color="#ef4444" opacity={0.9} transparent />
      </mesh>
      {/* South */}
      <mesh position={[0, 0.04, 16.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.0, 0.6]} />
        <meshBasicMaterial color="#0284c7" opacity={0.5} transparent />
      </mesh>
      {/* East */}
      <mesh position={[16.5, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.0, 0.6]} />
        <meshBasicMaterial color="#0284c7" opacity={0.5} transparent />
      </mesh>
      {/* West */}
      <mesh position={[-16.5, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.0, 0.6]} />
        <meshBasicMaterial color="#0284c7" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}

/* ── Polar Station Ground & Ice Shelf Plinth ──────────────────── */
function PolarTerrain({ theme }: { theme: 'light' | 'dark' }) {
  const isDark = theme === 'dark';
  const snowColor = isDark ? '#0c1527' : '#eaf2f8';
  const plinthColor = isDark ? '#111e38' : '#cbd5e1';
  const gridColor = isDark ? '#1e293b' : '#94a3b8';

  return (
    <group position={[0, -0.05, 0]}>
      {/* ── 1. Vast Antarctic Ice Shelf Foundation Plane ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]} receiveShadow>
        <planeGeometry args={[300, 300, 60, 60]} />
        <meshStandardMaterial
          color={snowColor}
          metalness={0.15}
          roughness={0.8}
        />
      </mesh>

      {/* ── 2. Raised Polar Compound Apron / Heavy Concrete-Ice Plinth ── */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[90, 0.2, 90]} />
        <meshStandardMaterial
          color={plinthColor}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* Perimeter Hazard Bevels around the Station Apron */}
      {[-45, 45].map((x, i) => (
        <mesh key={`apron-edge-x-${i}`} position={[x, 0.02, 0]}>
          <boxGeometry args={[0.3, 0.04, 90]} />
          <meshBasicMaterial color="#38bdf8" opacity={0.4} transparent />
        </mesh>
      ))}
      {[-45, 45].map((z, i) => (
        <mesh key={`apron-edge-z-${i}`} position={[0, 0.02, z]}>
          <boxGeometry args={[90, 0.04, 0.3]} />
          <meshBasicMaterial color="#38bdf8" opacity={0.4} transparent />
        </mesh>
      ))}

      {/* ── 3. Technical Coordinate Markers (Schirmacher Oasis, Maitri) ── */}
      <group position={[-38, 0.06, 40]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 2.2]} />
          <meshBasicMaterial color="#0b172a" opacity={0.7} transparent />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[13.6, 1.8]} />
          <meshBasicMaterial color="#0284c7" opacity={0.15} transparent />
        </mesh>
      </group>

      {/* ── 4. Tactical Radar Rings and Grid ── */}
      <PolarCompassRose />
      <PerimeterBeacons />

      {/* Subtle fine topographical grid lines */}
      <gridHelper
        args={[100, 50, gridColor, gridColor]}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}

/* ── Main Polar Atmosphere & Scene Lighting Component ─────────── */
export interface PolarEnvironmentProps {
  lightingMode?: 'dynamic' | 'static' | 'off';
}

export const PolarEnvironment: React.FC<PolarEnvironmentProps> = ({ lightingMode = 'dynamic' }) => {
  const { atmosphereMode, weatherEnabled } = useTwinVisual();
  const { theme } = useTheme();
  const { scene, gl } = useThree();

  useEffect(() => {
    if (lightingMode === 'dynamic') {
      gl.shadowMap.autoUpdate = true;
      gl.shadowMap.needsUpdate = true;
    } else if (lightingMode === 'static') {
      gl.shadowMap.autoUpdate = false;
      gl.shadowMap.needsUpdate = true;
    }
  }, [lightingMode, gl]);

  // Configure fog and background dynamically based on atmosphere preset
  useEffect(() => {
    if (atmosphereMode === 'polar_day') {
      const bgColor = theme === 'dark' ? '#080e1c' : '#dbeafe';
      const fogColor = theme === 'dark' ? '#080e1c' : '#bfdbfe';
      scene.background = new THREE.Color(bgColor);
      scene.fog = new THREE.FogExp2(fogColor, 0.007);
    } else if (atmosphereMode === 'aurora_night') {
      const bgColor = '#02050f';
      scene.background = new THREE.Color(bgColor);
      scene.fog = new THREE.FogExp2('#03081a', 0.009);
    } else {
      // tactical_dark
      const bgColor = '#05070e';
      scene.background = new THREE.Color(bgColor);
      scene.fog = new THREE.FogExp2('#060914', 0.008);
    }
  }, [atmosphereMode, theme, scene]);

  const hasShadows = lightingMode !== 'off';

  return (
    <>
      {/* ── Frozen Static Shadows if lightingMode === 'static' ── */}
      {lightingMode === 'static' && <BakeShadows />}

      {/* ── Lighting Mode Presets ── */}
      {lightingMode === 'off' ? (
        <>
          <ambientLight intensity={1.1} color={atmosphereMode === 'aurora_night' ? '#065f46' : '#bae6fd'} />
          <directionalLight position={[20, 28, 20]} intensity={0.5} color="#f8fafc" />
          <hemisphereLight args={['#bae6fd', '#0f172a', 0.4]} />
        </>
      ) : (
        <>
          {atmosphereMode === 'polar_day' && (
            <>
              <ambientLight intensity={0.5} color="#bae6fd" />
              {/* Low-angle Arctic Sun (Altitude ~25°) */}
              <directionalLight
                position={[30, 20, 25]}
                intensity={1.7}
                color="#fffbeb"
                castShadow={hasShadows}
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0001}
              />
              {/* Cold Blue Ice Bounce Fill Light */}
              <directionalLight position={[-25, 12, -20]} intensity={0.5} color="#38bdf8" />
              <hemisphereLight args={['#bae6fd', '#0f172a', 0.4]} />
            </>
          )}

          {atmosphereMode === 'aurora_night' && (
            <>
              <ambientLight intensity={0.3} color="#065f46" />
              {/* Cold Lunar Light */}
              <directionalLight
                position={[25, 30, -20]}
                intensity={0.8}
                color="#a7f3d0"
                castShadow={hasShadows}
                shadow-mapSize={[2048, 2048]}
              />
              {/* Ethereal Emerald Aurora Glow */}
              <directionalLight position={[-20, 15, 20]} intensity={0.6} color="#34d399" />
              <hemisphereLight args={['#064e3b', '#020617', 0.5]} />

              {/* Overhead Aurora Borealis Curved Ribbons */}
              <group position={[0, 40, -10]} rotation={[0.2, 0.4, 0]}>
                <mesh>
                  <cylinderGeometry args={[45, 55, 14, 32, 1, true, 0, Math.PI]} />
                  <meshBasicMaterial
                    color="#10b981"
                    transparent
                    opacity={0.18}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>
                <mesh position={[0, 2, -4]}>
                  <cylinderGeometry args={[48, 58, 12, 32, 1, true, 0.2, Math.PI * 0.9]} />
                  <meshBasicMaterial
                    color="#06b6d4"
                    transparent
                    opacity={0.15}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>
              </group>
            </>
          )}

          {atmosphereMode === 'tactical_dark' && (
            <>
              <ambientLight intensity={0.6} color="#38bdf8" />
              <directionalLight
                position={[20, 28, 20]}
                intensity={1.2}
                color="#f8fafc"
                castShadow={hasShadows}
                shadow-mapSize={[2048, 2048]}
              />
              <directionalLight position={[-20, 15, -15]} intensity={0.4} color="#0284c7" />
              <hemisphereLight args={['#0284c7', '#030712', 0.35]} />
            </>
          )}
        </>
      )}

      {/* ── Ground & Antarctic Ice Shelf Plinth ── */}
      <PolarTerrain theme={theme} />

      {/* ── Blizzard Snow Storm Particles ── */}
      <BlizzardStorm active={weatherEnabled} />
    </>
  );
};
