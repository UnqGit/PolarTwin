import fs from 'fs';
import { buildSceneLayout } from './src/lib/layout';

const twins = ['maitri', 'new_station'];

for (const twin of twins) {
  console.log(`\n=== Testing ${twin} ===`);
  const spec = JSON.parse(fs.readFileSync(`./src/data/twins/${twin}/spec.json`, 'utf-8'));
  const relation = JSON.parse(fs.readFileSync(`./src/data/twins/${twin}/relation.json`, 'utf-8'));

  const layout = buildSceneLayout(relation, spec);
  
  const totalConns = relation.connections?.length || 0;
  const validConns = layout.connections.length;
  console.log(`Connections: ${validConns} / ${totalConns} routed successfully.`);

  for (const conn of layout.connections) {
    if (conn.path.length === 0) {
      console.log(`❌ ERROR: Empty path for ${conn.id}`);
    } else {
      console.log(`✅ ${conn.id} [${conn.connectionType}] routed with ${conn.path.length} points.`);
      console.log(`   Elevation: ${conn.path[0][1]}`);
    }
  }
}
