/**
 * materials.test.ts
 *
 * Unit tests for material resolution (§32.17 — Materials).
 */

import { describe, it, expect } from 'vitest';
import { resolveMaterial, isContainer } from '../lib/materials';

describe('Material resolution', () => {
  it('generator resolves to a grey metallic material', () => {
    const mat = resolveMaterial('generator');
    expect(mat.metalness).toBeGreaterThan(0.4);
    expect(mat.transparent).toBe(false);
    expect(mat.opacity).toBe(1);
  });

  it('system resolves to a translucent container material', () => {
    const mat = resolveMaterial('system');
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.5);
  });

  it('station resolves to a translucent container material', () => {
    const mat = resolveMaterial('station');
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.5);
  });

  it('generator and sensor have different colors', () => {
    const gen = resolveMaterial('generator');
    const sensor = resolveMaterial('sensor');
    expect(gen.color).not.toBe(sensor.color);
  });

  it('unknown type gets generic fallback with opacity 1', () => {
    const mat = resolveMaterial('quantum_device');
    expect(mat.opacity).toBe(1);
    expect(mat.transparent).toBe(false);
  });

  it('failed flag changes color to red variant', () => {
    const normal = resolveMaterial('generator');
    const failed = resolveMaterial('generator', { failed: true });
    expect(failed.color).not.toBe(normal.color);
    expect(failed.color).toContain('7f1d1d');
  });

  it('hovered flag changes color to blue variant', () => {
    const normal  = resolveMaterial('controller');
    const hovered = resolveMaterial('controller', { hovered: true });
    expect(hovered.color).not.toBe(normal.color);
    expect(hovered.color).toBe('#93c5fd');
  });

  it('hovered container stays translucent', () => {
    const mat = resolveMaterial('system', { hovered: true });
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.5);
  });
});

describe('isContainer', () => {
  it('system is a container', () => expect(isContainer('system')).toBe(true));
  it('station is a container', () => expect(isContainer('station')).toBe(true));
  it('block is a container', () => expect(isContainer('block')).toBe(true));
  it('generator is not a container', () => expect(isContainer('generator')).toBe(false));
  it('sensor is not a container', () => expect(isContainer('sensor')).toBe(false));
  it('unknown type is not a container', () => expect(isContainer('quantum_device')).toBe(false));
  it('empty string is not a container', () => expect(isContainer('')).toBe(false));
});
