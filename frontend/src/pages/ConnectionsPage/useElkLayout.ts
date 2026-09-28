import { useState, useEffect, useRef } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export function useElkLayout(
  allNodes: Map<string, any>, 
  collapsedNodes: Set<string>, 
  graphEdges: any[],
  showSensors: boolean
) {
  const [layoutCache, setLayoutCache] = useState<any>(null);
  const [isLayouting, setIsLayouting] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLayouting(true);

    const buildElkGraph = () => {
      // Create root elk node
      const elkGraph: any = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.layered.spacing.nodeNodeBetweenLayers': '60',
          'elk.spacing.nodeNode': '40',
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        },
        children: [],
        edges: []
      };

      // To build the compound graph, we need to only include nodes that are NOT descendants of a collapsed node.
      // A node is included if ALL its ancestors are NOT collapsed (excluding itself, a collapsed node is included but its children are not).
      const includedNodes = new Set<string>();
      
      allNodes.forEach((node, name) => {
        let curr = node.parentName;
        let shouldInclude = true;
        while (curr) {
          if (collapsedNodes.has(curr)) {
            shouldInclude = false;
            break;
          }
          curr = allNodes.get(curr)?.parentName;
        }
        if (shouldInclude) {
          includedNodes.add(name);
        }
      });

      // Build elk nodes structure
      const elkNodesMap = new Map<string, any>();
      
      includedNodes.forEach((name) => {
        const node = allNodes.get(name);
        const elkNode = {
          id: name,
          width: 200,  // Base width, auto-sized by children or fixed if leaf
          height: 80,  // Base height
          labels: [{ text: name }],
          layoutOptions: {
            'elk.padding': '[top=40,left=20,bottom=20,right=20]',
          },
          children: [] as any[]
        };
        elkNodesMap.set(name, elkNode);
      });

      // Link parents
      includedNodes.forEach((name) => {
        const node = allNodes.get(name);
        const elkNode = elkNodesMap.get(name);
        if (node.parentName && includedNodes.has(node.parentName)) {
          elkNodesMap.get(node.parentName).children.push(elkNode);
        } else {
          elkGraph.children.push(elkNode);
        }
      });

      // Add edges
      let edgeIdx = 0;
      graphEdges.forEach((edge) => {
        if (!showSensors && edge.isSensorLink) return; // skip sensor edges in layout if hidden
        
        elkGraph.edges.push({
          id: `e${edgeIdx++}`,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          originalEdge: edge
        });
      });

      return elkGraph;
    };

    const graph = buildElkGraph();

    elk.layout(graph).then((laidOutGraph: any) => {
      if (!active) return;
      
      const posMap = new Map<string, any>();
      const edgeRoutes = new Map<string, any>();

      const extractPositions = (n: any, offsetX = 0, offsetY = 0) => {
        const absX = offsetX + (n.x || 0);
        const absY = offsetY + (n.y || 0);
        
        if (n.id !== 'root') {
          posMap.set(n.id, { x: absX, y: absY, width: n.width, height: n.height });
        }
        if (n.children) {
          n.children.forEach((c: any) => extractPositions(c, absX, absY));
        }
      };
      
      extractPositions(laidOutGraph);
      
      if (laidOutGraph.edges) {
         laidOutGraph.edges.forEach((e: any) => {
           edgeRoutes.set(e.originalEdge.id, {
              sections: e.sections
           });
         });
      }

      setLayoutCache({
         nodes: posMap,
         edges: edgeRoutes,
         includedNodes: new Set(posMap.keys()),
         graphEdges
      });
      setIsLayouting(false);
    });

    return () => { active = false; };
  }, [allNodes, collapsedNodes, graphEdges, showSensors]);

  return { layoutCache, isLayouting };
}
