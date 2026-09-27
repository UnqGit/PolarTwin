const fs = require('fs');

function patch(filePath, replaceFn) {
  let c = fs.readFileSync(filePath, 'utf8');
  c = replaceFn(c);
  fs.writeFileSync(filePath, c);
}

patch('c:/Users/anand/OneDrive/Documents/Repositories/PolarTwin/frontend/src/pages/ScenariosPage.tsx', (c) => {
  // Pass selectedStation
  c = c.replace(/api\.getEventDefinitions\(\)\.then\(setEventDefs\)/g, "if (selectedStation) api.getEventDefinitions(selectedStation).then(setEventDefs)");

  // Fix saveSource unsave mark
  c = c.replace(/setSavedScenarioSource\(cleanSource\);/g, "setScenarioSource(cleanSource); setSavedScenarioSource(cleanSource);");

  // Keep timeline editor
  c = c.replace(/setRunId\(null\);\r?\n\s*setSimStatus\('Ready'\);\r?\n\s*setScenarioEvents\(\[\]\);/g, "// keep scenario running");
  c = c.replace(/setSelectedScenarioId\(null\);\r?\n\s*setBottomTab\('source'\);/g, "setBottomTab('source');");

  // Add deselect button
  c = c.replace(/<\/select>/, `</select>\n          <button onClick={() => { setSelectedScenarioId(null); setScenarioEvents([]); setRunId(null); setSimStatus('Ready'); if (editingType === 'scenario') setScenarioSource(''); }} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Deselect</button>`);

  // Delete instance from timeline header
  c = c.replace(/{selectedComponentName && \(/, `{selectedEvent && editingType === 'scenario' && (
              <button 
                onClick={() => handleDeleteEventFromTimeline(selectedEvent)} 
                style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
              >
                Delete Instance
              </button>
            )}
            {selectedComponentName && (`);

  // Switch to scenario mode on dropdown change
  c = c.replace(/onChange={e => setSelectedScenarioId\(e\.target\.value \|\| null\)}/g, `onChange={e => { setSelectedScenarioId(e.target.value || null); setEditingType('scenario'); }}`);

  return c;
});

patch('c:/Users/anand/OneDrive/Documents/Repositories/PolarTwin/frontend/src/components/EventInspector.tsx', (c) => {
  c = c.replace(/setEditSelector\(event\.selector \|\| ''\);/, `setEditSelector(event.selector ? (event.selector.startsWith('@') ? event.selector.slice(1) : event.selector) : '');`);
  
  c = c.replace(/if \(editSelector\.trim\(\)\) {\s*snippet \+= \` \$\{editSelector\.trim\(\)\}\`;\s*}/, `if (editSelector.trim()) {
      let sel = editSelector.trim();
      if (!sel.startsWith('@') && !sel.startsWith('"') && !sel.startsWith("'") && sel !== 'all') {
        sel = '@' + sel;
      }
      snippet += \` \${sel}\`;
    }`);
  return c;
});

console.log('Done patching files');
