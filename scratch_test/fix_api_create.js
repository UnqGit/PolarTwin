const fs = require('fs');
let t = fs.readFileSync('frontend/src/lib/api.ts', 'utf8');
t = t.replace('${API_BASE}/stations//event-definitions/${eventId}', '${API_BASE}/stations/${stationId}/event-definitions/${eventId}');
fs.writeFileSync('frontend/src/lib/api.ts', t);
console.log('Fixed create API in api.ts');
