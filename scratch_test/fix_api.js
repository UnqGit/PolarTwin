const fs = require('fs');
let t = fs.readFileSync('frontend/src/lib/api.ts', 'utf8');
t = t.replace('${API_BASE}/stations//event-definitions', '${API_BASE}/stations/${stationId}/event-definitions');
fs.writeFileSync('frontend/src/lib/api.ts', t);
console.log('Fixed api.ts');
