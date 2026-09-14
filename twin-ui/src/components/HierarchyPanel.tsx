import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';
import { TypeIcon } from './TypeIcon';
import { ConnectionsList } from './ConnectionsList';
import { Network, Link2, Sliders, ChevronRight, Eye, EyeOff, Focus } from 'lucide-react';

const PANEL_BORDER = '1px solid rgba(255,255,255,0.08)';
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

interface TreeNodeProps {
  node: NodeLayout;
  depth: number;
  expandedSet: Set<string>;
  toggleExpanded: (name: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, expandedSet, toggleExpanded }) => {
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
          borderLeft: isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          userSelect: 'none',
          fontSize: 12,
          color: isSelected ? '#e2e8f0' : '#94a3b8',
          gap: 5,
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
      >
        <span
          onClick={handleToggle}
          style={{
            display: 'inline-flex', width: 14, height: 14,
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: '#475569', fontSize: 9,
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
        <span style={{ color: '#475569', fontSize: 10, marginLeft: 'auto', paddingRight: 6, flexShrink: 0 }}>
          {node.type}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); toggleVisibility(node.name); }}
          style={{
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px',
            color: hiddenSet.has(node.name) ? '#475569' : '#94a3b8',
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
            <TreeNode key={child.name} node={child} depth={depth + 1} expandedSet={expandedSet} toggleExpanded={toggleExpanded} />
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
}

export const HierarchyPanel: React.FC<HierarchyPanelProps> = ({
  root, connections, componentsInteractable, connectionsInteractable,
  onComponentsInteractableChange, onConnectionsInteractableChange,
  hideAllComponents, hideAllConnections,
  onHideAllComponentsChange, onHideAllConnectionsChange,
  onResetCamera
}) => {
  const [activeView, setActiveView] = useState<'hierarchy' | 'connections' | 'interactivity' | null>('hierarchy');
  const { selectedName } = useSelection();
  const isOpen = activeView !== null;

  const [panelWidth, setPanelWidth] = useState(300);
  const isResizing = React.useRef(false);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
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

  const toggleView = (view: 'hierarchy' | 'connections' | 'interactivity') => {
    if (activeView === view) setActiveView(null);
    else setActiveView(view);
  };

  const IconBtn = ({ icon, active, onClick, title }: any) => (
    <div 
      onClick={onClick}
      title={title}
      style={{
        width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: active ? '#e2e8f0' : '#475569',
        borderLeft: active ? '2px solid #38bdf8' : '2px solid transparent',
        background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
      }}
    >
      {icon}
    </div>
  );

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0,
      display: 'flex', flexDirection: 'row', zIndex: 20,
      pointerEvents: 'none',
    }}>
      {/* Panel Area */}
      {isOpen && (
        <div style={{
          position: 'relative', width: panelWidth, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)',
          borderLeft: PANEL_BORDER, display: 'flex', flexDirection: 'column',
          pointerEvents: 'auto', boxShadow: '-4px 0 15px rgba(0,0,0,0.3)',
        }}>
          {/* Resizer Handle */}
          <div
            onPointerDown={startResizing}
            onMouseEnter={(e) => { (e.target as HTMLDivElement).style.background = 'rgba(56, 189, 248, 0.4)'; }}
            onMouseLeave={(e) => { (e.target as HTMLDivElement).style.background = 'transparent'; }}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
              cursor: 'col-resize', zIndex: 30, background: 'transparent',
              transition: 'background 0.2s',
            }}
          />
          <div style={{ padding: '10px 14px', borderBottom: PANEL_BORDER, fontWeight: 600, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span>
               {activeView === 'hierarchy' ? 'Hierarchy Tree' : 
                activeView === 'connections' ? 'Connections List' : 
                'Settings'}
             </span>
             {activeView === 'hierarchy' && (
               <div style={{ display: 'flex', gap: 4, textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>
                  {allHierarchyExpanded ? (
                    <button onClick={collapseAllHierarchy} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>Collapse All</button>
                  ) : (
                    <button onClick={expandAllHierarchy} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>Expand All</button>
                  )}
               </div>
             )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
             {activeView === 'hierarchy' && <TreeNode node={root} depth={0} expandedSet={expandedSet} toggleExpanded={toggleExpanded} />}
             {activeView === 'connections' && <ConnectionsList connections={connections} />}
             {activeView === 'interactivity' && (
               <div style={{ padding: '16px 14px', fontSize: 13, color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <span>Interactivity</span>
                   <input 
                     type="checkbox" 
                     checked={componentsInteractable && connectionsInteractable} 
                     onChange={(e) => {
                       const checked = e.target.checked;
                       onComponentsInteractableChange?.(checked);
                       onConnectionsInteractableChange?.(checked);
                     }}
                     style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                   />
                 </div>
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Components Interactable</span>
                   <input type="checkbox" checked={componentsInteractable} onChange={(e) => onComponentsInteractableChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#38bdf8' }} />
                 </label>
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Connections Interactable</span>
                   <input type="checkbox" checked={connectionsInteractable} onChange={(e) => onConnectionsInteractableChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#38bdf8' }} />
                 </label>
                 
                 <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', marginTop: 12, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <span>View</span>
                   <input 
                     type="checkbox" 
                     checked={!!hideAllComponents && !!hideAllConnections} 
                     onChange={(e) => {
                       const checked = e.target.checked;
                       onHideAllComponentsChange?.(checked);
                       onHideAllConnectionsChange?.(checked);
                     }}
                     style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                   />
                 </div>
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Hide All Components</span>
                   <input type="checkbox" checked={!!hideAllComponents} onChange={(e) => onHideAllComponentsChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#38bdf8' }} />
                 </label>
                 <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <span>Hide All Connections</span>
                   <input type="checkbox" checked={!!hideAllConnections} onChange={(e) => onHideAllConnectionsChange?.(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#38bdf8' }} />
                 </label>
               </div>
             )}
          </div>
        </div>
      )}
      
      {/* Activity Bar */}
      <div style={{
        width: 48, background: 'rgba(15, 23, 42, 1)', borderLeft: PANEL_BORDER,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 8, pointerEvents: 'auto',
      }}>
        <IconBtn icon={<Network size={20} />} active={activeView === 'hierarchy'} onClick={() => toggleView('hierarchy')} title="Hierarchy" />
        <IconBtn icon={<Link2 size={20} />} active={activeView === 'connections'} onClick={() => toggleView('connections')} title="Connections" />
        <IconBtn icon={<Sliders size={20} />} active={activeView === 'interactivity'} onClick={() => toggleView('interactivity')} title="Settings" />
        
        <div style={{ flex: 1 }} /> {/* spacer */}
        
        {onResetCamera && (
          <div style={{ marginBottom: 16 }}>
            <IconBtn icon={<Focus size={20} />} onClick={onResetCamera} title="Reset View" />
          </div>
        )}
      </div>
    </div>
  );
};
