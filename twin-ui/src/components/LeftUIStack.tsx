import React from 'react';
import { HoverCard } from './HoverCard';
import { PropertyInspector } from './PropertyInspector';
import { useSelection } from './SelectionContext';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';

interface LeftUIStackProps {
  children?: React.ReactNode;
  root: NodeLayout;
  connections: ConnectionLayout[];
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
}

function findNode(root: NodeLayout, name: string): NodeLayout | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

export const LeftUIStack: React.FC<LeftUIStackProps> = ({ children, root, connections, liveStateRef }) => {
  const { selectedName } = useSelection();
  
  let selectedNode = null;
  if (selectedName) {
    selectedNode = findNode(root, selectedName);
  }

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      pointerEvents: 'none', // Allow clicking through empty space
    }}>
      {/* 1. HUD / Viewer Info (passed as children) */}
      <div style={{ pointerEvents: 'auto' }}>
        {children}
      </div>

      {/* 2. Hover Card */}
      <div style={{ pointerEvents: 'auto' }}>
        <HoverCard root={root} connections={connections} liveStateRef={liveStateRef} />
      </div>

      {/* 3. Selected Inspector */}
      {selectedNode && (
        <div style={{ pointerEvents: 'auto' }}>
          <PropertyInspector node={selectedNode} connections={connections} liveStateRef={liveStateRef} />
        </div>
      )}
    </div>
  );
};
