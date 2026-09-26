/**
 * layout.ts
 *
 * Dimension resolution and recursive child-layout engine for the 3D twin
 * visualization.  No React / Three.js imports — pure TypeScript that can be
 * unit-tested in a plain Vitest / Node environment.
 *
 * ── Dimension resolution priority ────────────────────────────────────────────
 *   1. Flat spec keys (NOT nested under a "dimensions" object):
 *        height                — vertical size
 *        width  OR  breadth    — horizontal width (mutually exclusive)
 *        length                — horizontal depth → mapped to "depth" internally
 *      All three must be present.  If both "width" and "breadth" are found,
 *      a warning is logged and the resolution falls through to the next level.
 *   2. Type-specific defaults  (TYPE_DEFAULTS map)
 *   3. Inferred from children  (containers only)
 *   4. Generic fallback        (1 × 1 × 1)
 *
 * ── Container sizing ─────────────────────────────────────────────────────────
 *   height = max(child heights) + PADDING   (tall enough to enclose tallest child)
 *   width  = packed child widths  + PADDING * 2
 *   depth  = packed child depths  + PADDING * 2
 *
 * ── Child placement ──────────────────────────────────────────────────────────
 *   Children are positioned at Y = 0 within their parent group.
 *   Each mesh component places its own geometry so its bottom sits at local Y = 0.
 *   → no child can accidentally float below the ground plane.
 *
 * ── Connection visual category (pure, no hardcoded component names) ──────────
 *   Determined solely from the type-tier of source and target:
 *     station × station → road
 *     block   × block   → hallway
 *     leaf    × leaf    → wire
 *     mixed             → none
 *
 * ── Connection routing ───────────────────────────────────────────────────────
 *   Connections are now wall-to-wall, ground-level, multi-segment orthogonal
 *   paths computed by an A* router on a discrete XZ grid.
 *
 *   Key properties:
 *     • startPos/endPos replaced by path: [number,number,number][]
 *     • All waypoints have Y = GROUND_Y (= 0)
 *     • Source/target attach to the nearest outer wall of each component
 *     • Obstacles (component bounding boxes) inflate by OBSTACLE_MARGIN before
 *       the router treats them as blocked cells
 *     • Connection overlap cost nudges routes apart without over-engineering
 */

// ─── public types ─────────────────────────────────────────────────────────────

export interface Dims {
  width: number;
  height: number;
  depth: number;
}

export interface NodeLayout {
  /** Stable identity — component name from topology. */
  name: string;
  type: string;
  dims: Dims;
  /**
   * Position of this node's group origin relative to its parent group origin.
   * Overwritten by the parent's layout pass; the root always stays at [0,0,0].
   */
  position: [number, number, number];
  children: NodeLayout[];
  /** Raw spec object forwarded from spec.json for this component. */
  spec: Record<string, unknown>;
  tags: string[];
  level?: number;
  yOffset?: number; // local vertical offset for the container mesh (e.g., to enclose basements)
}

// ConnectionVisual removed
export interface ConnectionLayout {
  /** Stable id built from source + target names, e.g. "Generator--Controller". */
  id: string;
  source: string;
  target: string;
  /**
   * Ground-level, wall-to-wall orthogonal path.
   * Each point is [x, y, z] with y = GROUND_Y.
   * Contains at least 2 points (source wall → target wall).
   * May contain intermediate waypoints for obstacle avoidance.
   */
  path: [number, number, number][];
  profile: ConnectionProfile;
  /** Raw connection type from topology, e.g. "data" or "passageway". */
  connectionType: string;
  /** Relation field representing specific edge type (e.g., "power_line"). */
  relation: string;
  /** Directionality string from topology, e.g. "-->". */
  direction: string;
  // Legacy aliases kept so ConnectionRenderer can migrate gradually
  startPos: [number, number, number];
  endPos: [number, number, number];
}

export interface SceneLayout {
  root: NodeLayout;
  connections: ConnectionLayout[];
  allNodes: Map<string, NodeInfo>;
}

// ─── constants ────────────────────────────────────────────────────────────────

const PADDING = 0.8;   // extra space added around children when sizing parent
const LEVEL_SPACING = 3.0; // vertical spacing between semantic floor levels

/** Y coordinate of the ground / connection plane.
 *  gridHelper sits at Y = -0.02 so ground is definitively Y = 0. */
const GROUND_Y = 0;

/** Margin added around each component AABB when treating it as a routing obstacle.
 *  Reduced to 0.1 to allow tight routing between components without choking gaps. */
const OBSTACLE_MARGIN = 0.1;

/** Grid cell size in world units for the A* router. */
const GRID_CELL = 0.4;

/** Extra bends are acceptable but gently penalised. */
const BEND_COST = 2;

/** Cost for entering a cell that overlaps with an existing connection path.
 *  Secondary — avoidance is preferable but not mandatory. */
const OVERLAP_COST = 0;

/**
 * Type-specific leaf dimensions.
 * Used when no explicit flat dims are found in spec.json and the node has no children.
 * Keys are matched as substrings of the component type (case-insensitive).
 */
const TYPE_DEFAULTS: Record<string, Dims> = {
  generator: { width: 2.4, height: 1.8, depth: 1.6 },
  sensor: { width: 0.6, height: 0.6, depth: 0.6 },
  controller: { width: 1.2, height: 0.8, depth: 1.0 },
  battery: { width: 1.0, height: 1.6, depth: 0.8 },
  motor: { width: 1.2, height: 1.2, depth: 1.4 },
  pump: { width: 1.0, height: 1.0, depth: 1.0 },
  tank: { width: 1.4, height: 2.0, depth: 1.4 },
  alarm: { width: 0.5, height: 0.5, depth: 0.3 },
  toggle: { width: 0.4, height: 0.4, depth: 0.2 },
  thermometer: { width: 0.5, height: 0.5, depth: 0.3 },
};

const GENERIC_FALLBACK: Dims = { width: 1.0, height: 1.0, depth: 1.0 };

export interface ConnectionProfile {
  width: number;
  height: number | 'min-block'; // 'min-block' means stretch to layout block height
  elevation: number | 'ground'; // 'ground' means y=0, else float at Y = elevation
  clearance: number;            // A* penalty radius
  color?: string;
}

export const CONNECTION_PROFILES: Record<string, ConnectionProfile> = {
  // New schema connection types
  passageway: { width: 1.0, height: 'min-block', elevation: 'ground', clearance: 3.0, color: '#64748b' }, // slate
  resource: { width: 0.2, height: 0.2, elevation: 0.1, clearance: 1.0, color: '#ef4444' }, // red
  data: { width: 0.1, height: 0.1, elevation: 0.05, clearance: 0.8, color: '#3b82f6' }, // blue
  signal: { width: 0.1, height: 0.1, elevation: 0.05, clearance: 0.8, color: '#eab308' }, // yellow
  
  // Synthetic / Generated connections
  ladder: { width: 0.6, height: 0.1, elevation: 0, clearance: 1.0, color: '#b45309' }, // orange-brown
  lift: { width: 1.2, height: 1.2, elevation: 0, clearance: 1.0, color: '#475569' }, // dark slate
  
  // Default fallback for unknown types
  default: { width: 0.1, height: 0.1, elevation: 0.05, clearance: 1.0, color: '#6b7280' },
};

export function getProfile(type: string): ConnectionProfile {
  return CONNECTION_PROFILES[type] || CONNECTION_PROFILES['default'];
}

// ─── dimension helpers ────────────────────────────────────────────────────────

function resolveTypeDefault(type: string): Dims {
  const t = (type || '').toLowerCase();
  for (const [key, dims] of Object.entries(TYPE_DEFAULTS)) {
    if (t.includes(key)) return { ...dims };
  }
  return { ...GENERIC_FALLBACK };
}

/**
 * Reads explicit flat dimension keys from a component's spec object.
 *
 * Accepted keys (all at the top level of the spec, NOT inside a sub-object):
 *   height   — vertical size
 *   width    — horizontal width   (mutually exclusive with "breadth")
 *   breadth  — horizontal width   (mutually exclusive with "width")
 *   length   — horizontal depth   (mapped to internal "depth")
 *
 * Returns null if:
 *   - Any required key is missing.
 *   - Both "width" and "breadth" are present (logs a warning).
 */
function resolveExplicitDims(spec: Record<string, unknown>): Dims | null {
  const height = typeof spec.height === 'number' ? spec.height : null;
  const length = typeof spec.length === 'number' ? spec.length : null;

  const hasWidth = typeof spec.width === 'number';
  const hasBreadth = typeof spec.breadth === 'number';

  if (hasWidth && hasBreadth) {
    console.warn(
      '[PolarTwin] Both "width" and "breadth" found in component spec — ambiguous; falling back to type defaults.'
    );
    return null;
  }

  const width = hasWidth ? (spec.width as number) : hasBreadth ? (spec.breadth as number) : null;

  if (height === null || length === null || width === null) return null;
  return { width, height, depth: length };
}

// ─── grid-pack layout ─────────────────────────────────────────────────────────

/**
 * Grid-packs children in the XZ plane.
 * Returns per-child {x, z} centre offsets (relative to the group origin at 0,0,0)
 * and total packed width / depth.
 */
function gridPack(childDims: Dims[], gap: number = 0.6): {
  offsets: { x: number; z: number }[];
  packedWidth: number;
  packedDepth: number;
} {
  if (childDims.length === 0) {
    return { offsets: [], packedWidth: 0, packedDepth: 0 };
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(childDims.length)));
  const rows = Math.ceil(childDims.length / cols);

  // Per-column max widths and per-row max depths.
  const colWidths: number[] = Array(cols).fill(0);
  const rowDepths: number[] = Array(rows).fill(0);
  childDims.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colWidths[col] = Math.max(colWidths[col], d.width);
    rowDepths[row] = Math.max(rowDepths[row], d.depth);
  });

  // Column X-centre starts and row Z-centre starts.
  const colX: number[] = [];
  let cx = 0;
  colWidths.forEach((w) => { colX.push(cx + w / 2); cx += w + gap; });
  const rowZ: number[] = [];
  let rz = 0;
  rowDepths.forEach((d) => { rowZ.push(rz + d / 2); rz += d + gap; });

  const totalWidth = cx - gap;
  const totalDepth = rz - gap;

  // Centre the grid at origin.
  const offsets = childDims.map((_, i) => ({
    x: colX[i % cols] - totalWidth / 2,
    z: rowZ[Math.floor(i / cols)] - totalDepth / 2,
  }));

  return { offsets, packedWidth: totalWidth, packedDepth: totalDepth };
}

// ─── connection helpers ───────────────────────────────────────────────────────

type TypeTier = 'station' | 'block' | 'leaf';

function classifyTypeTier(type: string): TypeTier {
  const t = (type || '').toLowerCase();
  if (t.includes('station')) return 'station';
  if (t.includes('block')) return 'block';
  return 'leaf';
}

// ConnectionVisual removed as we use getProfile now.

// ─── world-space node info ────────────────────────────────────────────────────

export interface NodeInfo {
  name: string;
  parentName: string | null;
  /** Set of all ancestor names, including parent, up to root */
  ancestors: Set<string>;
  /** World-space position of the group origin (bottom-centre of this node). */
  worldOrigin: [number, number, number];
  /** World-space AABB min/max on XZ plane. */
  xMin: number; xMax: number;
  zMin: number; zMax: number;
  type: string;
  dims: Dims;
}

/**
 * Recursively traverses the NodeLayout tree to build a flat map of
 *   component name → NodeInfo
 *
 * worldOrigin = accumulated world-space group origin (bottom of the node box).
 * The node's AABB on the XZ plane is:
 *   [worldOrigin.x - w/2, worldOrigin.x + w/2] × [worldOrigin.z - d/2, worldOrigin.z + d/2]
 */
function buildNodeMap(
  node: NodeLayout,
  parentWorldOrigin: [number, number, number] = [0, 0, 0],
  parentName: string | null = null,
  parentAncestors: Set<string> = new Set(),
): Map<string, NodeInfo> {
  const map = new Map<string, NodeInfo>();

  const ox = parentWorldOrigin[0] + node.position[0];
  const oy = parentWorldOrigin[1] + node.position[1];
  const oz = parentWorldOrigin[2] + node.position[2];

  const w = node.dims.width;
  const d = node.dims.depth;

  const ancestors = new Set(parentAncestors);
  if (parentName) ancestors.add(parentName);

  map.set(node.name, {
    name: node.name,
    parentName,
    ancestors,
    worldOrigin: [ox, oy, oz],
    xMin: ox - w / 2,
    xMax: ox + w / 2,
    zMin: oz - d / 2,
    zMax: oz + d / 2,
    type: node.type,
    dims: node.dims,
  });

  for (const child of node.children) {
    buildNodeMap(child, [ox, oy, oz], node.name, ancestors).forEach((v, k) => map.set(k, v));
  }
  return map;
}

// ─── wall attachment point ────────────────────────────────────────────────────

/**
 * Computes the point on the outer wall of `from` that faces toward `to`,
 * at ground level (Y = GROUND_Y).
 *
 * Strategy: project the vector from→to onto the 4 face normals of `from`
 * and pick the face with the highest dot product (i.e. the face most aligned
 * with the direction toward `to`).  The attachment point is the centre of
 * that face.
 */
export interface AttachPoint {
  pt: [number, number, number];
  normal: [number, number];
}

function wallAttachPoint(from: NodeInfo, to: NodeInfo): AttachPoint {
  // Direction from `from` centre to `to` centre on the XZ plane.
  const dx = (to.worldOrigin[0]) - (from.worldOrigin[0]);
  const dz = (to.worldOrigin[2]) - (from.worldOrigin[2]);

  // The four candidate face centres (world space, ground level) and their normals.
  const candidates: AttachPoint[] = [
    { pt: [from.xMax, GROUND_Y, from.worldOrigin[2]], normal: [1, 0] },  // +X face (east wall)
    { pt: [from.xMin, GROUND_Y, from.worldOrigin[2]], normal: [-1, 0] },  // -X face (west wall)
    { pt: [from.worldOrigin[0], GROUND_Y, from.zMax], normal: [0, 1] },  // +Z face (south wall)
    { pt: [from.worldOrigin[0], GROUND_Y, from.zMin], normal: [0, -1] },  // -Z face (north wall)
  ];
  // Dot products with direction vector.
  const dots = [dx, -dx, dz, -dz];
  let bestIdx = 0;
  for (let i = 1; i < 4; i++) {
    if (dots[i] > dots[bestIdx]) bestIdx = i;
  }
  return candidates[bestIdx];
}

// ─── A* orthogonal router ─────────────────────────────────────────────────────

/** Axis-aligned bounding box (on XZ plane) for obstacle detection. */
interface AABB {
  xMin: number; xMax: number;
  zMin: number; zMax: number;
}

function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

/**
 * Checks whether a world-space point (wx, wz) is inside any inflated AABB obstacle.
 * The source and target nodes are excluded from obstacle testing.
 */
function isInsideAny(wx: number, wz: number, obstacles: AABB[]): boolean {
  for (const obs of obstacles) {
    if (wx >= obs.xMin && wx <= obs.xMax &&
      wz >= obs.zMin && wz <= obs.zMax) {
      return true;
    }
  }
  return false;
}

/**
 * A* path-finder on an orthogonal grid.
 *
 * @param startW   World-space start point [x, z] (wall of source component)
 * @param endW     World-space end point [x, z] (wall of target component)
 * @param obstacles Inflated AABBs to treat as blocked
 * @param usedCells Set of already-used grid cell keys (for overlap penalty)
 * @param bounds   Search bounds to limit grid size: { xMin, xMax, zMin, zMax }
 * @param allNodes Map of all nodes
 * @param lcaName  Name of Lowest Common Ancestor
 * @param onlyLeaves Whether to only treat leaf nodes as obstacles
 * @param srcName  Source node name to exclude
 * @param tgtName  Target node name to exclude
 * @param usedCells Set of already-used grid cell keys (for overlap penalty)
 *
 * Returns an array of world-space [x, z] waypoints (including start and end),
 * or null if no path was found within the search area.
 */
function aStarRoute(
  srcAncestors: Set<string>,
  tgtAncestors: Set<string>,
  startW: [number, number],
  endW: [number, number],
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number },
  allNodes: Map<string, NodeInfo>,
  lcaName: string | null,
  onlyLeaves: boolean = false,
  srcName?: string,
  tgtName?: string,
  usedCells: Set<string> = new Set(),
): [number, number][] | null {

  // Build obstacles internally
  const obstacles: AABB[] = [];
  for (const [name, info] of allNodes) {
    if (name === lcaName || srcAncestors.has(name) || tgtAncestors.has(name)) continue;
    if (srcName && name === srcName) continue;
    if (tgtName && name === tgtName) continue;
    if (onlyLeaves && classifyTypeTier(info.type) !== 'leaf') continue;

    obstacles.push({
      xMin: info.xMin - OBSTACLE_MARGIN,
      xMax: info.xMax + OBSTACLE_MARGIN,
      zMin: info.zMin - OBSTACLE_MARGIN,
      zMax: info.zMax + OBSTACLE_MARGIN,
    });
  }

  // Convert world -> grid coords.
  const toGrid = (wx: number, wz: number): [number, number] => [
    Math.round(wx / GRID_CELL),
    Math.round(wz / GRID_CELL),
  ];
  const toWorld = (gx: number, gz: number): [number, number] => [
    gx * GRID_CELL,
    gz * GRID_CELL,
  ];

  const [sgx, sgz] = toGrid(startW[0], startW[1]);
  const [egx, egz] = toGrid(endW[0], endW[1]);

  if (sgx === egx && sgz === egz) {
    return [startW, endW];
  }

  // Heuristic: Manhattan distance.
  const h = (gx: number, gz: number) =>
    Math.abs(gx - egx) + Math.abs(gz - egz);

  type Node = {
    gx: number; gz: number;
    g: number; f: number;
    fromDir: [number, number] | null;
    parent: Node | null;
  };

  const open = new Map<string, Node>();
  const closed = new Set<string>();

  const startNode: Node = {
    gx: sgx, gz: sgz,
    g: 0,
    f: h(sgx, sgz),
    fromDir: null,
    parent: null,
  };
  open.set(cellKey(sgx, sgz), startNode);

  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let iterations = 0;
  const MAX_ITER = 32000;

  while (open.size > 0 && iterations++ < MAX_ITER) {
    // Pick lowest f from open list.
    let current: Node | undefined;
    let minF = Infinity;
    for (const node of open.values()) {
      if (node.f < minF) { minF = node.f; current = node; }
    }
    if (!current) break;

    const ck = cellKey(current.gx, current.gz);
    open.delete(ck);
    closed.add(ck);

    if (current.gx === egx && current.gz === egz) {
      // Reconstruct path.
      const waypoints: [number, number][] = [];
      let n: Node | null = current;
      while (n) {
        waypoints.unshift(toWorld(n.gx, n.gz));
        n = n.parent;
      }
      return waypoints;
    }

    for (const [dx, dz] of dirs) {
      const nx = current.gx + dx;
      const nz = current.gz + dz;
      const nk = cellKey(nx, nz);
      if (closed.has(nk)) continue;

      // Bounds check.
      const [wx, wz] = toWorld(nx, nz);
      if (wx < bounds.xMin || wx > bounds.xMax ||
        wz < bounds.zMin || wz > bounds.zMax) continue;

      // Obstacle check.
      const blocked = isInsideAny(wx, wz, obstacles);
      if (blocked) continue;

      // Movement cost.
      let moveCost = 1;

      // Bend penalty.
      if (current.fromDir && (current.fromDir[0] !== dx || current.fromDir[1] !== dz)) {
        moveCost += BEND_COST;
      }

      // Overlap penalty (secondary).
      if (usedCells.has(nk)) {
        moveCost += OVERLAP_COST;
      }

      const ng = current.g + moveCost;
      const existing = open.get(nk);
      if (existing && existing.g <= ng) continue;

      const next: Node = {
        gx: nx, gz: nz,
        g: ng,
        f: ng + h(nx, nz),
        fromDir: [dx, dz],
        parent: current,
      };
      open.set(nk, next);
    }
  }

  return null;
}

/**
 * Simplifies a grid path by removing collinear intermediate waypoints.
 * E.g. [A, B, C] where A-B-C are all on the same axis → [A, C].
 */
function simplifyPath(pts: [number, number][]): [number, number][] {
  if (pts.length <= 2) return pts;
  const result: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    
    // If the three points form a perfectly straight orthogonal line, we can skip the middle one.
    // This perfectly collapses collinear segments, including U-turns caused by grid snapping.
    const isCollinearX = prev[1] === curr[1] && curr[1] === next[1];
    const isCollinearZ = prev[0] === curr[0] && curr[0] === next[0];
    if (isCollinearX || isCollinearZ) {
      continue;
    }

    // Keep point only if it introduces a bend.
    const sameDirX = (curr[0] - prev[0]) * (next[0] - curr[0]);
    const sameDirZ = (curr[1] - prev[1]) * (next[1] - curr[1]);
    if (sameDirX <= 0 || sameDirZ <= 0) {
      // It's a bend or direction reversal — keep it.
      const prevDir = [curr[0] - prev[0], curr[1] - prev[1]];
      const nextDir = [next[0] - curr[0], next[1] - curr[1]];
      const isDifferentDir =
        Math.sign(prevDir[0]) !== Math.sign(nextDir[0]) ||
        Math.sign(prevDir[1]) !== Math.sign(nextDir[1]);
      if (isDifferentDir) result.push(curr);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

function findLCA(src: NodeInfo, tgt: NodeInfo, allNodes: Map<string, NodeInfo>): string | null {
  const srcAncestors = new Set<string>();
  let curr: string | null = src.name;
  while (curr) {
    srcAncestors.add(curr);
    curr = allNodes.get(curr)?.parentName || null;
  }

  curr = tgt.name;
  while (curr) {
    if (srcAncestors.has(curr)) return curr;
    curr = allNodes.get(curr)?.parentName || null;
  }
  return null;
}

/**
 * Compute the routed path for one connection.
 */
function routeConnection(
  srcInfo: NodeInfo,
  tgtInfo: NodeInfo,
  allNodes: Map<string, NodeInfo>,
  srcName: string,
  tgtName: string,
  usedCells: Set<string>,
): [number, number, number][] {

  const srcAttach = wallAttachPoint(srcInfo, tgtInfo);
  const tgtAttach = wallAttachPoint(tgtInfo, srcInfo);

  // To prevent the path from clipping inside the component, we push the A* start/end
  // outward by enough distance to clear the OBSTACLE_MARGIN (0.1).
  // 0.15 ensures it is safely outside the obstacle bounds so the router doesn't get trapped.
  const PUSH_OUT = 0.15;
  const startW: [number, number] = [
    srcAttach.pt[0] + srcAttach.normal[0] * PUSH_OUT,
    srcAttach.pt[2] + srcAttach.normal[1] * PUSH_OUT,
  ];
  const endW: [number, number] = [
    tgtAttach.pt[0] + tgtAttach.normal[0] * PUSH_OUT,
    tgtAttach.pt[2] + tgtAttach.normal[1] * PUSH_OUT,
  ];

  const srcAnc = srcInfo.ancestors;
  const tgtAnc = tgtInfo.ancestors;

  const lcaName = findLCA(srcInfo, tgtInfo, allNodes);
  const lca = lcaName ? allNodes.get(lcaName) : null;

  // Helper to check if a straight orthogonal segment is clear of obstacles
  const isSegmentClear = (sx: number, sz: number, ex: number, ez: number): boolean => {
    const xMin = Math.min(sx, ex);
    const xMax = Math.max(sx, ex);
    const zMin = Math.min(sz, ez);
    const zMax = Math.max(sz, ez);
    for (const [name, info] of allNodes) {
      if (name === lcaName || srcAnc.has(name) || tgtAnc.has(name)) continue;
      if (name === srcName || name === tgtName) continue;
      if (xMin <= info.xMax + OBSTACLE_MARGIN && xMax >= info.xMin - OBSTACLE_MARGIN &&
          zMin <= info.zMax + OBSTACLE_MARGIN && zMax >= info.zMin - OBSTACLE_MARGIN) {
        return false;
      }
    }
    return true;
  };

  let rawPath: [number, number][] | null = null;

  // Direct Line-of-Sight Check:
  // If the components are close or perfectly aligned, try a simple L-shape (or straight line)
  // bypass to avoid detouring to the global grid tracks.
  if (isSegmentClear(startW[0], startW[1], endW[0], startW[1]) && 
      isSegmentClear(endW[0], startW[1], endW[0], endW[1])) {
    rawPath = [startW, [endW[0], startW[1]], endW];
  } else if (isSegmentClear(startW[0], startW[1], startW[0], endW[1]) && 
             isSegmentClear(startW[0], endW[1], endW[0], endW[1])) {
    rawPath = [startW, [startW[0], endW[1]], endW];
  }

  // Bounds for the route: start with the LCA bounds
  // We expand the bounds slightly by GRID_CELL to ensure the grid points can trace the inside wall
  const bounds = lca ? {
    xMin: lca.xMin - GRID_CELL,
    xMax: lca.xMax + GRID_CELL,
    zMin: lca.zMin - GRID_CELL,
    zMax: lca.zMax + GRID_CELL,
  } : {
    xMin: Math.min(startW[0], endW[0]) - 8,
    xMax: Math.max(startW[0], endW[0]) + 8,
    zMin: Math.min(startW[1], endW[1]) - 8,
    zMax: Math.max(startW[1], endW[1]) + 8,
  };

  // Attempt 1: normal bounds and all unrelated obstacles.
  if (!rawPath) {
    rawPath = aStarRoute(
      srcAnc,
      tgtAnc,
      startW,
      endW,
      bounds,
      allNodes,
      lcaName,
      false,
      srcName,
      tgtName,
      usedCells,
    );
  }

  // Attempt 2: Relax obstacles (only leaf components are obstacles, ignore unrelated containers)
  if (!rawPath) {
    rawPath = aStarRoute(
      srcAnc,
      tgtAnc,
      startW,
      endW,
      bounds,
      allNodes,
      lcaName,
      true,
      srcName,
      tgtName,
      usedCells,
    );
  }

  // Attempt 3: Relax bounds by expanding search area (in case LCA is too tight)
  // We MUST continue to respect leafObstacles so we don't draw wires straight through components!
  if (!rawPath) {
    const expandedBounds = {
      xMin: bounds.xMin - 4,
      xMax: bounds.xMax + 4,
      zMin: bounds.zMin - 4,
      zMax: bounds.zMax + 4,
    };
    rawPath = aStarRoute(
      srcAnc,
      tgtAnc,
      startW,
      endW,
      expandedBounds,
      allNodes,
      lcaName,
      true,
      srcName,
      tgtName,
      usedCells,
    );
  }

  if (!rawPath) {
    console.error(`[PolarTwin] Routing failed for ${srcName} -> ${tgtName}. No valid path found.`);
    return []; // Empty path signals failure
  }

  // To guarantee orthogonal lines (parallel to the grid), we must insert an intermediate point
  // between the exact wall coordinate and the nearest grid coordinate.
  const firstGrid = rawPath[0];
  const srcIntermediate: [number, number] = srcAttach.normal[0] !== 0 
    ? [firstGrid[0], srcAttach.pt[2]] 
    : [srcAttach.pt[0], firstGrid[1]];

  const lastGrid = rawPath[rawPath.length - 1];
  const tgtIntermediate: [number, number] = tgtAttach.normal[0] !== 0
    ? [lastGrid[0], tgtAttach.pt[2]]
    : [tgtAttach.pt[0], lastGrid[1]];

  const fullPath: [number, number][] = [
    [srcAttach.pt[0], srcAttach.pt[2]],
    srcIntermediate,
    ...rawPath,
    tgtIntermediate,
    [tgtAttach.pt[0], tgtAttach.pt[2]]
  ];

  const simplified = simplifyPath(fullPath);

  // Cross-floor handling: if source and target are on different physical Y planes,
  // we must insert a vertical segment. The path routes to the source wall at its Y level,
  // then drops/climbs to the target Y level, then routes to the target.
  const sourceY = srcInfo.worldOrigin[1];
  const targetY = tgtInfo.worldOrigin[1];
  
  const path3d: [number, number, number][] = [];
  
  if (Math.abs(sourceY - targetY) > 0.01) {
    // The A* route is in XZ. We need to split it into two horizontal segments, joined by a vertical segment.
    // For simplicity, we drop/climb at the source's outer boundary (index 2 in the path typically, or simply the second waypoint).
    // Let's drop immediately after clearing the source bounding box.
    const dropIndex = Math.min(2, simplified.length - 1);
    
    for (let i = 0; i < simplified.length; i++) {
      const [x, z] = simplified[i];
      if (i < dropIndex) {
        path3d.push([x, sourceY, z]);
      } else if (i === dropIndex) {
        path3d.push([x, sourceY, z]);
        path3d.push([x, targetY, z]); // Vertical drop segment
      } else {
        path3d.push([x, targetY, z]);
      }
    }
  } else {
    // Same Y plane
    for (const [x, z] of simplified) {
      path3d.push([x, sourceY, z]);
    }
  }

  // Register cells as used for subsequent connections (overlap avoidance).
  for (const [wx, wz] of simplified) {
    usedCells.add(cellKey(Math.round(wx / GRID_CELL), Math.round(wz / GRID_CELL)));
  }

  return path3d;
}

// ─── main exports ─────────────────────────────────────────────────────────────

/**
 * Recursively build a NodeLayout tree from raw topology / spec JSON.
 *
 * @param node  — one node from the topology (relation.json) tree.
 * @param spec  — the entire spec object (spec.json).
 */
export function buildLayout(node: any, spec: any, rawConnections: any[] = []): NodeLayout {
  const name: string = node.name ?? '(unnamed)';
  const type: string = node.type ?? '';
  const tags: string[] = node.tags ?? [];
  const level: number | undefined = typeof node.level === 'number' ? node.level : undefined;
  const rawSpec: Record<string, unknown> = (spec?.components?.[name]?.spec) ?? {};
  const rawChildren: any[] = node.children ?? [];

  // Build children first so their dims are known.
  const children: NodeLayout[] = rawChildren.map((c: any) => buildLayout(c, spec, rawConnections));

  // ── Resolve this node's dimensions ────────────────────────────────────────
  let dims: Dims;

  // Compute dynamic gap based on connections between children
  let dynamicGap = 0.6; // fallback CHILD_GAP
  const hasFloors = children.some(c => (c.type || '').toLowerCase().includes('floor') || c.level !== undefined);
  
  if (children.length > 0 && !hasFloors) {
    const childNames = new Set(children.map(c => c.name));
    let requiredGap = 0.6;
    for (const conn of rawConnections) {
      if (childNames.has(conn.source) && childNames.has(conn.target)) {
        const profile = getProfile(conn.type ?? 'unknown');
        // gap = width + clearance + visible length
        const gap = profile.width + profile.clearance + 1.0;
        if (gap > requiredGap) requiredGap = gap;
      }
    }
    dynamicGap = requiredGap;
  }

  const explicit = resolveExplicitDims(rawSpec);
  if (hasFloors) {
    // Floor-aware layout: stack children based on their level.
    children.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    
    // Position each child according to its semantic level
    let yMin = Infinity;
    let yMax = -Infinity;
    let maxWidth = 0;
    let maxDepth = 0;
    
    children.forEach(c => {
      const cLevel = c.level ?? 0;
      const baseY = cLevel * LEVEL_SPACING;
      c.position = [0, baseY, 0];
      
      yMin = Math.min(yMin, baseY);
      yMax = Math.max(yMax, baseY + c.dims.height);
      maxWidth = Math.max(maxWidth, c.dims.width);
      maxDepth = Math.max(maxDepth, c.dims.depth);
    });

    if (explicit) {
      dims = explicit;
    } else {
      dims = {
        width: maxWidth + PADDING * 2,
        height: (yMax - yMin) + PADDING,
        depth: maxDepth + PADDING * 2,
      };
    }
  } else {
    // Standard layout for components/rooms
    if (explicit) {
      dims = explicit;
    } else if (children.length > 0) {
      // Container: size is inferred from packed children.
      const { packedWidth, packedDepth } = gridPack(children.map((c) => c.dims), dynamicGap);
      const maxChildHeight = children.reduce((m, c) => Math.max(m, c.dims.height), 0);
      dims = {
        width: packedWidth + PADDING * 2,
        height: maxChildHeight + PADDING,   // tall enough to fully enclose tallest child
        depth: packedDepth + PADDING * 2,
      };
    } else {
      dims = resolveTypeDefault(type);
    }

    // ── Position children in the XZ plane; all at Y = 0 within this group ────
    if (children.length > 0) {
      const { offsets } = gridPack(children.map((c) => c.dims), dynamicGap);
      offsets.forEach(({ x, z }, i) => {
        children[i].position = [x, 0, z];
      });
    }
  }

  let yOffset = 0;
  if (hasFloors && !explicit) {
    // We compute yMin over children. If yMin != 0, the container's center 
    // needs to shift so the lowest floor sits at the bottom of the bounding box.
    // We already computed yMin in the hasFloors block, but let's re-verify it.
    let yMin = Infinity;
    children.forEach(c => { yMin = Math.min(yMin, c.position[1]); });
    if (yMin !== Infinity) {
      yOffset = yMin - PADDING / 2;
    }
  }

  return {
    name,
    type,
    dims,
    position: [0, 0, 0],  // overwritten by parent's layout pass
    children,
    spec: rawSpec,
    tags,
    level,
    yOffset: yOffset !== 0 ? yOffset : undefined,
  };
}

/**
 * Builds both the spatial layout tree and the resolved connection list.
 * This is the single entry-point consumed by TwinViewer.
 *
 * @param topology — raw topology/relation JSON (relation.json).
 * @param spec     — raw specification JSON (spec.json).
 */
export function buildSceneLayout(topology: any, connectionsData: any, spec: any): SceneLayout {
  let rootNode = topology;
  
  // The backend returns a flat list of nodes where children are string arrays.
  // We need to unflatten this into a nested tree before building the layout.
  if (Array.isArray(topology)) {
    const nodeMap = new Map<string, any>();
    // First pass: clone nodes and initialize empty object children arrays
    for (const item of topology) {
      nodeMap.set(item.name, { ...item, children: [] });
    }
    
    // Second pass: link children to parents
    let foundRoot = null;
    for (const item of topology) {
      const node = nodeMap.get(item.name);
      if (!item.parent) {
        foundRoot = node;
      } else {
        const parent = nodeMap.get(item.parent);
        if (parent) {
          parent.children.push(node);
        }
      }
    }
    rootNode = foundRoot || (topology.length > 0 ? nodeMap.get(topology[0].name) : {});
  }

  const root = buildLayout(rootNode, spec, connectionsData);
  const nodeMap = buildNodeMap(root);
  const rawConnections: any[] = Array.isArray(connectionsData) ? connectionsData : [];
  
  // Discover floors and generate synthetic connections (ladders/lifts)
  const floorContainers = new Map<string, NodeLayout[]>();
  const collectFloors = (node: NodeLayout, parentName: string | null) => {
    if (((node.type || '').toLowerCase().includes('floor') || node.level !== undefined) && parentName) {
      if (!floorContainers.has(parentName)) floorContainers.set(parentName, []);
      floorContainers.get(parentName)!.push(node);
    }
    node.children.forEach(c => collectFloors(c, node.name));
  };
  collectFloors(root, null);
  
  for (const [_, floors] of floorContainers.entries()) {
    floors.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    for (let i = 0; i < floors.length - 1; i++) {
      const src = floors[i];
      const tgt = floors[i+1];
      const diff = (tgt.level ?? 0) - (src.level ?? 0);
      const connType = diff === 1 ? 'ladder' : 'lift';
      
      rawConnections.push({
        source: src.name,
        target: tgt.name,
        type: connType,
        direction: '<-->',
        _synthetic: true,
      });
    }
  }

  // Track used grid cells across all connections for overlap avoidance.
  const usedCells = new Set<string>();

  const connections: ConnectionLayout[] = rawConnections
    .map((c: any, index: number): ConnectionLayout | null => {
      const src = nodeMap.get(c.source);
      const tgt = nodeMap.get(c.target);
      if (!src || !tgt) {
        console.warn(
          `[PolarTwin] Connection ${c.source}→${c.target}: ` +
          `one or both components not found in the topology tree — skipping.`
        );
        return null;
      }

      const connectionType = c.type ?? 'unknown';
      const baseProfile = getProfile(connectionType);

      // Resolve 'min-block' to an actual number
      const height = baseProfile.height === 'min-block'
        ? Math.min(src.dims.height, tgt.dims.height)
        : baseProfile.height;

      const profile = { ...baseProfile, height };

      const path = routeConnection(
        src, tgt,
        nodeMap,
        c.source, c.target,
        usedCells,
      );

      if (path.length === 0) {
        return null;
      }

      // If elevation is relative to ground, add it to the Y coordinate of the path.
      // But for 3D paths, Y varies, so we just add elevation to all Ys.
      const elevation = profile.elevation === 'ground' ? height / 2 : profile.elevation;
      const elevatedPath = path.map(([x, y, z]) => [x, y + (elevation as number), z] as [number, number, number]);

      return {
        id:             `${c.source}--${c.target}--${index}`,
        source: c.source,
        target: c.target,
        path: elevatedPath,
        // Legacy aliases so ConnectionRenderer still works without changes.
        startPos: elevatedPath[0],
        endPos: elevatedPath[elevatedPath.length - 1],
        profile,
        connectionType,
        relation: c.relation ?? connectionType,
        direction: c.direction ?? '-->',
      };
    })
    .filter((c): c is ConnectionLayout => c !== null);

  return { root, connections, allNodes: nodeMap };
}
