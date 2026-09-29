import fs from 'fs';
import { buildSceneLayout } from './frontend/src/lib/layout';

const spec = JSON.parse(fs.readFileSync('./data/compiled/Maitri/spec.json', 'utf-8'));
const connections = JSON.parse(fs.readFileSync('./data/compiled/Maitri/connection.json', 'utf-8'));
const hierarchy = JSON.parse(fs.readFileSync('./data/compiled/Maitri/hierarchy.json', 'utf-8'));

try {
  const layout = buildSceneLayout(hierarchy, connections, spec);
  const node = layout.allNodes.get('temp_sensor_main');
  console.log(node ? "Success node found" : "Node not found");
} catch(e) {
  console.error("Crash:", e.message);
}
