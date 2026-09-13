/**
 * meshes/index.ts
 *
 * Central export barrel for all mesh components and the MESH_COMPONENT_MAP.
 *
 * ── How to add a new mesh ─────────────────────────────────────────────────────
 *   1. Create src/components/meshes/MyNewMesh.tsx  (implement MeshProps)
 *   2. Import it below and add it to MESH_COMPONENT_MAP
 *   3. Register its type keyword in src/lib/meshRegistry.ts
 *
 * That is all.  The layout engine and renderer require no changes.
 */

import React from 'react';
import type { MeshProps } from './GenericMesh';

import { GenericMesh }     from './GenericMesh';
import { GeneratorMesh }   from './GeneratorMesh';
import { TankMesh }        from './TankMesh';
import { SensorMesh }      from './SensorMesh';
import { ControllerMesh }  from './ControllerMesh';
import { PumpMesh }        from './PumpMesh';
import { BatteryMesh }     from './BatteryMesh';

export type { MeshProps } from './GenericMesh';
export {
  GenericMesh,
  GeneratorMesh,
  TankMesh,
  SensorMesh,
  ControllerMesh,
  PumpMesh,
  BatteryMesh,
};

// MeshProps is re-exported from GenericMesh (canonical definition) on line 25.

/**
 * Maps registry keys (returned by lookupMesh) to the actual React components.
 * TwinNodeRenderer looks up the key from meshRegistry and renders the component.
 *
 * Falls back to GenericMesh when a key is not found — so the renderer never
 * crashes on an unknown type.
 */
export const MESH_COMPONENT_MAP: Record<string, React.FC<MeshProps>> = {
  GenericMesh,
  GeneratorMesh,
  TankMesh,
  SensorMesh,
  ControllerMesh,
  PumpMesh,
  BatteryMesh,
};
