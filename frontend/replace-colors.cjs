const fs = require('fs');
const path = require('path');

const colorMap = {
  'rgba(15, 23, 42, 0.95)': 'var(--bg-panel)',
  'rgba(15,23,42,0.95)': 'var(--bg-panel)',
  'rgba(15, 23, 42, 1)': 'var(--bg-panel-solid)',
  'rgba(15,23,42,0.5)': 'var(--bg-input)',
  'rgba(255,255,255,0.08)': 'var(--border-color)',
  'rgba(255,255,255,0.1)': 'var(--border-color)',
  'rgba(255,255,255,0.05)': 'var(--hover-overlay)',
  'rgba(255,255,255,0.04)': 'var(--hover-overlay)',
  '#0f172a': 'var(--bg-main)',
  '#1e293b': 'var(--bg-panel-secondary)',
  '#f8fafc': 'var(--text-primary)',
  '#e2e8f0': 'var(--text-primary)',
  '#94a3b8': 'var(--text-secondary)',
  '#cbd5e1': 'var(--text-secondary)',
  '#475569': 'var(--text-tertiary)',
  '#64748b': 'var(--text-tertiary)',
  '#334155': 'var(--border-solid)',
  '#3b82f6': 'var(--accent-blue)',
  '#38bdf8': 'var(--accent-blue)',
  '#2563eb': 'var(--accent-blue)',
  '#22d3ee': 'var(--accent-cyan)',
  '#fbbf24': 'var(--accent-amber)'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [hex, variable] of Object.entries(colorMap)) {
    // Escape regex characters just in case
    const safeHex = hex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`['"]${safeHex}['"]`, 'gi');
    content = content.replace(regex, `'${variable}'`);
    
    // Also handle cases where it's part of a larger string, like borders
    // e.g. '1px solid #334155'
    const bareRegex = new RegExp(safeHex, 'gi');
    // But only if we are inside quotes? For react styles it's usually strings.
    // So let's just do a global replace for the bare hex as well.
    // Wait, replacing bare strings is dangerous if it matches other things.
    // Since hex codes are unique, it's mostly safe except rgba.
    content = content.replace(bareRegex, variable);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      // Don't modify TwinNodeRenderer or materials directly blindly as they might be used in 3D (WebGL needs hex!)
      // Wait, WebGL components (TwinNodeRenderer, materials, TwinViewer) need exact Hex values!
      // I should only run this on UI components!
      if (!['TwinViewer.tsx', 'TwinNodeRenderer.tsx', 'ConnectionRenderer.tsx', 'materials.ts'].includes(path.basename(fullPath))) {
        processFile(fullPath);
      }
    }
  }
}

walkDir(path.join(__dirname, 'src', 'components'));

processFile(path.join(__dirname, 'src', 'App.tsx'));
