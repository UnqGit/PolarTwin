export function transformSensorArrays(topology: any[], connections: any[]) {
  const nodeMap = new Map(topology.map(n => [n.name, n]));
  
  // Find components that have multiple sensors connected to them
  const componentToSensors = new Map<string, string[]>();
  
  for (const c of connections) {
    const srcNode = nodeMap.get(c.source);
    const tgtNode = nodeMap.get(c.target);
    
    if (tgtNode && tgtNode.type === 'sensor' && srcNode && srcNode.type !== 'sensor') {
      if (!componentToSensors.has(c.source)) {
        componentToSensors.set(c.source, []);
      }
      if (!componentToSensors.get(c.source)!.includes(c.target)) {
        componentToSensors.get(c.source)!.push(c.target);
      }
    }
  }

  const sensorsToRemove = new Set<string>();
  const newNodes = [];
  const newConnections = [];
  const oldConnectionIndicesToRemove = new Set<number>();
  
  for (const [compId, sensorIds] of componentToSensors.entries()) {
    if (sensorIds.length > 0) {
      const arrayName = `${compId}Sensor`;
      const arrayNode = {
        name: arrayName,
        type: 'sensor array',
        parent: nodeMap.get(sensorIds[0])?.parent || nodeMap.get(compId)?.parent,
        groupedSensors: sensorIds.map(id => nodeMap.get(id)),
      };
      
      newNodes.push(arrayNode);
      sensorIds.forEach(id => sensorsToRemove.add(id));
      
      // Connection from Component to SensorArray
      newConnections.push({
        source: compId,
        target: arrayName,
        type: 'data',
        direction: '-->',
        id: `${compId}-${arrayName}-data`,
        groupedConnections: connections.filter(c => c.source === compId && sensorIds.includes(c.target))
      });
      
      const outDests = new Map<string, any[]>();
      
      connections.forEach((c, idx) => {
        if (sensorIds.includes(c.source)) {
           oldConnectionIndicesToRemove.add(idx);
           if (!outDests.has(c.target)) outDests.set(c.target, []);
           outDests.get(c.target)!.push(c);
        }
        if (c.source === compId && sensorIds.includes(c.target)) {
           oldConnectionIndicesToRemove.add(idx);
        }
      });
      
      for (const [destId, outConns] of outDests.entries()) {
        newConnections.push({
          source: arrayName,
          target: destId,
          type: outConns[0].type,
          direction: outConns[0].direction,
          id: `${arrayName}-${destId}-bus`,
          isBus: true,
          groupedConnections: outConns
        });
      }
    }
  }
  
  // Re-parent any other nodes that were children of the removed sensors (though unlikely for sensors)
  const finalTopology = topology.filter(n => !sensorsToRemove.has(n.name)).concat(newNodes);
  const finalConnections = connections.filter((_, idx) => !oldConnectionIndicesToRemove.has(idx)).concat(newConnections);
  
  return { finalTopology, finalConnections };
}
