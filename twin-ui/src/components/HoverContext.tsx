/**
 * HoverContext.tsx
 *
 * Shared context for the centralized hover system.
 *
 * The HoverManager component (defined in TwinViewer.tsx) uses useFrame to
 * raycast every animation frame and writes the name of the deepest
 * (most-specific) intersected component here.
 *
 * Every TwinNodeRenderer reads from this context and compares its own
 * layout.name to determine whether IT is the currently hovered component.
 * This completely eliminates the need for per-group onPointerOver/onPointerOut
 * and the ordering issues that come with R3F's event-bubbling model.
 */

import { createContext } from 'react';

export interface HoverState {
  /** Name of the deepest component currently under the cursor, or null. */
  hoveredName: string | null;
  /** Set containing the hovered name and any related nodes (e.g. source/target of hovered connection) */
  hoveredNodes: Set<string>;
  /** Set containing the ancestors of the hovered component */
  hoveredAncestors: Set<string>;
  /** Set containing the ancestors of the selected component */
  selectedAncestors: Set<string>;
}

export const HoverContext = createContext<HoverState>({ hoveredName: null, hoveredNodes: new Set(), hoveredAncestors: new Set(), selectedAncestors: new Set() });
