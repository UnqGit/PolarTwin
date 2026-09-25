/**
 * meshRegistry.ts
 *
 * Pure-data registry that maps component type substrings to mesh component keys.
 * Zero React / Three.js imports — can be unit-tested in plain Node / Vitest.
 *
 * ── How to add a new mesh ─────────────────────────────────────────────────────
 *   1. Create  src/components/meshes/MyNewMesh.tsx  implementing MeshProps
 *   2. Export it from  src/components/meshes/index.ts  and add to MESH_COMPONENT_MAP
 *   3. Call  registerMesh('type_keyword', 'MyNewMesh')  below
 *
 * The core layout algorithm (layout.ts) and renderer (TwinNodeRenderer.tsx) never
 * need to change when a new mesh type is introduced.
 */

export interface MeshEntry {
  /** Lowercase substring matched against the component type string. */
  match: string;
  /** Key into MESH_COMPONENT_MAP exported from src/components/meshes/index.ts. */
  componentKey: string;
}

const _registry: MeshEntry[] = [];

/**
 * Register a mesh component for a given type keyword.
 * Call this from the mesh file itself (or at startup) to extend the registry.
 * Registrations are checked in insertion order — register more specific keys first.
 */
export function registerMesh(match: string, componentKey: string): void {
  _registry.push({ match: match.toLowerCase(), componentKey });
}

/**
 * Returns the mesh component key for the given component type string.
 * Returns 'GenericMesh' for unknown types — never throws.
 */
export function lookupMesh(type: string): string {
  const t = (type || '').toLowerCase();
  for (const entry of _registry) {
    if (t.includes(entry.match)) return entry.componentKey;
  }
  return 'GenericMesh';
}

// ─── built-in registrations (more-specific matches first) ────────────────────

registerMesh('generator',    'GeneratorMesh');
registerMesh('tank',         'TankMesh');
registerMesh('pump',         'PumpMesh');
registerMesh('motor',        'PumpMesh');       // motor reuses the sphere-style pump mesh
registerMesh('battery',      'BatteryMesh');
registerMesh('sensor',       'SensorMesh');
registerMesh('thermometer',  'SensorMesh');
registerMesh('alarm',        'SensorMesh');
registerMesh('toggle',       'SensorMesh');
registerMesh('controller',   'ControllerMesh');
