/**
 * SelectionContext.tsx
 *
 * Shared selection state consumed by both the 3D viewport (TwinNodeRenderer)
 * and the hierarchy/data panel (HierarchyPanel).
 *
 * Keeps a single authoritative "selected component name" so both views remain
 * perfectly synchronized without duplicated state.
 */
import { createContext, useContext } from 'react';

export interface SelectionContextValue {
  selectedName: string | null;
  setSelectedName: (name: string | null) => void;
}

export const SelectionContext = createContext<SelectionContextValue>({
  selectedName: null,
  setSelectedName: () => {},
});

export const useSelection = () => useContext(SelectionContext);
