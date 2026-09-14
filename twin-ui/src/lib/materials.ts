/**
 * materials.ts
 *
 * Type-based material/visual-style mapping.
 * Returns deterministic { color, metalness, roughness, opacity } per component
 * type.  Systems/containers get a translucent style.
 * All colours are neutral/industrial greys unless the node is failed or hovered.
 */

export interface MaterialProps {
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
}

/** Base material for each component type.  Ordered by specificity. */
const TYPE_MATERIALS: Array<{ match: string; mat: MaterialProps }> = [
  // containers / systems
  { match: 'campus',  mat: { color: '#2a2a3a', metalness: 0.1, roughness: 0.9, opacity: 0.08, transparent: true } },
  { match: 'station', mat: { color: '#3a3a4a', metalness: 0.1, roughness: 0.9, opacity: 0.12, transparent: true } },
  { match: 'block',   mat: { color: '#3a4a3a', metalness: 0.1, roughness: 0.9, opacity: 0.12, transparent: true } },
  { match: 'system',  mat: { color: '#4a4a5a', metalness: 0.1, roughness: 0.9, opacity: 0.12, transparent: true } },
  // leaf machinery
  { match: 'generator',   mat: { color: '#6b7280', metalness: 0.6, roughness: 0.4, opacity: 1, transparent: false } },
  { match: 'battery',     mat: { color: '#4b5563', metalness: 0.5, roughness: 0.5, opacity: 1, transparent: false } },
  { match: 'motor',       mat: { color: '#374151', metalness: 0.7, roughness: 0.3, opacity: 1, transparent: false } },
  { match: 'pump',        mat: { color: '#52525b', metalness: 0.6, roughness: 0.4, opacity: 1, transparent: false } },
  { match: 'tank',        mat: { color: '#71717a', metalness: 0.4, roughness: 0.6, opacity: 1, transparent: false } },
  // electronics / control
  { match: 'controller',  mat: { color: '#3b4252', metalness: 0.3, roughness: 0.7, opacity: 1, transparent: false } },
  { match: 'sensor',      mat: { color: '#4a6278', metalness: 0.4, roughness: 0.6, opacity: 1, transparent: false } },
  { match: 'thermometer', mat: { color: '#4a6278', metalness: 0.4, roughness: 0.6, opacity: 1, transparent: false } },
  { match: 'alarm',       mat: { color: '#7f1d1d', metalness: 0.2, roughness: 0.8, opacity: 1, transparent: false } },
  { match: 'toggle',      mat: { color: '#1e3a5f', metalness: 0.3, roughness: 0.7, opacity: 1, transparent: false } },
];

const GENERIC_MATERIAL: MaterialProps = {
  color: '#5a5a6a', metalness: 0.3, roughness: 0.7, opacity: 1, transparent: false,
};

export function resolveMaterial(
  type: string,
  options: { hovered?: boolean; failed?: boolean; selected?: boolean } = {}
): MaterialProps {
  const t = (type || '').toLowerCase();

  let base: MaterialProps = GENERIC_MATERIAL;
  for (const { match, mat } of TYPE_MATERIALS) {
    if (t.includes(match)) { base = mat; break; }
  }

  if (options.failed) {
    return { ...base, color: '#7f1d1d', opacity: base.opacity, transparent: base.transparent };
  }
  if (options.hovered) {
    // Light blue for hover
    return { ...base, color: '#93c5fd', opacity: base.opacity, transparent: base.transparent };
  }
  if (options.selected) {
    // Bright cyan for selected (persistent glow)
    return { ...base, color: '#22d3ee', opacity: base.opacity, transparent: base.transparent };
  }

  return base;
}

/** Returns true when this type should render as a translucent container. */
export function isContainer(type: string): boolean {
  const t = (type || '').toLowerCase();
  return t.includes('campus') || t.includes('station') || t.includes('block') || t.includes('system');
}
