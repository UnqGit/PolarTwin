/**
 * meshRegistry.test.ts
 *
 * Unit tests for the mesh registry (pure data — no React or Three.js).
 * Covers:
 *   - Built-in type registrations
 *   - Case-insensitive substring matching
 *   - Generic fallback for unknown types
 *   - Dynamic registration of new types (extensibility requirement)
 */

import { describe, it, expect } from 'vitest';
import { lookupMesh, registerMesh } from '../lib/meshRegistry';

describe('meshRegistry — built-in types', () => {
  it('returns GeneratorMesh for "generator"', () => {
    expect(lookupMesh('generator')).toBe('GeneratorMesh');
  });

  it('returns TankMesh for "tank"', () => {
    expect(lookupMesh('tank')).toBe('TankMesh');
  });

  it('returns PumpMesh for "pump"', () => {
    expect(lookupMesh('pump')).toBe('PumpMesh');
  });

  it('returns PumpMesh for "motor" (reuses sphere shape)', () => {
    expect(lookupMesh('motor')).toBe('PumpMesh');
  });

  it('returns BatteryMesh for "battery"', () => {
    expect(lookupMesh('battery')).toBe('BatteryMesh');
  });

  it('returns SensorMesh for "sensor"', () => {
    expect(lookupMesh('sensor')).toBe('SensorMesh');
  });

  it('returns SensorMesh for "thermometer"', () => {
    expect(lookupMesh('thermometer')).toBe('SensorMesh');
  });

  it('returns SensorMesh for "alarm"', () => {
    expect(lookupMesh('alarm')).toBe('SensorMesh');
  });

  it('returns SensorMesh for "toggle"', () => {
    expect(lookupMesh('toggle')).toBe('SensorMesh');
  });

  it('returns ControllerMesh for "controller"', () => {
    expect(lookupMesh('controller')).toBe('ControllerMesh');
  });
});

describe('meshRegistry — fallback and edge cases', () => {
  it('returns GenericMesh for a completely unknown type', () => {
    expect(lookupMesh('quantum_widget_xyz_9000')).toBe('GenericMesh');
  });

  it('returns GenericMesh for empty string', () => {
    expect(lookupMesh('')).toBe('GenericMesh');
  });

  it('is case-insensitive', () => {
    expect(lookupMesh('GENERATOR')).toBe('GeneratorMesh');
    expect(lookupMesh('Tank')).toBe('TankMesh');
    expect(lookupMesh('SENSOR')).toBe('SensorMesh');
  });

  it('matches substrings (prefix, suffix, embedded)', () => {
    expect(lookupMesh('fuel_sensor')).toBe('SensorMesh');          // prefix
    expect(lookupMesh('main_generator')).toBe('GeneratorMesh');    // suffix
    expect(lookupMesh('diesel_generator_primary')).toBe('GeneratorMesh'); // embedded
  });
});

describe('meshRegistry — dynamic registration (extensibility)', () => {
  it('supports registering a new mesh type at runtime', () => {
    // Before registration
    expect(lookupMesh('solar_panel_array')).toBe('GenericMesh');
    // Register
    registerMesh('solar_panel', 'SolarPanelMesh');
    // After registration
    expect(lookupMesh('solar_panel_array')).toBe('SolarPanelMesh');
  });

  it('newly registered type does not affect unrelated types', () => {
    expect(lookupMesh('generator')).toBe('GeneratorMesh');
    expect(lookupMesh('tank')).toBe('TankMesh');
  });
});
