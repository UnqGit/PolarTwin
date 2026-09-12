/**
 * layout.test.ts
 *
 * Unit tests for the layout engine (§32.17 testing requirements).
 * These tests run in Node/Vitest with no browser/Three.js context needed.
 */

import { describe, it, expect } from 'vitest';
import { buildLayout, type NodeLayout } from '../lib/layout';

// ─── helpers ────────────────────────────────────────────────────────────────

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

function makeSpec(components: Record<string, { type: string; spec: Record<string, unknown> }> = {}) {
  return { components, defaults: {} };
}

// ─── Naming ──────────────────────────────────────────────────────────────────

describe('Naming', () => {
  it('assigns the name from topology to a leaf', () => {
    const topo = makeTopology({ name: 'Generator', type: 'generator', children: [] });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.name).toBe('Generator');
  });

  it('assigns the name from topology to a container', () => {
    const topo = makeTopology({
      name: 'EnergySystem',
      type: 'system',
      children: [
        { name: 'Gen', type: 'generator', tags: [], children: [] },
      ],
    });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.name).toBe('EnergySystem');
    expect(layout.children[0].name).toBe('Gen');
  });

  it('uses "(unnamed)" fallback when name is missing', () => {
    const topo = { type: 'generator', tags: [], children: [] };
    const layout = buildLayout(topo, makeSpec());
    expect(layout.name).toBe('(unnamed)');
  });
});

// ─── Dimensions ───────────────────────────────────────────────────────────────

describe('Dimensions — explicit', () => {
  it('uses explicit dimensions from spec when present', () => {
    const topo = makeTopology({ name: 'Widget', type: 'generator', children: [] });
    const spec = makeSpec({
      Widget: { type: 'generator', spec: { dimensions: { width: 5, height: 3, depth: 2 } } },
    });
    const layout = buildLayout(topo, spec);
    expect(layout.dims).toEqual({ width: 5, height: 3, depth: 2 });
  });

  it('ignores incomplete explicit dimensions and falls back to type default', () => {
    const topo = makeTopology({ name: 'Widget', type: 'generator', children: [] });
    const spec = makeSpec({
      Widget: { type: 'generator', spec: { dimensions: { width: 5, height: 3 /* missing depth */ } } },
    });
    const layout = buildLayout(topo, spec);
    // Generator default is { width:2.4, height:1.8, depth:1.6 }
    expect(layout.dims.width).toBe(2.4);
  });
});

describe('Dimensions — type defaults', () => {
  it('assigns generator type default when no explicit dims', () => {
    const topo = makeTopology({ name: 'Gen', type: 'generator', children: [] });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.dims).toEqual({ width: 2.4, height: 1.8, depth: 1.6 });
  });

  it('assigns sensor type default', () => {
    const topo = makeTopology({ name: 'S', type: 'sensor', children: [] });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.dims).toEqual({ width: 0.6, height: 0.6, depth: 0.6 });
  });

  it('assigns generic fallback for unknown type', () => {
    const topo = makeTopology({ name: 'X', type: 'quantum_widget', children: [] });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.dims).toEqual({ width: 1.0, height: 1.0, depth: 1.0 });
  });
});

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

  it('container dims are larger than any single child', () => {
    const layout = threeChildLayout();
    const maxChildW = Math.max(2.4, 0.6, 1.2);
    expect(layout.dims.width).toBeGreaterThan(maxChildW);
  });

  it('container dims include padding', () => {
    const layout = threeChildLayout();
    // packed width + 2 * PADDING (0.8) — just verify padding is present
    expect(layout.dims.width).toBeGreaterThan(2.4 + 0.6 * 2);
  });

  it('nested container dims expand correctly', () => {
    const topo = makeTopology({
      name: 'Station',
      type: 'station',
      children: [{
        name: 'Sys',
        type: 'system',
        tags: [],
        children: [
          { name: 'G', type: 'generator', tags: [], children: [] },
          { name: 'S', type: 'sensor',    tags: [], children: [] },
        ],
      }],
    });
    const root = buildLayout(topo, makeSpec());
    const sys = root.children[0];
    expect(root.dims.width).toBeGreaterThan(sys.dims.width);
  });
});

// ─── Layout — non-overlapping placement ────────────────────────────────────

describe('Layout — non-overlapping placement', () => {
  it('two siblings are not at the same X position', () => {
    const topo = makeTopology({
      name: 'Sys',
      type: 'system',
      children: [
        { name: 'A', type: 'generator', tags: [], children: [] },
        { name: 'B', type: 'generator', tags: [], children: [] },
      ],
    });
    const layout = buildLayout(topo, makeSpec());
    const [a, b] = layout.children;
    expect(a.position[0]).not.toBe(b.position[0]);
  });

  it('four siblings are not all at the same coordinate', () => {
    const topo = makeTopology({
      name: 'Sys',
      type: 'system',
      children: [
        { name: 'A', type: 'sensor', tags: [], children: [] },
        { name: 'B', type: 'sensor', tags: [], children: [] },
        { name: 'C', type: 'sensor', tags: [], children: [] },
        { name: 'D', type: 'sensor', tags: [], children: [] },
      ],
    });
    const layout = buildLayout(topo, makeSpec());
    const positions = layout.children.map((c) => `${c.position[0]},${c.position[2]}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(4);
  });

  it('child positions are inside the parent bounding box', () => {
    const topo = makeTopology({
      name: 'Sys',
      type: 'system',
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

// ─── Geometry selection ───────────────────────────────────────────────────────

describe('Geometry selection', () => {
  it('generator type is preserved in layout', () => {
    const topo = makeTopology({ name: 'Gen', type: 'generator', children: [] });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.type).toBe('generator');
  });

  it('unknown type is preserved in layout (for generic fallback)', () => {
    const topo = makeTopology({ name: 'X', type: 'exotic_device', children: [] });
    const layout = buildLayout(topo, makeSpec());
    expect(layout.type).toBe('exotic_device');
  });
});

// ─── Spec forwarding ──────────────────────────────────────────────────────────

describe('Spec forwarding', () => {
  it('spec fields are forwarded to layout', () => {
    const topo = makeTopology({ name: 'Gen', type: 'generator', children: [] });
    const spec = makeSpec({ Gen: { type: 'generator', spec: { fuel_rate: 0.25, rating: { value: 10, unit: 'kW' } } } });
    const layout = buildLayout(topo, spec);
    expect((layout.spec as any).fuel_rate).toBe(0.25);
  });
});
