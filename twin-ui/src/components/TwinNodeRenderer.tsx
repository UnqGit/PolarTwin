/**
 * TwinNode.tsx
 *
 * Renders one node from the pre-computed NodeLayout tree.
 * Each node is identified by its stable component `name`, never an array index.
 *
 * Containers (station / block / system) render as a translucent slab so
 * their children are visible through them.  Every node — leaf or container —
 * always has a floating text label with its name.
 */

import React, { useState, useMemo } from 'react';
import { Text, Html } from '@react-three/drei';
import type { NodeLayout } from '../lib/layout';
import { resolveMaterial, isContainer } from '../lib/materials';
import { GeneratorMesh } from './GeneratorMesh';

// ─── component mesh selection ─────────────────────────────────────────────────

interface LeafMeshProps {
  layout: NodeLayout;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
}

const LeafMesh: React.FC<LeafMeshProps> = ({ layout, color, metalness, roughness, opacity, transparent }) => {
  const { type, dims } = layout;
  const t = (type || '').toLowerCase();
  const { width: w, height: h, depth: d } = dims;

  if (t.includes('generator')) {
    return (
      <GeneratorMesh dims={dims} color={color} metalness={metalness} roughness={roughness} />
    );
  }

  if (t.includes('tank')) {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[Math.min(w, d) / 2, Math.min(w, d) / 2, h, 24]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>
    );
  }

  if (t.includes('pump') || t.includes('motor')) {
    return (
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[Math.min(w, h, d) / 2, 20, 20]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>
    );
  }

  if (t.includes('sensor') || t.includes('thermometer') || t.includes('alarm') || t.includes('toggle')) {
    // Small device box — use dims as-is
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
      </mesh>
    );
  }

  // Generic fallback
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} opacity={opacity} transparent={transparent} />
    </mesh>
  );
};

// ─── container slab ───────────────────────────────────────────────────────────

interface ContainerMeshProps {
  dims: { width: number; height: number; depth: number };
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
}

const ContainerMesh: React.FC<ContainerMeshProps> = ({ dims, color, metalness, roughness, opacity }) => (
  <mesh receiveShadow position={[0, dims.height / 2, 0]}>
    <boxGeometry args={[dims.width, dims.height, dims.depth]} />
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      opacity={opacity}
      transparent
      depthWrite={false}
    />
  </mesh>
);

// ─── hover preview panel ──────────────────────────────────────────────────────

interface HoverInfoProps {
  layout: NodeLayout;
  liveState: Record<string, unknown>;
  visible: boolean;
  totalHeight: number;
}

const HoverInfo: React.FC<HoverInfoProps> = ({ layout, liveState, visible, totalHeight }) => {
  if (!visible) return null;

  const state = (liveState?.[layout.name] ?? {}) as Record<string, unknown>;
  const metrics = Object.entries(state)
    .filter(([k]) => k !== 'inputs')
    .slice(0, 4);

  return (
    <Html position={[0, totalHeight + 0.8, 0]} center style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(15,15,20,0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(147,197,253,0.3)',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#f1f5f9',
        minWidth: 160,
        maxWidth: 220,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#93c5fd', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
          {layout.name}
        </div>
        <div style={{ color: '#94a3b8', marginBottom: 4, fontSize: 11 }}>
          type: <span style={{ color: '#cbd5e1' }}>{layout.type}</span>
        </div>
        {metrics.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
            {metrics.map(([k, v]) => (
              <React.Fragment key={k}>
                <span style={{ color: '#64748b', fontSize: 10 }}>{k}</span>
                <span style={{ color: '#e2e8f0' }}>
                  {typeof v === 'number' ? v.toFixed(2) : String(v)}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>no live data</div>
        )}
      </div>
    </Html>
  );
};

// ─── main component ───────────────────────────────────────────────────────────

interface TwinNodeRendererProps {
  layout: NodeLayout;
  liveState: Record<string, unknown>;
}

export const TwinNodeRenderer: React.FC<TwinNodeRendererProps> = ({ layout, liveState }) => {
  const [hovered, setHovered] = useState(false);

  const state = (liveState?.[layout.name] ?? {}) as Record<string, unknown>;
  const failed = (state as any).running === false;

  const mat = useMemo(
    () => resolveMaterial(layout.type, { hovered, failed }),
    [layout.type, hovered, failed]
  );

  const container = isContainer(layout.type) && layout.children.length > 0;

  // Total visual height for placing the label above the mesh.
  const totalHeight = layout.dims.height + (container ? 0.3 : 0);

  return (
    <group
      position={layout.position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e)  => { e.stopPropagation(); setHovered(false); }}
    >
      {container ? (
        <ContainerMesh
          dims={layout.dims}
          color={hovered ? '#93c5fd' : mat.color}
          metalness={mat.metalness}
          roughness={mat.roughness}
          opacity={mat.opacity}
        />
      ) : (
        /* Leaf mesh — placed so its base sits at y=0 */
        <group position={[0, layout.dims.height / 2, 0]}>
          <LeafMesh
            layout={layout}
            color={mat.color}
            metalness={mat.metalness}
            roughness={mat.roughness}
            opacity={mat.opacity}
            transparent={mat.transparent}
          />
        </group>
      )}

      {/* Always-visible name label */}
      <Text
        position={[0, totalHeight + 0.35, 0]}
        fontSize={0.22}
        color={hovered ? '#93c5fd' : '#e2e8f0'}
        anchorX="center"
        anchorY="bottom"
        outlineColor="#0f172a"
        outlineWidth={0.012}
        renderOrder={1}
      >
        {layout.name}
      </Text>

      {/* Hover detail panel */}
      <HoverInfo
        layout={layout}
        liveState={liveState}
        visible={hovered}
        totalHeight={totalHeight}
      />

      {/* Recursively render children */}
      {layout.children.map((child) => (
        <TwinNodeRenderer key={child.name} layout={child} liveState={liveState} />
      ))}
    </group>
  );
};
