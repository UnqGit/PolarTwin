import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';
import { useStation } from './StationContext';
import { api } from '../lib/api';
import { TypeIcon } from './TypeIcon';
import { ConnectionsList } from './ConnectionsList';
import { Network, Link2, Sliders, ChevronRight, Eye, EyeOff, Focus, Edit2 } from 'lucide-react';
import { useTheme } from './ThemeContext';

const PANEL_BORDER = '1px solid var(--border-color)';
const ITEM_HEIGHT = 26;
const ICON_INDENT = 16;

function findPath(root: NodeLayout, targetName: string): string[] | null {
  if (root.name === targetName) return [root.name];
  for (const child of root.children) {
    const path = findPath(child, targetName);
    if (path) return [root.name, ...path];
  }
  return null;
}

function findNode(root: NodeLayout, targetName: string): NodeLayout | null {
  if (root.name === targetName) return root;
  for (const child of root.children) {
    const found = findNode(child, targetName);
    if (found) return found;
  }
  return null;
}

interface TreeNodeProps {
  node: NodeLayout;
  depth: number;
  expandedSet: Set<string>;
  toggleExpanded: (name: string) => void;
  isEditingInitials?: boolean;
  onEditInitials?: (name: string, type: 'component' | 'connection') => void;
  hideSensors?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, expandedSet, toggleExpanded, isEditingInitials, onEditInitials, hideSensors }) => {
  const { selectedName, setSelectedName, hiddenSet, toggleVisibility } = useSelection();
  
  const isSelected = selectedName === node.name;
  const isExpanded = expandedSet.has(node.name);
  const hasChildren = node.children.length > 0;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedName(isSelected ? null : node.name);
  }, [isSelected, node.name, setSelectedName]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) toggleExpanded(node.name);
  }, [hasChildren, node.name, toggleExpanded]);

  if (hideSensors && (node.type === 'sensor' || node.type === 'sensor array')) {
    return null;
  }

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: ITEM_HEIGHT,
          paddingLeft: depth * ICON_INDENT + 6,
          cursor: 'pointer',
          background: isSelected ? 'rgba(34,211,238,0.15)' : undefined,
          borderLeft: isSelected ? '2px solid var(--accent-cyan)' : '2px solid transparent',
          userSelect: 'none',
          fontSize: 12,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          gap: 5,
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
      >
        <span
          onClick={handleToggle}
          style={{
            display: 'inline-flex', width: 14, height: 14,
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--text-tertiary)', fontSize: 9,
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s ease',
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
        >
          <ChevronRight size={14} />
        </span>
        <TypeIcon type={node.type} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10, marginLeft: 'auto', paddingRight: 6, flexShrink: 0 }}>
          {node.type}
        </span>
        {isEditingInitials && (
          <span 
            onClick={(e) => { e.stopPropagation(); onEditInitials?.(node.name, 'component'); }}
            style={{ cursor: 'pointer', paddingRight: 6, display: 'flex', alignItems: 'center' }}
            title="Edit Initials"
          >
            <Edit2 size={14} color="var(--text-secondary)" />
          </span>
        )}
        <span
          onClick={(e) => { e.stopPropagation(); toggleVisibility(node.name); }}
          style={{
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px',
            color: hiddenSet.has(node.name) ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            opacity: hiddenSet.has(node.name) ? 0.5 : 1,
          }}
          title={hiddenSet.has(node.name) ? 'Show component' : 'Hide component'}
        >
          {hiddenSet.has(node.name) ? <EyeOff size={14} /> : <Eye size={14} />}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.name} node={child} depth={depth + 1} expandedSet={expandedSet} toggleExpanded={toggleExpanded} isEditingInitials={isEditingInitials} onEditInitials={onEditInitials} hideSensors={hideSensors} />
          ))}
        </div>
      )}
    </div>
  );
};

export interface HierarchyPanelProps {
  root: NodeLayout;
  connections: ConnectionLayout[];
  componentsInteractable: boolean;
  connectionsInteractable: boolean;
  onComponentsInteractableChange?: (val: boolean) => void;
  onConnectionsInteractableChange?: (val: boolean) => void;
  hideAllComponents?: boolean;
  hideAllConnections?: boolean;
  onHideAllComponentsChange?: (val: boolean) => void;
  onHideAllConnectionsChange?: (val: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  liveStateRef?: any;
  onResetCamera?: () => void;
  activeLayer?: number | null;
  setActiveLayer?: (layer: number | null) => void;
  onShowGraph?: () => void;
  customSidebarTabs?: { id: string, icon: React.ReactNode, title: string, content: React.ReactNode }[];
  lightingMode?: 'dynamic' | 'static' | 'off';
  onLightingModeChange?: (mode: 'dynamic' | 'static' | 'off') => void;
  containerOcclusion?: 'off' | 'off_on_hover';
  onContainerOcclusionChange?: (mode: 'off' | 'off_on_hover') => void;
  bottomOffset?: number;
  hideEditInitials?: boolean;
  hideSettings?: boolean;
  hideSensors?: boolean;
  isEditingInitials?: boolean;
  setIsEditingInitials?: (val: boolean) => void;
  onSetInitials?: (component: string, key: string, value: number) => void;
  onResetInitials?: (component: string) => void;
  valueOverrides?: Record<string, Record<string, number>>;
  runtime?: any[] | null;
}

export const UNIT_MULTIPLIERS: Record<string, number> = {
  "V": 1.0, "mV": 1e-3, "kV": 1e3,
  "A": 1.0, "mA": 1e-3,
  "W": 1.0, "kW": 1e3,
  "J": 1.0, "kJ": 1e3, "Wh": 3600.0, "kWh": 3.6e6,
  "W/m2": 1.0,
  "Hz": 1.0, "kHz": 1e3, "MHz": 1e6, "mHz": 1e-3,
  "L/s": 1.0, "cc/s": 1e-3, "m3/hr": 1000.0 / 3600.0, "CFM": 28.316846592 / 60.0, "L/hr": 1.0 / 3600.0, "ltr/hr": 1.0 / 3600.0,
  "ppm": 1.0, "bpm": 1.0,
  "%": 0.01,
  "L": 1.0, "m3": 1000.0, "cm3": 1e-3, "ml": 1e-3,
  "kg": 1.0, "g": 1e-3, "mg": 1e-6,
};

const AVAILABLE_UNITS: Record<string, string[]> = {
  voltage: ['V', 'mV', 'kV'],
  current: ['A', 'mA'],
  power: ['W', 'kW'],
  energy: ['J', 'kJ', 'Wh', 'kWh'],
  light_irradiance: ['W/m2'],
  frequency: ['Hz', 'kHz', 'MHz', 'mHz'],
  temperature: ['C', 'K', 'F'],
  flowrate: ['L/s', 'cc/s', 'm3/hr', 'CFM', 'L/hr'],
  air_particulates: ['ppm', 'bpm'],
  o2_level: ['0-1', '%'],
  co2_level: ['0-1', '%'],
  volume: ['L', 'm3', 'cm3', 'ml'],
  weight: ['kg', 'g', 'mg']
};

const toCanonical = (value: number, unit: string) => {
  if (unit === 'C') return value;
  if (unit === 'K') return value - 273.15;
  if (unit === 'F') return (value - 32) * 5.0 / 9.0;
  if (unit === '0-1') return value;
  
  const mult = UNIT_MULTIPLIERS[unit];
  if (mult !== undefined) return value * mult;
  return value;
};

export const fromCanonical = (value: number, unit: string) => {
  if (unit === 'C') return value;
  if (unit === 'K') return value + 273.15;
  if (unit === 'F') return (value * 9.0 / 5.0) + 32;
  if (unit === '0-1') return value;
  
  const mult = UNIT_MULTIPLIERS[unit];
  if (mult !== undefined) return value / mult;
  return value;
};

export const HierarchyPanel: React.FC<HierarchyPanelProps> = ({
  root, connections, componentsInteractable, connectionsInteractable,
  onComponentsInteractableChange, onConnectionsInteractableChange,
  hideAllComponents, hideAllConnections,
  onHideAllComponentsChange, onHideAllConnectionsChange,
  onResetCamera, activeLayer = null, setActiveLayer,
  onShowGraph, customSidebarTabs,
  lightingMode, onLightingModeChange,
  containerOcclusion, onContainerOcclusionChange,
  bottomOffset = 0, hideEditInitials = false,
  hideSettings = false, hideSensors = false,
  liveStateRef,
  isEditingInitials: externalIsEditingInitials,
  setIsEditingInitials: externalSetIsEditingInitials,
  onSetInitials,
  onResetInitials,
  valueOverrides = {},
  runtime = null
}) => {
  const [activeView, setActiveView] = useState<string | null>('hierarchy');
  const [internalIsEditingInitials, setInternalIsEditingInitials] = useState(false);
  const isEditingInitials = externalIsEditingInitials !== undefined ? externalIsEditingInitials : internalIsEditingInitials;
  const setIsEditingInitials = externalSetIsEditingInitials || setInternalIsEditingInitials;
  const [editingTarget, setEditingTarget] = useState<{name: string, type: 'component' | 'connection'} | null>(null);
  const [unitSelections, setUnitSelections] = useState<Record<string, string>>({});
  
  const { selectedName } = useSelection();
  const { runId } = useStation();
  const isOpen = activeView !== null;

  // Clear editing state when view changes or another component is selected
  useEffect(() => {
    setEditingTarget(null);
  }, [activeView, isEditingInitials]);

  useEffect(() => {
    if (editingTarget && selectedName && selectedName !== editingTarget.name) {
      setEditingTarget(null);
    }
  }, [selectedName, editingTarget]);

  const [panelWidth, setPanelWidth] = useState(300);
  const isResizing = React.useRef(false);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setPanelWidth(newWidth);
      }
    };
    const handlePointerUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const startResizing = (e: React.PointerEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set([root.name]));

  const toggleExpanded = useCallback((name: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const getAllNodesWithChildren = (node: any, set: Set<string>) => {
    if (node.children && node.children.length > 0) {
      set.add(node.name);
      for (const child of node.children) {
        getAllNodesWithChildren(child, set);
      }
    }
  };

  const expandAllHierarchy = () => {
    const next = new Set<string>();
    getAllNodesWithChildren(root, next);
    setExpandedSet(next);
  };

  const collapseAllHierarchy = () => {
    setExpandedSet(new Set([root.name]));
  };

  const allExpandableNodes = useMemo(() => {
    const set = new Set<string>();
    getAllNodesWithChildren(root, set);
    return set;
  }, [root]);

  const allHierarchyExpanded = allExpandableNodes.size > 0 && 
    Array.from<string>(allExpandableNodes).every(name => expandedSet.has(name));

  // Context-aware auto-expand
  useEffect(() => {
    if (selectedName && activeView === 'hierarchy' && isOpen) {
      const path = findPath(root, selectedName);
      if (path) {
        setExpandedSet(prev => {
          const next = new Set(prev);
          let changed = false;
          for (const p of path) {
            if (!next.has(p)) {
              next.add(p);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    }
  }, [selectedName, root, activeView, isOpen]);

  const toggleView = (view: string) => {
    if (activeView === view) setActiveView(null);
    else setActiveView(view);
  };

  const IconBtn = ({ icon, active, onClick, title }: any) => (
    <div 
      onClick={onClick}
      title={title}
      style={{
        width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        borderLeft: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
        background: active ? 'var(--hover-overlay)' : 'transparent',
      }}
    >
      {icon}
    </div>
  );

  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, bottom: bottomOffset,
      display: 'flex', flexDirection: 'row-reverse', zIndex: 20,
      pointerEvents: 'none',
      transition: 'bottom 0.3s ease',
    }}>
      {editingTarget && (
        <div style={{
          position: 'relative', width: 320, background: 'var(--bg-panel)', backdropFilter: 'blur(8px)',
          borderRight: PANEL_BORDER, display: 'flex', flexDirection: 'column',
          pointerEvents: 'auto', boxShadow: '4px 0 15px rgba(0,0,0,0.3)',
          overflowY: 'auto', zIndex: 15
        }}>
           <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
             <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
               Edit Initials ({editingTarget.type === 'connection' ? editingTarget.name.replace('-to-', ' → ').replace(/-/g, ' ') : editingTarget.name})
             </h3>
             <button onClick={() => setEditingTarget(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20 }}>&times;</button>
           </div>
           <div style={{ padding: '16px', fontSize: 13, flex: 1, overflowY: 'auto' }}>
             {/* Dynamic fields from spec */}
             {(() => {
                const node = root ? findNode(root, editingTarget.name) : null;
                const specObj = node?.spec || {};
                
                const inputs: string[] = [];
                const states: string[] = [];
                const outputs: string[] = [];
                
                const CANONICAL_UNITS: Record<string, string> = {
                  voltage: 'V', current: 'A', power: 'W', energy: 'J', 
                  light_irradiance: 'W/m2', frequency: 'Hz', temperature: 'C', 
                  flowrate: 'L/s', air_particulates: 'ppm', o2_level: '0-1', 
                  co2_level: '0-1', volume: 'L', weight: 'kg'
                };

                if (specObj.rating) {
                   for (const k of Object.keys((specObj.rating as any).input || {})) inputs.push(k);
                   for (const k of Object.keys((specObj.rating as any).state || {})) states.push(k);
                   for (const k of Object.keys((specObj.rating as any).output || {})) outputs.push(k);
                }
                
                const renderInput = (key: string, category: string) => {
                   const detail = (specObj.rating as any)?.[category]?.[key];
                   if (detail?.min === undefined || detail?.max === undefined) return null;
                   
                   const originalUnit = detail?.unit || '';
                   const availableUnits = AVAILABLE_UNITS[key];
                   const canonicalUnit = availableUnits ? availableUnits[0] : originalUnit;
                   
                   const unitSelectionKey = `${editingTarget.name}-${key}`;
                   const selectedUnit = unitSelections[unitSelectionKey] || canonicalUnit;
                   
                   const runtimeComponent = runtime?.find(c => c.name === editingTarget.name);
                   const canonicalVal = runtimeComponent?.value?.[key] ?? detail?.value ?? '';
                   
                   // Only use valueOverrides for the controlled input value so placeholder shows the default
                   const rawVal = valueOverrides?.[editingTarget.name]?.[key] ?? '';
                   
                   // Convert values to selected unit for display
                   const displayRawVal = rawVal !== '' ? fromCanonical(rawVal as number, selectedUnit) : '';
                   const val = displayRawVal !== '' ? (typeof displayRawVal === 'object' ? JSON.stringify(displayRawVal) : String(Math.round(Number(displayRawVal) * 10000) / 10000)) : '';
                   
                   const displayCanonicalVal = canonicalVal !== '' ? fromCanonical(canonicalVal as number, selectedUnit) : '';
                   const placeholder = displayCanonicalVal !== '' ? (typeof displayCanonicalVal === 'object' ? JSON.stringify(displayCanonicalVal) : String(Math.round(Number(displayCanonicalVal) * 10000) / 10000)) : '';

                   return (
                     <div key={`${editingTarget.name}-${key}-${val}-${selectedUnit}`} style={{ marginBottom: 12 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                         <label style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{key}</label>
                         {availableUnits ? (
                           <select
                             value={selectedUnit}
                             onChange={(e) => setUnitSelections(prev => ({ ...prev, [unitSelectionKey]: e.target.value }))}
                             style={{ background: 'var(--bg-input)', border: '1px solid var(--border-solid)', color: 'var(--text-primary)', fontSize: 10, borderRadius: 2, padding: '2px 4px' }}
                           >
                             {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                           </select>
                         ) : (
                           <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{selectedUnit}</span>
                         )}
                       </div>
                       <input 
                         type="text" 
                         defaultValue={val} 
                         placeholder={placeholder}
                         onBlur={(e) => {
                           const numVal = parseFloat(e.target.value);
                           if (!isNaN(numVal)) {
                             const canonicalNumVal = toCanonical(numVal, selectedUnit);
                             if (onSetInitials) {
                               onSetInitials(editingTarget.name, key, canonicalNumVal);
                             } else if (runId && editingTarget) {
                               api.setComponentState(runId, editingTarget.name, { [key]: canonicalNumVal });
                             }
                           }
                         }}
                         style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-solid)', color: 'var(--text-primary)', padding: '6px', borderRadius: 4 }} 
                       />
                     </div>
                   );
                };

                return (
                  <>
                    <div key={`${editingTarget.name}-tolerance-${valueOverrides?.[editingTarget.name]?.tolerance ?? (specObj.tolerance as number) || 10}`} style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: 11 }}>Individual Tolerance</label>
                      <input 
                        type="number" 
                        defaultValue={valueOverrides?.[editingTarget.name]?.tolerance ?? (specObj.tolerance as number) || 10} 
                        onBlur={(e) => {
                          const numVal = parseFloat(e.target.value);
                          if (!isNaN(numVal)) {
                            if (onSetInitials) {
                              onSetInitials(editingTarget.name, 'tolerance', numVal);
                            } else if (runId && editingTarget) {
                              api.setComponentTolerance(runId, editingTarget.name, numVal);
                            }
                          }
                        }}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-solid)', color: 'var(--text-primary)', padding: '6px', borderRadius: 4 }} 
                      />
                    </div>

                    {inputs.length > 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic', marginBottom: 8, marginTop: 16 }}>input:</div>}
                    {inputs.map(k => renderInput(k, 'input'))}
                    
                    {states.length > 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic', marginBottom: 8, marginTop: 16 }}>state:</div>}
                    {states.map(k => renderInput(k, 'state'))}
                    
                    {outputs.length > 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic', marginBottom: 8, marginTop: 16 }}>output:</div>}
                    {outputs.map(k => renderInput(k, 'output'))}
                  </>
                );
             })()}

             <div style={{ display: 'flex', gap: 8, marginBottom: 16, marginTop: 16 }}>
               <button style={{ flex: 1, background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: 'var(--text-primary)', padding: '6px', borderRadius: 4, cursor: 'pointer' }} onClick={() => { 
                 if (onResetInitials && editingTarget) {
                   onResetInitials(editingTarget.name);
                 } else if (runId && editingTarget) {
                   // When running, just reset to some default
                   api.setComponentTolerance(runId, editingTarget.name, 10); 
                 }
               }}>Reset All Component Fields</button>
             </div>
             <div style={{ color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic' }}>
               Changes are synced with backend automatically.
             </div>
           </div>
        </div>
      )}

      {/* Panel Area */}
      {isOpen && (
        <div style={{
          position: 'relative', width: panelWidth, background: 'var(--bg-panel)', backdropFilter: 'blur(8px)',
          borderRight: PANEL_BORDER, display: 'flex', flexDirection: 'column',
          pointerEvents: 'auto', boxShadow: '4px 0 15px rgba(0,0,0,0.3)',
        }}>
          {/* Resizer Handle */}
          <div
            onPointerDown={startResizing}
            onMouseEnter={(e) => { (e.target as HTMLDivElement).style.background = 'rgba(56, 189, 248, 0.4)'; }}
            onMouseLeave={(e) => { (e.target as HTMLDivElement).style.background = 'transparent'; }}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
              cursor: 'col-resize', zIndex: 30, background: 'transparent',
              transition: 'background 0.2s',
            }}
          />
          <div style={{ padding: '10px 14px', borderBottom: PANEL_BORDER, fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span>
               {activeView === 'hierarchy' ? 'Hierarchy Tree' : 
                activeView === 'connections' ? 'Connections List' : 
                activeView === 'interactivity' ? 'Settings' :
                customSidebarTabs?.find(t => t.id === activeView)?.title || 'Settings'}
             </span>
             {activeView === 'hierarchy' && (
               <div style={{ display: 'flex', gap: 4, textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>
                  {!hideEditInitials && (
                    <button 
                      onClick={() => setIsEditingInitials(!isEditingInitials)} 
                      style={{ background: isEditingInitials ? 'var(--accent-blue)' : 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: isEditingInitials ? '#fff' : 'var(--text-secondary)', borderRadius: 4, padding: '4px 6px', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Edit Initials"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                  )}
                  {allHierarchyExpanded ? (
                    <button onClick={collapseAllHierarchy} style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>Collapse All</button>
                  ) : (
                    <button onClick={expandAllHierarchy} style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>Expand All</button>
                  )}
               </div>
             )}
             {activeView === 'connections' && !hideEditInitials && (
               <div style={{ display: 'flex', gap: 4, textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>
                  <button 
                    onClick={() => setIsEditingInitials(!isEditingInitials)} 
                    style={{ background: isEditingInitials ? 'var(--accent-blue)' : 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: isEditingInitials ? '#fff' : 'var(--text-secondary)', borderRadius: 4, padding: '4px 6px', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title="Edit Initials"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </button>
               </div>
             )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
             {activeView === 'hierarchy' && <TreeNode node={root} depth={0} expandedSet={expandedSet} toggleExpanded={toggleExpanded} isEditingInitials={isEditingInitials} onEditInitials={(name, type) => setEditingTarget({ name, type })} hideSensors={hideSensors} />}
             {activeView === 'connections' && <ConnectionsList connections={connections} isEditingInitials={isEditingInitials} onEditInitials={(name, type) => setEditingTarget({ name, type })} />}
             {activeView === 'interactivity' && (
               <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <span>Interactivity</span>
                   <input 
                     type="checkbox" 
                     checked={componentsInteractable && connectionsInteractable} 
                     onChange={(e) => {
                       const checked = e.target.checked;
                       onComponentsInteractableChange?.(checked);
                       onConnectionsInteractableChange?.(checked);
                     }}
                     style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                   />
                 </div>
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Components Interactable</span>
                   <input type="checkbox" checked={componentsInteractable} onChange={(e) => onComponentsInteractableChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                 </label>
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Connections Interactable</span>
                   <input type="checkbox" checked={connectionsInteractable} onChange={(e) => onConnectionsInteractableChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                 </label>
                 
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginTop: 8 }}>
                     <span>Interactable Floor Level</span>
                      <input 
                        type="number"
                        value={activeLayer === null ? '' : activeLayer} 
                        onChange={(e) => setActiveLayer?.(e.target.value === '' ? null : Number(e.target.value))}
                        style={{ background: 'var(--bg-panel-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', borderRadius: 4, padding: '2px 4px', outline: 'none', cursor: 'text', width: 60, textAlign: 'center' }}
                        placeholder="0"
                      />
                   </label>
                 
                 <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', marginTop: 12, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <span>View</span>
                   <input 
                     type="checkbox" 
                     checked={!!hideAllComponents && !!hideAllConnections} 
                     onChange={(e) => {
                       const checked = e.target.checked;
                       onHideAllComponentsChange?.(checked);
                       onHideAllConnectionsChange?.(checked);
                     }}
                     style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
                   />
                 </div>
                 {onLightingModeChange && (
                   <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                     <span>Lighting</span>
                     <select 
                       value={lightingMode} 
                       onChange={e => onLightingModeChange(e.target.value as any)}
                       style={{ background: 'var(--bg-panel-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', borderRadius: 4, padding: '2px 4px', outline: 'none', cursor: 'pointer' }}
                     >
                       <option value="dynamic">Dynamic</option>
                       <option value="static">Static</option>
                       <option value="off">Off</option>
                     </select>
                   </label>
                 )}
                 {onContainerOcclusionChange && (
                   <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                     <span>Occlusion</span>
                     <select 
                       value={containerOcclusion} 
                       onChange={e => onContainerOcclusionChange(e.target.value as any)}
                       style={{ background: 'var(--bg-panel-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', borderRadius: 4, padding: '2px 4px', outline: 'none', cursor: 'pointer' }}
                     >
                       <option value="off">Translucent</option>
                       <option value="off_on_hover">Opaque (Off on hover)</option>
                     </select>
                   </label>
                 )}
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Hide All Components</span>
                   <input type="checkbox" checked={!!hideAllComponents} onChange={(e) => onHideAllComponentsChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                 </label>
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Hide All Connections</span>
                   <input type="checkbox" checked={!!hideAllConnections} onChange={(e) => onHideAllConnectionsChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                 </label>
               </div>
             )}
             
             {customSidebarTabs?.map(tab => (
               activeView === tab.id && <React.Fragment key={tab.id}>{tab.content}</React.Fragment>
             ))}
          </div>
        </div>
      )}

      {/* Activity Bar */}
      <div style={{
        width: 48, background: 'var(--bg-panel-solid)', borderRight: PANEL_BORDER,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 8, paddingBottom: 8, boxSizing: 'border-box', pointerEvents: 'auto',
      }}>
        <IconBtn icon={<Network size={20} />} active={activeView === 'hierarchy'} onClick={() => toggleView('hierarchy')} title="Hierarchy" />
        <IconBtn icon={<Link2 size={20} />} active={activeView === 'connections'} onClick={() => toggleView('connections')} title="Connections" />
        {!hideSettings && <IconBtn icon={<Sliders size={20} />} active={activeView === 'interactivity'} onClick={() => toggleView('interactivity')} title="Settings" />}
        
        {customSidebarTabs?.map(tab => (
          <IconBtn key={tab.id} icon={tab.icon} active={activeView === tab.id} onClick={() => toggleView(tab.id)} title={tab.title} />
        ))}

        <div style={{ flex: 1 }} /> {/* spacer */}
        
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {onResetCamera && (
            <IconBtn icon={<Focus size={20} />} onClick={onResetCamera} title="Reset View" />
          )}
        </div>
      </div>
    </div>
  );
};