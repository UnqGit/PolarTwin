import React, { useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { EmbeddedOverview } from './EmbeddedOverview';
import * as THREE from 'three';

interface TwinNodeProps {
  node: any;
  specification: any;
  liveState: any;
  position?: [number, number, number];
}

const isEmbeddedType = (type: string) => {
  const t = (type || "").toLowerCase();
  return t.includes('sensor') || t.includes('thermometer') || t.includes('controller') || t.includes('toggle') || t.includes('alarm');
};

const GenericModel = ({ type, color }: { type: string, color: string }) => {
  const t = (type || "").toLowerCase();
  if (t.includes('generator') || t.includes('system') || t.includes('block')) {
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
    );
  }
  if (t.includes('tank')) {
    return (
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <cylinderGeometry args={[1, 1, 2, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.8} />
      </mesh>
    );
  }
  if (t.includes('pump') || t.includes('hvac')) {
    return (
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.5} />
      </mesh>
    );
  }
  // Fallback box
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

export const TwinNode: React.FC<TwinNodeProps> = ({ node, specification, liveState, position = [0, 0, 0] }) => {
  const [hovered, setHovered] = useState(false);

  // Group children into standalone vs embedded
  const standaloneChildren: any[] = [];
  const embeddedChildren: any[] = [];
  
  (node.children || []).forEach((child: any) => {
    if (isEmbeddedType(child.type)) {
      embeddedChildren.push(child);
    } else {
      standaloneChildren.push(child);
    }
  });

  // Calculate layout for standalone children
  // Arrange them in a grid or line based on count
  const childSpacing = 4;
  const colCount = Math.max(1, Math.ceil(Math.sqrt(standaloneChildren.length)));
  
  // State formatting
  const state = liveState?.[node.name] || {};
  const isFailed = state.running === false && !(node.type || "").toLowerCase().includes('block');
  const baseColor = isFailed ? '#ff4444' : (hovered ? '#66b2ff' : '#4488cc');

  // Check if specification has a model
  const spec = specification?.components?.[node.name]?.spec;
  const modelUrl = spec?.model_url;

  return (
    <group position={position}>
      <group 
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        {/* Render 3D Model */}
        {modelUrl ? (
          <Model url={modelUrl} />
        ) : (
          <GenericModel type={node.type} color={baseColor} />
        )}
        
        {/* Render Embedded Overview on hover */}
        <EmbeddedOverview 
          embeddedNodes={embeddedChildren} 
          liveState={liveState} 
          visible={hovered} 
        />
      </group>

      {/* Render Standalone Children */}
      {standaloneChildren.map((child, i) => {
        const x = (i % colCount) * childSpacing - ((colCount - 1) * childSpacing) / 2;
        const z = Math.floor(i / colCount) * childSpacing;
        
        return (
          <TwinNode
            key={child.name}
            node={child}
            specification={specification}
            liveState={liveState}
            position={[x, -2, z]} // Position children below or around
          />
        );
      })}
    </group>
  );
};

const Model = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
};
