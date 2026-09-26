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
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, expandedSet, toggleExpanded, isEditingInitials, onEditInitials }) => {
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
            <TreeNode key={child.name} node={child} depth={depth + 1} expandedSet={expandedSet} toggleExpanded={toggleExpanded} isEditingInitials={isEditingInitials} onEditInitials={onEditInitials} />
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
}

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
  liveStateRef
}) => {
  const [activeView, setActiveView] = useState<string | null>('hierarchy');
  const [isEditingInitials, setIsEditingInitials] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{name: string, type: 'component' | 'connection'} | null>(null);
  
  const { selectedName } = useSelection();
  const { runId } = useStation();
  const isOpen = activeView !== null;

  // Clear editing state when view changes
  useEffect(() => {
    setEditingTarget(null);
  }, [activeView, isEditingInitials]);

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
                const liveState = (liveStateRef?.current?.[editingTarget.name] ?? {}) as Record<string, unknown>;
                
                const inputs: string[] = [];
                const states: string[] = [];
                const outputs: string[] = [];
                
                if (specObj.rating) {
                   for (const k of Object.keys((specObj.rating as any).input || {})) inputs.push(k);
                   for (const k of Object.keys((specObj.rating as any).state || {})) states.push(k);
                   for (const k of Object.keys((specObj.rating as any).output || {})) outputs.push(k);
                }
                
                const renderInput = (key: string, category: string) => {
                   const detail = (specObj.rating as any)?.[category]?.[key];
                   const unit = detail?.unit || '';
                   const rawVal = liveState[key] ?? detail?.value ?? '';
                   const val = typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal);
                   return (
                     <div key={key} style={{ marginBottom: 12 }}>
                       <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: 11 }}>{key} {unit ? `(${unit})` : ''}</label>
                       <input 
                         type="text" 
                         defaultValue={val} 
                         onBlur={(e) => {
                           if(runId && editingTarget) {
                             const numVal = parseFloat(e.target.value);
                             if (!isNaN(numVal)) {
                               // Assuming we have api.setComponentState or similar
                               api.setComponentState(runId, editingTarget.name, { [key]: numVal });
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
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: 11 }}>Individual Tolerance</label>
                      <input 
                        type="number" 
                        defaultValue={(specObj.tolerance as number) || 10} 
                        onBlur={(e) => {
                           if(runId && editingTarget) api.setComponentTolerance(runId, editingTarget.name, parseFloat(e.target.value));
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
               <button style={{ flex: 1, background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: 'var(--text-primary)', padding: '6px', borderRadius: 4, cursor: 'pointer' }} onClick={() => { if(runId && editingTarget) api.setComponentTolerance(runId, editingTarget.name, 10); }}>Reset Tolerance</button>
               <button style={{ flex: 1, background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: 'var(--text-primary)', padding: '6px', borderRadius: 4, cursor: 'pointer' }} onClick={() => console.log('Reset fields to earlier state')}>Reset Fields</button>
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
                      style={{ background: isEditingInitials ? 'var(--accent-blue)' : 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: isEditingInitials ? '#fff' : 'var(--text-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                    >
                      Edit Initials
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
                    style={{ background: isEditingInitials ? 'var(--accent-blue)' : 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: isEditingInitials ? '#fff' : 'var(--text-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                  >
                    Edit Initials
                  </button>
               </div>
             )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
             {activeView === 'hierarchy' && <TreeNode node={root} depth={0} expandedSet={expandedSet} toggleExpanded={toggleExpanded} isEditingInitials={isEditingInitials} onEditInitials={(name, type) => setEditingTarget({ name, type })} />}
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
        <IconBtn icon={<Sliders size={20} />} active={activeView === 'interactivity'} onClick={() => toggleView('interactivity')} title="Settings" />
        
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