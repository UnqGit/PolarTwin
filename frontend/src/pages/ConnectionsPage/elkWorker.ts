import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = (e) => {
  const { allNodesArray, collapsedNodesArray, graphEdges, showSensors } = e.data;
  
  const allNodes = new Map(allNodesArray);
  const collapsedNodes = new Set(collapsedNodesArray);
  
  const elkGraph: any = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.thoroughness': '50',
      'elk.portConstraints': 'FIXED_SIDE',
      'elk.spacing.edgeEdge': '24',
      'elk.spacing.edgeNode': '32',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '24',
      'elk.layered.spacing.nodeNodeBetweenLayers': '64',
      'elk.spacing.nodeNode': '48',
    },
    children: [],
    edges: []
  };

  const includedNodes = new Set<string>();
  
  allNodes.forEach((node: any, name: string) => {
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

  const elkNodesMap = new Map<string, any>();
  
  includedNodes.forEach((name) => {
    const node = allNodes.get(name);
    
    const hasIncludedChildren = Array.from(includedNodes).some((childName) => {
      const childNode = allNodes.get(childName);
      return childNode?.parentName === name;
    });
    
    const isLeaf = !hasIncludedChildren;
    const labelWidth = name.length * 8 + 32;
    
    const elkNode: any = {
      id: name,
      labels: [{ text: name }],
      layoutOptions: {
        'elk.padding': '[top=40,left=24,bottom=24,right=24]',
      }
    };
    
    if (isLeaf) {
      elkNode.width = Math.max(120, labelWidth);
      elkNode.height = 60;
    } else {
      elkNode.children = [];
    }
    
    elkNodesMap.set(name, elkNode);
  });

  includedNodes.forEach((name) => {
    const node = allNodes.get(name);
    const elkNode = elkNodesMap.get(name);
    if (node.parentName && includedNodes.has(node.parentName)) {
      elkNodesMap.get(node.parentName).children.push(elkNode);
    } else {
      elkGraph.children.push(elkNode);
    }
  });

  let edgeIdx = 0;

  graphEdges.forEach((edge: any) => {
    if (!showSensors && edge.isSensorLink) return;
    
    if (includedNodes.has(edge.source) && includedNodes.has(edge.target)) {
      
      const sPortId = `p_s_${edgeIdx}`;
      const tPortId = `p_t_${edgeIdx}`;
      
      const sNode = elkNodesMap.get(edge.source);
      const tNode = elkNodesMap.get(edge.target);
      
      // Initialize ports array if not present
      if (!sNode.ports) sNode.ports = [];
      if (!tNode.ports) tNode.ports = [];
      
      sNode.ports.push({ id: sPortId, layoutOptions: { 'elk.port.side': 'EAST' } });
      tNode.ports.push({ id: tPortId, layoutOptions: { 'elk.port.side': 'WEST' } });
      
      elkGraph.edges.push({
        id: `e_${edgeIdx}`,
        source: edge.source,
        sourcePort: sPortId,
        target: edge.target,
        targetPort: tPortId,
        type: edge.type,
        originalEdge: edge,
      });
      edgeIdx++;
    }
  });

  elk.layout(elkGraph).then((laidOutGraph: any) => {
    self.postMessage({ type: 'SUCCESS', laidOutGraph });
  }).catch((err: any) => {
    self.postMessage({ type: 'ERROR', error: err.toString() });
  });
};
