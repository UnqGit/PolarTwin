const fs = require('fs');

let apiTs = fs.readFileSync('frontend/src/lib/api.ts', 'utf8');
apiTs = apiTs.replace(/getEventDefinitionSource: async \(name: string\)/g, 'getEventDefinitionSource: async (eventId: string)');
apiTs = apiTs.replace(/updateEventDefinitionSource: async \(name: string/g, 'updateEventDefinitionSource: async (eventId: string');
apiTs = apiTs.replace(/deleteEventDefinition: async \(name: string\)/g, 'deleteEventDefinition: async (eventId: string)');
apiTs = apiTs.replace(/\/event-definitions\/\$\{name\}/g, '/event-definitions/${eventId}');
fs.writeFileSync('frontend/src/lib/api.ts', apiTs);

let scenariosTs = fs.readFileSync('frontend/src/pages/ScenariosPage.tsx', 'utf8');
scenariosTs = scenariosTs.replace(/setSelectedEventDefId\(e\.name\)/g, 'setSelectedEventDefId(e.id)');
fs.writeFileSync('frontend/src/pages/ScenariosPage.tsx', scenariosTs);

console.log('Fixed api.ts and ScenariosPage.tsx');
