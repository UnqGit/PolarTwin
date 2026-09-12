/**
 * layout.ts
 *
 * Dimension resolution and recursive child-layout engine for the 3D twin
 * visualization.  This module contains NO React or Three.js imports so it
 * can be unit-tested in a plain Vitest / Node environment.
 *
 * Priority for dimension resolution (per the plan, §32.8):
 *   1. Explicit dimensions from spec.json  { width, height, depth }
 *   2. Type-specific defaults
 *   3. Inferred from children (containers)
 *   4. Generic fallback
 */

// ─── public types ────────────────────────────────────────────────────────────

export interface Dims {
  width: number;
  height: number;
  depth: number;
}

export interface NodeLayout {
  /** stable identity – component name from topology */
  name: string;
  type: string;
  dims: Dims;
  /** centre position relative to the parent group origin */
  position: [number, number, number];
  children: NodeLayout[];
  /** raw spec object forwarded from spec.json */
  spec: Record<string, unknown>;
  tags: string[];
}

// ─── constants ───────────────────────────────────────────────────────────────

const CHILD_GAP = 0.6;   // spacing between siblings inside a container
const PADDING   = 0.8;   // extra space added around children when sizing parent
const CONTAINER_EXTRA_HEIGHT = 0.5; // container mesh is a bit taller than content

/** Type-specific leaf dimensions (used when no explicit dims are in spec). */
const TYPE_DEFAULTS: Record<string, Dims> = {
  generator:   { width: 2.4, height: 1.8, depth: 1.6 },
  sensor:      { width: 0.6, height: 0.6, depth: 0.6 },
  controller:  { width: 1.2, height: 0.8, depth: 1.0 },
  battery:     { width: 1.0, height: 1.6, depth: 0.8 },
  motor:       { width: 1.2, height: 1.2, depth: 1.4 },
  pump:        { width: 1.0, height: 1.0, depth: 1.0 },
  tank:        { width: 1.4, height: 2.0, depth: 1.4 },
  alarm:       { width: 0.5, height: 0.5, depth: 0.3 },
  toggle:      { width: 0.4, height: 0.4, depth: 0.2 },
  thermometer: { width: 0.5, height: 0.5, depth: 0.3 },
  system:      { width: 4.0, height: 2.0, depth: 4.0 },
  block:       { width: 6.0, height: 2.0, depth: 6.0 },
  station:     { width: 8.0, height: 2.0, depth: 8.0 },
};

const GENERIC_FALLBACK: Dims = { width: 1.0, height: 1.0, depth: 1.0 };

// ─── helpers ─────────────────────────────────────────────────────────────────

function resolveTypeDefault(type: string): Dims {
  const t = (type || '').toLowerCase();
  for (const [key, dims] of Object.entries(TYPE_DEFAULTS)) {
    if (t.includes(key)) return { ...dims };
  }
  return { ...GENERIC_FALLBACK };
}

function resolveExplicitDims(spec: Record<string, unknown>): Dims | null {
  const d = (spec as any).dimensions;
  if (!d) return null;
  const w = typeof d.width  === 'number' ? d.width  : null;
  const h = typeof d.height === 'number' ? d.height : null;
  const dp = typeof d.depth  === 'number' ? d.depth  : null;
  if (w === null || h === null || dp === null) return null;
  return { width: w, height: h, depth: dp };
}

/**
 * Grid-pack children in the XZ plane.
 *
 * Returns a list of { x, z } centre offsets (relative to the group origin),
 * plus the total packed width and depth (before padding).
 */
function gridPack(childDims: Dims[]): { offsets: { x: number; z: number }[]; packedWidth: number; packedDepth: number } {
  if (childDims.length === 0) {
    return { offsets: [], packedWidth: 0, packedDepth: 0 };
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(childDims.length)));
  const rows = Math.ceil(childDims.length / cols);

  // Compute per-column widths (max width in each column) and
  // per-row depths (max depth in each row).
  const colWidths: number[]  = Array(cols).fill(0);
  const rowDepths: number[]  = Array(rows).fill(0);

  childDims.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colWidths[col] = Math.max(colWidths[col], d.width);
    rowDepths[row] = Math.max(rowDepths[row], d.depth);
  });

  // Compute column X starts (left edges from 0) and row Z starts.
  const colX: number[] = [];
  let cx = 0;
  colWidths.forEach((w) => { colX.push(cx + w / 2); cx += w + CHILD_GAP; });
  const rowZ: number[] = [];
  let rz = 0;
  rowDepths.forEach((d) => { rowZ.push(rz + d / 2); rz += d + CHILD_GAP; });

  const totalWidth = cx - CHILD_GAP;
  const totalDepth = rz - CHILD_GAP;

  // Centre the entire grid at origin.
  const offsets = childDims.map((_, i) => ({
    x: colX[i % cols] - totalWidth / 2,
    z: rowZ[Math.floor(i / cols)] - totalDepth / 2,
  }));

  return { offsets, packedWidth: totalWidth, packedDepth: totalDepth };
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * Recursively build a NodeLayout tree from raw topology / spec JSON.
 *
 * @param node   - A node from the topology (relation.json) tree.
 * @param spec   - The entire specification object (spec.json).
 */
export function buildLayout(node: any, spec: any): NodeLayout {
  const name: string = node.name ?? '(unnamed)';
  const type: string = node.type ?? '';
  const tags: string[] = node.tags ?? [];
  const rawSpec: Record<string, unknown> = (spec?.components?.[name]?.spec) ?? {};
  const rawChildren: any[] = node.children ?? [];

  // Recursively build children first so we know their dims.
  const children: NodeLayout[] = rawChildren.map((c: any) => buildLayout(c, spec));

  // ── Resolve this node's dimensions ──────────────────────────────────────
  let dims: Dims;

  const explicit = resolveExplicitDims(rawSpec);
  if (explicit) {
    dims = explicit;
  } else if (children.length > 0) {
    // Container: infer from packed children.
    const { packedWidth, packedDepth } = gridPack(children.map((c) => c.dims));
    dims = {
      width:  packedWidth  + PADDING * 2,
      height: CONTAINER_EXTRA_HEIGHT,          // thin slab at y=0; children float above
      depth:  packedDepth  + PADDING * 2,
    };
  } else {
    dims = resolveTypeDefault(type);
  }

  // ── Position children inside this node ──────────────────────────────────
  if (children.length > 0) {
    const { offsets } = gridPack(children.map((c) => c.dims));
    const childY = dims.height / 2 + 0.01;  // sit just above the container floor
    offsets.forEach(({ x, z }, i) => {
      children[i].position = [x, childY + children[i].dims.height / 2, z];
    });
  }

  return {
    name,
    type,
    dims,
    position: [0, 0, 0],   // will be overwritten by the parent's layout pass
    children,
    spec: rawSpec,
    tags,
  };
}
