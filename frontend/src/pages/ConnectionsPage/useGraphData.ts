import { useMemo, useState } from 'react';
import type { NodeLayout, ConnectionLayout, NodeInfo } from '../../lib/layout';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  isBus: boolean;
  count: number;
  originalEdges: ConnectionLayout[];
  isSensorLink: boolean;
}

export function useGraphData(root: NodeLayout, rawConnections: ConnectionLayout[]) {
  // 1. Build flattened node map and parent map
  const allNodes = useMemo(() => {
    const map = new Map<string, NodeInfo>();
    function visit(node: NodeLayout, parentName?: string) {
      map.set(node.name, {
        name: node.name,
        type: node.type,
        parentName,
      } as any);
      for (const child of node.children) {
        visit(child, node.name);
      }
    }
    if (root) visit(root);
    return map;
  }, [root]);

  // 2. Compute default collapsed state (blocks are visible but collapsed)
  // hierarchy: campus -> station -> floor -> block -> system -> leaf
  // Everything below block should be collapsed.
  const initialCollapsed = useMemo(() => {
    const collapsed = new Set<string>();
    allNodes.forEach((node) => {
      const type = (node.type || '').toLowerCase();
      if (type === 'block') {
        collapsed.add(node.name);
      }
    });
    return collapsed;
  }, [allNodes]);

  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(initialCollapsed);
  const [showSensors, setShowSensors] = useState(false);

  // Helper to determine the visible ancestor of any node given the collapsed state
  const getVisibleAncestor = (nodeName: string): string => {
    let curr = nodeName;
    let visible = curr;
    while (curr) {
      const node = allNodes.get(curr);
      if (!node) break;
      if (collapsedNodes.has(curr)) {
        visible = curr; // This container is collapsed, so anything inside it surfaces to here
      }
      curr = node.parentName || '';
    }
    return visible;
  };

  const isAncestor = (child: string, ancestor: string): boolean => {
    let curr = allNodes.get(child)?.parentName;
    while (curr) {
      if (curr === ancestor) return true;
      curr = allNodes.get(curr)?.parentName;
    }
    return false;
  };

  // 3. Lift and Aggregate Edges
  const graphEdges = useMemo(() => {
    const edges: GraphEdge[] = [];
    const busMap = new Map<string, GraphEdge>();

    rawConnections.forEach(conn => {
      const srcVisible = getVisibleAncestor(conn.source);
      const tgtVisible = getVisibleAncestor(conn.target);

      // Cull internal edges and ancestor loops
      if (srcVisible === tgtVisible) return;
      if (isAncestor(srcVisible, tgtVisible) || isAncestor(tgtVisible, srcVisible)) return;

      const isSensorLink = 
        allNodes.get(conn.source)?.type.toLowerCase() === 'sensor' || 
        allNodes.get(conn.target)?.type.toLowerCase() === 'sensor';

      const type = conn.connectionType || 'unknown';
      const key = `${srcVisible}->${tgtVisible}::${type}`;

      if (!busMap.has(key)) {
        busMap.set(key, {
          id: key,
          source: srcVisible,
          target: tgtVisible,
          type: type,
          isBus: false,
          count: 0,
          originalEdges: [],
          isSensorLink: true, // will be ANDed
        });
      }

      const bus = busMap.get(key)!;
      bus.count++;
      bus.originalEdges.push(conn);
      bus.isBus = bus.count > 1;
      bus.isSensorLink = bus.isSensorLink && isSensorLink;
    });

    return Array.from(busMap.values());
  }, [rawConnections, collapsedNodes, allNodes]);

  return {
    allNodes,
    collapsedNodes,
    setCollapsedNodes,
    showSensors,
    setShowSensors,
    graphEdges
  };
}
