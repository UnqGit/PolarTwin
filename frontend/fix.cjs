const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');
code = `const API_BASE = import.meta.env.VITE_API_URL || '/api';\n\n` + code;
code = code.replace(/'\/api\/(.*?)'/g, '`${API_BASE}/$1`');
code = code.replace(/`\/api\//g, '`${API_BASE}/');
fs.writeFileSync('src/lib/api.ts', code);
