import { TYPE_MATERIALS, GENERIC_MATERIAL } from '../../lib/materials';

export function resolveColor(type: string): string {
  const t = (type || '').toLowerCase();
  for (const { match, mat } of TYPE_MATERIALS) {
    if (t.includes(match)) return mat.color;
  }
  return GENERIC_MATERIAL.color;
}
