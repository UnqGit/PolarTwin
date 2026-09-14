/**
 * layout.test.ts
 *
 * Unit tests for the layout engine and scene layout builder.
 * Runs in Node / Vitest with no browser or Three.js context.
 *
 * Covers:
 *   - Component naming
 *   - Flat explicit dimensions (height / width|breadth / length)
 *   - Breadth/width conflict detection
 *   - Type-specific defaults and generic fallback
 *   - Container dimension inference from children
 *   - Non-overlapping child placement
 *   - Children at Y = 0 (ground placement)
 *   - resolveConnectionVisual — all category combinations
 *   - buildSceneLayout — smoke, determinism, unknown topology, missing refs
 *   - Spec forwarding
 */

import { describe, it, expect } from 'vitest';
import {
  buildLayout,
  buildSceneLayout,
  type NodeLayout,
} from '../lib/layout';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeTopology(overrides: any = {}) {
  return {
    name: 'Root',
    type: 'station',
    tags: [],
    children: [],
    connections: [],
    ...overrides,
  };
}

function makeSpec(
  components: Record<string, { type: string; spec: Record<string, unknown> }> = {}
) {
  return { components, defaults: {} };
}

// ─── Naming ───────────────────────────────────────────────────────────────────

describe('Naming', () => {
  it('assigns the name from topology to a leaf', () => {
    const layout = buildLayout(makeTopology({ name: 'Generator', type: 'generator' }), makeSpec());
    expect(layout.name).toBe('Generator');
  });

  it('assigns the name from topology to a container and its children', () => {
    const topo = makeTopology({
      name: 'EnergySystem',
      type: 'system',
      children: [{ name: 'Gen', type: 'generator', tags: [], children: [] }],
    });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.name).toBe('EnergySystem');
    expect(layout.children[0].name).toBe('Gen');
  });

  it('uses "(unnamed)" fallback when name is missing', () => {
    const layout = buildLayout({ type: 'generator', tags: [], children: [] }, makeSpec());
    expect(layout.name).toBe('(unnamed)');
  });
});

// ─── Dimensions — flat explicit keys ─────────────────────────────────────────

describe('Dimensions — flat spec keys', () => {
  it('uses flat width + height + length keys from spec', () => {
    const topo = makeTopology({ name: 'Widget', type: 'generator' });
    const spec = makeSpec({ Widget: { type: 'generator', spec: { width: 5, height: 3, length: 2 } } });
    const layout = buildLayout(topo, spec);
    expect(layout.dims).toEqual({ width: 5, height: 3, depth: 2 });
  });

  it('uses "breadth" as width when "width" is absent', () => {
    const topo = makeTopology({ name: 'Widget', type: 'sensor' });
    const spec = makeSpec({ Widget: { type: 'sensor', spec: { breadth: 4, height: 3, length: 2 } } });
    const layout = buildLayout(topo, spec);
    expect(layout.dims).toEqual({ width: 4, height: 3, depth: 2 });
  });

  it('falls back to type default when both width and breadth are present', () => {
    const topo = makeTopology({ name: 'Widget', type: 'generator' });
    const spec = makeSpec({
      Widget: { type: 'generator', spec: { width: 5, breadth: 4, height: 3, length: 2 } },
    });
    const layout = buildLayout(topo, spec);
    // Conflict → falls back to generator default
    expect(layout.dims.width).toBe(2.4);
  });

  it('falls back to type default when "length" (depth) is missing', () => {
    const topo = makeTopology({ name: 'Widget', type: 'generator' });
    const spec = makeSpec({ Widget: { type: 'generator', spec: { width: 5, height: 3 } } });
    const layout = buildLayout(topo, spec);
    expect(layout.dims.width).toBe(2.4);
  });

  it('falls back to type default when "height" is missing', () => {
    const topo = makeTopology({ name: 'Widget', type: 'generator' });
    const spec = makeSpec({ Widget: { type: 'generator', spec: { width: 5, length: 2 } } });
    const layout = buildLayout(topo, spec);
    expect(layout.dims.width).toBe(2.4);
  });
});

// ─── Dimensions — type defaults ───────────────────────────────────────────────

describe('Dimensions — type defaults', () => {
  it('assigns generator type default when no explicit dims', () => {
    const layout = buildLayout(makeTopology({ name: 'Gen', type: 'generator' }), makeSpec());
    expect(layout.dims).toEqual({ width: 2.4, height: 1.8, depth: 1.6 });
  });

  it('assigns sensor type default', () => {
    const layout = buildLayout(makeTopology({ name: 'S', type: 'sensor' }), makeSpec());
    expect(layout.dims).toEqual({ width: 0.6, height: 0.6, depth: 0.6 });
  });

  it('assigns generic fallback for unknown type', () => {
    const layout = buildLayout(makeTopology({ name: 'X', type: 'quantum_widget' }), makeSpec());
    expect(layout.dims).toEqual({ width: 1.0, height: 1.0, depth: 1.0 });
  });
});

// ─── Dimensions — container inference ────────────────────────────────────────

describe('Dimensions — container inference', () => {
  function threeChildLayout(): NodeLayout {
    const topo = makeTopology({
      name: 'Sys',
      type: 'system',
      children: [
        { name: 'G', type: 'generator', tags: [], children: [] },   // 2.4 × 1.8 × 1.6
        { name: 'S', type: 'sensor',    tags: [], children: [] },   // 0.6 × 0.6 × 0.6
        { name: 'C', type: 'controller',tags: [], children: [] },   // 1.2 × 0.8 × 1.0
      ],
    });
    return buildLayout(topo, makeSpec());
  }

  it('container width is larger than any single child width', () => {
    const layout = threeChildLayout();
    expect(layout.dims.width).toBeGreaterThan(2.4);
  });

  it('container height encompasses the tallest child', () => {
    const layout = threeChildLayout();
    // max child height = 1.8 (generator); container must be >= 1.8
    expect(layout.dims.height).toBeGreaterThanOrEqual(1.8);
  });

  it('container dims include padding', () => {
    const layout = threeChildLayout();
    // Packed width of (gen 2.4 + gap + sensor 0.6) per row; verify padding is added
    expect(layout.dims.width).toBeGreaterThan(2.4 + 0.6 * 2);
  });

  it('nested container dims expand correctly', () => {
    const topo = makeTopology({
      name: 'Station',
      type: 'station',
      children: [{
        name: 'Sys', type: 'system', tags: [],
        children: [
          { name: 'G', type: 'generator', tags: [], children: [] },
          { name: 'S', type: 'sensor',    tags: [], children: [] },
        ],
      }],
    });
    const root = buildLayout(topo, makeSpec());
    const sys  = root.children[0];
    expect(root.dims.width).toBeGreaterThan(sys.dims.width);
  });
});

// ─── Ground placement ─────────────────────────────────────────────────────────

describe('Ground placement (children at Y = 0)', () => {
  it('direct children of a container have position Y = 0', () => {
    const topo = makeTopology({
      name: 'Sys', type: 'system',
      children: [{ name: 'A', type: 'generator', tags: [], children: [] }],
    });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.children[0].position[1]).toBe(0);
  });

  it('multiple children all have Y = 0', () => {
    const topo = makeTopology({
      name: 'Sys', type: 'system',
      children: [
        { name: 'A', type: 'generator',  tags: [], children: [] },
        { name: 'B', type: 'sensor',     tags: [], children: [] },
        { name: 'C', type: 'controller', tags: [], children: [] },
      ],
    });
    const layout = buildLayout(topo, makeSpec());
    layout.children.forEach((c) => expect(c.position[1]).toBe(0));
  });
});

// ─── Layout — non-overlapping placement ──────────────────────────────────────

describe('Layout — non-overlapping placement', () => {
  it('two siblings are not at the same X position', () => {
    const topo = makeTopology({
      name: 'Sys', type: 'system',
      children: [
        { name: 'A', type: 'generator', tags: [], children: [] },
        { name: 'B', type: 'generator', tags: [], children: [] },
      ],
    });
    const layout = buildLayout(topo, makeSpec());
    const [a, b] = layout.children;
    expect(a.position[0]).not.toBe(b.position[0]);
  });

  it('four siblings all get unique XZ coordinates', () => {
    const topo = makeTopology({
      name: 'Sys', type: 'system',
      children: [
        { name: 'A', type: 'sensor', tags: [], children: [] },
        { name: 'B', type: 'sensor', tags: [], children: [] },
        { name: 'C', type: 'sensor', tags: [], children: [] },
        { name: 'D', type: 'sensor', tags: [], children: [] },
      ],
    });
    const layout = buildLayout(topo, makeSpec());
    const positions = layout.children.map((c) => `${c.position[0]},${c.position[2]}`);
    expect(new Set(positions).size).toBe(4);
  });

  it('child bounding boxes are inside the parent bounding box', () => {
    const topo = makeTopology({
      name: 'Sys', type: 'system',
      children: [
        { name: 'G1', type: 'generator', tags: [], children: [] },
        { name: 'G2', type: 'generator', tags: [], children: [] },
        { name: 'G3', type: 'generator', tags: [], children: [] },
      ],
    });
    const layout = buildLayout(topo, makeSpec());
    const halfW = layout.dims.width  / 2;
    const halfD = layout.dims.depth  / 2;
    layout.children.forEach((child) => {
      expect(Math.abs(child.position[0]) + child.dims.width  / 2).toBeLessThanOrEqual(halfW + 0.01);
      expect(Math.abs(child.position[2]) + child.dims.depth  / 2).toBeLessThanOrEqual(halfD + 0.01);
    });
  });
});

// ─── resolveConnectionVisual ──────────────────────────────────────────────────

describe('resolveConnectionVisual', () => {
  it('station × station → road', () => {
    expect(resolveConnectionVisual('station', 'station')).toBe('road');
  });

  it('type containing "station" substring is treated as station tier', () => {
    expect(resolveConnectionVisual('main_station', 'sub_station')).toBe('road');
  });

  it('block × block → hallway', () => {
    expect(resolveConnectionVisual('block', 'block')).toBe('hallway');
  });

  it('type containing "block" substring is treated as block tier', () => {
    expect(resolveConnectionVisual('housing_block', 'storage_block')).toBe('hallway');
  });

  it('leaf × leaf (generator, controller) → wire', () => {
    expect(resolveConnectionVisual('generator', 'controller')).toBe('wire');
  });

  it('leaf × leaf (sensor, motor) → wire', () => {
    expect(resolveConnectionVisual('sensor', 'motor')).toBe('wire');
  });

  it('unknown × unknown → wire (both default to leaf tier)', () => {
    expect(resolveConnectionVisual('quantum_device', 'photon_emitter')).toBe('wire');
  });

  it('block × system → none (mixed tiers)', () => {
    expect(resolveConnectionVisual('block', 'system')).toBe('none');
  });

  it('station × block → none (mixed tiers)', () => {
    expect(resolveConnectionVisual('station', 'block')).toBe('none');
  });

  it('station × generator → none (mixed tiers)', () => {
    expect(resolveConnectionVisual('station', 'generator')).toBe('none');
  });

  it('block × sensor → none (mixed tiers)', () => {
    expect(resolveConnectionVisual('block', 'sensor')).toBe('none');
  });
});

// ─── buildSceneLayout ─────────────────────────────────────────────────────────

describe('buildSceneLayout', () => {
  const emptySpec = { components: {}, defaults: {} };

  it('returns root NodeLayout and resolved connections', () => {
    const topo = {
      name: 'Sys', type: 'system',
      children: [
        { name: 'A', type: 'sensor',     tags: [], children: [] },
        { name: 'B', type: 'controller', tags: [], children: [] },
      ],
      connections: [{ source: 'A', target: 'B', type: 'data', direction: '-->' }],
    };
    const result = buildSceneLayout(topo, emptySpec);
    expect(result.root.name).toBe('Sys');
    expect(result.connections).toHaveLength(1);
  });

  it('connection carries correct visual (leaf × leaf → wire)', () => {
    const topo = {
      name: 'Sys', type: 'system',
      children: [
        { name: 'A', type: 'sensor',     tags: [], children: [] },
        { name: 'B', type: 'controller', tags: [], children: [] },
      ],
      connections: [{ source: 'A', target: 'B', type: 'signal', direction: '-->' }],
    };
    const result = buildSceneLayout(topo, emptySpec);
    expect(result.connections[0].visual).toBe('wire');
  });

  it('connection carries the raw connectionType from topology', () => {
    const topo = {
      name: 'Sys', type: 'system',
      children: [
        { name: 'A', type: 'sensor',     tags: [], children: [] },
        { name: 'B', type: 'controller', tags: [], children: [] },
      ],
      connections: [{ source: 'A', target: 'B', type: 'fuel_data', direction: '-->' }],
    };
    const result = buildSceneLayout(topo, emptySpec);
    expect(result.connections[0].connectionType).toBe('fuel_data');
    expect(result.connections[0].direction).toBe('-->');
  });

  it('skips a connection whose target is not in the topology (no throw)', () => {
    const topo = {
      name: 'Sys', type: 'system',
      children: [{ name: 'A', type: 'sensor', tags: [], children: [] }],
      connections: [{ source: 'A', target: 'MISSING', type: 'data', direction: '-->' }],
    };
    const result = buildSceneLayout(topo, emptySpec);
    expect(result.connections).toHaveLength(0);
  });

  it('handles missing connections array gracefully', () => {
    const topo = { name: 'X', type: 'generator', children: [] };
    const result = buildSceneLayout(topo, emptySpec);
    expect(result.connections).toHaveLength(0);
  });

  it('is deterministic — identical input produces identical output', () => {
    const topo = {
      name: 'Root', type: 'station',
      children: [
        { name: 'A', type: 'generator', tags: [], children: [] },
        { name: 'B', type: 'sensor',    tags: [], children: [] },
      ],
      connections: [{ source: 'A', target: 'B', type: 'power', direction: '-->' }],
    };
    const r1 = buildSceneLayout(topo, emptySpec);
    const r2 = buildSceneLayout(topo, emptySpec);
    expect(r1.root.children[0].position).toEqual(r2.root.children[0].position);
    expect(r1.connections[0].startPos).toEqual(r2.connections[0].startPos);
    expect(r1.connections[0].endPos).toEqual(r2.connections[0].endPos);
  });

  it('handles an entirely unknown topology without crashing', () => {
    const topo = {
      name: 'Future', type: 'quantum_core',
      children: [
        { name: 'Sub', type: 'photon_emitter', tags: [], children: [] },
        { name: 'Sub2', type: 'dark_matter_pump', tags: [], children: [] },
      ],
      connections: [{ source: 'Sub', target: 'Sub2', type: 'exotic_link', direction: '-->' }],
    };
    const result = buildSceneLayout(topo, emptySpec);
    expect(result.root.name).toBe('Future');
    expect(result.root.children).toHaveLength(2);
    expect(result.connections[0].visual).toBe('wire'); // both leaf-tier unknowns
  });

  it('connection startPos / endPos are distinct for non-co-located components', () => {
    const topo = {
      name: 'Sys', type: 'system',
      children: [
        { name: 'A', type: 'generator',  tags: [], children: [] },
        { name: 'B', type: 'controller', tags: [], children: [] },
      ],
      connections: [{ source: 'A', target: 'B', type: 'cmd', direction: '-->' }],
    };
    const result = buildSceneLayout(topo, emptySpec);
    const c = result.connections[0];
    expect(c.startPos).not.toEqual(c.endPos);
  });
});

// ─── Geometry type forwarding ──────────────────────────────────────────────────

describe('Type forwarding', () => {
  it('component type is preserved in NodeLayout', () => {
    const layout = buildLayout(makeTopology({ name: 'Gen', type: 'generator' }), makeSpec());
    expect(layout.type).toBe('generator');
  });

  it('unknown type is preserved (for generic mesh fallback)', () => {
    const layout = buildLayout(makeTopology({ name: 'X', type: 'exotic_device' }), makeSpec());
    expect(layout.type).toBe('exotic_device');
  });
});

// ─── Spec forwarding ──────────────────────────────────────────────────────────

describe('Spec forwarding', () => {
  it('spec fields are forwarded to NodeLayout', () => {
    const topo = makeTopology({ name: 'Gen', type: 'generator' });
    const spec = makeSpec({ Gen: { type: 'generator', spec: { fuel_rate: 0.25 } } });
    const layout = buildLayout(topo, spec);
    expect((layout.spec as any).fuel_rate).toBe(0.25);
  });
});
