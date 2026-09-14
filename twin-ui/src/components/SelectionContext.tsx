/**
 * SelectionContext.tsx
 *
 * Shared selection state consumed by both the 3D viewport (TwinNodeRenderer)
 * and the hierarchy/data panel (HierarchyPanel).
 *
 * Keeps a single authoritative "selected component name" so both views remain
 * perfectly synchronized without duplicated state.
 */
import { createContext, useContext, useState, useMemo } from 'react';

export interface SelectionContextValue {
  selectedName: string | null;
  setSelectedName: (name: string | null) => void;
  hiddenSet: Set<string>;
  toggleVisibility: (name: string) => void;
}

export const SelectionContext = createContext<SelectionContextValue>({
  selectedName: null,
  setSelectedName: () => {},
  hiddenSet: new Set(),
  toggleVisibility: () => {},
});

export const useSelection = () => useContext(SelectionContext);

/**
 * Provider wrapper to hold the state.
 */
export const SelectionProvider: React.FC<{ children: React.ReactNode; externalSelection?: [string | null, (n: string | null) => void] }> = ({ children, externalSelection }) => {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());

  const selectedName = externalSelection ? externalSelection[0] : internalSelected;
  const setSelectedName = externalSelection ? externalSelection[1] : setInternalSelected;

  const toggleVisibility = (name: string) => {
    setHiddenSet(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const value = useMemo(() => ({
    selectedName, setSelectedName, hiddenSet, toggleVisibility
  }), [selectedName, setSelectedName, hiddenSet]);

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
};
