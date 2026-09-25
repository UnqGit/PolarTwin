import React from 'react';
import { HoverCard } from './HoverCard';
import { PropertyInspector } from './PropertyInspector';
import { useSelection } from './SelectionContext';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';
import { Focus } from 'lucide-react';

interface RightUIStackProps {
  children?: React.ReactNode;
  root: NodeLayout;
  connections: ConnectionLayout[];
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
  rightOffset?: number;
  bottomOffset?: number;
}

function findNode(root: NodeLayout, name: string): NodeLayout | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

export const RightUIStack: React.FC<RightUIStackProps> = ({ children, root, connections, liveStateRef, rightOffset = 20, bottomOffset = 20 }) => {
  const { selectedName } = useSelection();
  
  let selectedNode = null;
  if (selectedName) {
    selectedNode = findNode(root, selectedName);
  }

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: rightOffset,
      bottom: bottomOffset,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      pointerEvents: 'none', // Allow clicking through empty space
      overflowY: 'auto',
      overflowX: 'hidden',
      maxWidth: `calc(40vw + 40px)`,
      transition: 'right 0.3s ease, bottom 0.3s ease',
    }}>
      {/* 1. HUD / Viewer Info (passed as children) */}
      <div style={{ pointerEvents: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        {children}
      </div>

      {/* 2. Hover Card */}
      <div style={{ pointerEvents: 'auto', flexShrink: 0 }}>
        <HoverCard root={root} connections={connections} liveStateRef={liveStateRef} />
      </div>

      {/* 3. Selected Inspector */}
      {selectedNode && (
        <div style={{ pointerEvents: 'auto', minHeight: 0, overflow: 'hidden' }}>
          <PropertyInspector node={selectedNode} connections={connections} liveStateRef={liveStateRef} />
        </div>
      )}
    </div>
  );
};
