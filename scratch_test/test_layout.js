import { buildSceneLayout } from './layout';
import * as fs from 'fs';
import * as path from 'path';
const basePath = path.resolve(__dirname, '../../../../data/compiled/maitri');
const rel = JSON.parse(fs.readFileSync(path.join(basePath, 'relation.json'), 'utf8'));
const conn = JSON.parse(fs.readFileSync(path.join(basePath, 'connection.json'), 'utf8'));
const spec = JSON.parse(fs.readFileSync(path.join(basePath, 'spec.json'), 'utf8'));
const layout = buildSceneLayout(rel, conn, spec);
const mains = layout.connections.filter(c => c.source === 'MainController' || c.target === 'MainController');
console.log('Connections built in layout for MainController:', mains.length);
console.log('Total input connections for MainController:', conn.filter(c => c.source === 'MainController' || c.target === 'MainController').length);
const builtIds = new Set(mains.map(c => `${c.source}--${c.target}`));
const missing = conn
    .filter(c => c.source === 'MainController' || c.target === 'MainController')
    .filter(c => !builtIds.has(`${c.source}--${c.target}`) && !builtIds.has(`${c.target}--${c.source}`));
console.log('Missing connections:', missing);
