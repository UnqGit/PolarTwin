/**
 * HierarchyPanel.tsx
 *
 * IDE-style hierarchy panel.  Displays the topology tree in a collapsible
 * tree view (similar to VS Code's file explorer) and shows a property
 * inspector for the selected component.
 *
 * Data is derived entirely from the existing NodeLayout tree and
 * ConnectionLayout list produced by buildSceneLayout — no duplicate model.
 *
 * Hierarchy ↔ viewport synchronization is handled through SelectionContext,
 * which is shared with TwinNodeRenderer so clicking a node here highlights
 * the matching 3D object and vice-versa.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { NodeLayout, ConnectionLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';

// ─── styles (inline — no extra CSS file needed) ────────────────────────────────

const PANEL_BG      = 'rgba(10, 14, 23, 0.97)';
const PANEL_BORDER  = '1px solid rgba(148,163,184,0.1)';
const ITEM_HEIGHT   = 26;
const ICON_INDENT   = 16;

// ─── tree node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: NodeLayout;
  depth: number;
  expandedSet: Set<string>;
  toggleExpanded: (name: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, expandedSet, toggleExpanded }) => {
  const { selectedName, setSelectedName } = useSelection();
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
          background: isSelected
            ? 'rgba(34,211,238,0.15)'
            : undefined,
          borderLeft: isSelected ? '2px solid #22d3ee' : '2px solid transparent',
          userSelect: 'none',
          fontSize: 12,
          color: isSelected ? '#e2e8f0' : '#94a3b8',
          gap: 5,
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
      >
        {/* Expand/collapse arrow */}
        <span
          onClick={handleToggle}
          style={{
            display: 'inline-flex',
            width: 14,
            height: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#475569',
            fontSize: 9,
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s ease',
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
        >
          ▶
        </span>

        {/* Type icon */}
        <TypeIcon type={node.type} />

        {/* Name */}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>

        {/* Type badge */}
        <span style={{ color: '#475569', fontSize: 10, marginLeft: 'auto', paddingRight: 6, flexShrink: 0 }}>
          {node.type}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.name}
              node={child}
              depth={depth + 1}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── type icon ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  campus: '🏙',
  station: '🏭',
  block: '📦',
  system: '⚙',
  subsystem: '🔧',
  generator: '⚡',
  sensor: '📡',
  controller: '🎛',
  battery: '🔋',
  motor: '🔩',
  pump: '💧',
  tank: '🫙',
  alarm: '🔔',
  toggle: '🔘',
  thermometer: '🌡',
};

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const t = (type || '').toLowerCase();
  let icon = '◼';
  for (const [key, val] of Object.entries(TYPE_ICONS)) {
    if (t.includes(key)) { icon = val; break; }
  }
  return <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>;
};

// ─── property inspector ───────────────────────────────────────────────────────

interface InspectorProps {
  node: NodeLayout;
  connections: ConnectionLayout[];
}

const PropertyInspector: React.FC<InspectorProps> = ({ node, connections }) => {
  const nodeConnections = connections.filter(
    c => c.source === node.name || c.target === node.name
  );

  const specEntries = Object.entries(node.spec).filter(
    ([k]) => !['dummy'].includes(k)
  );

  return (
    <div style={{
      padding: '12px 14px',
      fontSize: 12,
      color: '#94a3b8',
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{
        fontWeight: 700,
        fontSize: 13,
        color: '#e2e8f0',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <TypeIcon type={node.type} />
        {node.name}
      </div>

      <Row label="Type" value={node.type} />

      {/* Position */}
      <SectionHeader>Position</SectionHeader>
      <Row label="X" value={node.position[0].toFixed(2)} />
      <Row label="Y" value={node.position[1].toFixed(2)} />
      <Row label="Z" value={node.position[2].toFixed(2)} />

      {/* Dimensions */}
      <SectionHeader>Dimensions</SectionHeader>
      <Row label="Width"  value={node.dims.width.toFixed(2)} />
      <Row label="Height" value={node.dims.height.toFixed(2)} />
      <Row label="Depth"  value={node.dims.depth.toFixed(2)} />

      {/* Spec properties */}
      {specEntries.length > 0 && (
        <>
          <SectionHeader>Properties</SectionHeader>
          {specEntries.map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </>
      )}

      {/* Connections */}
      {nodeConnections.length > 0 && (
        <>
          <SectionHeader>Connections</SectionHeader>
          {nodeConnections.map(c => (
            <div key={c.id} style={{ paddingLeft: 8, marginBottom: 3, color: '#64748b', fontSize: 11 }}>
              <span style={{ color: '#b87333' }}>
                {c.visual === 'wire' ? '━' : c.visual === 'hallway' ? '▬' : '▭'}
              </span>{' '}
              {c.source === node.name ? `→ ${c.target}` : `← ${c.source}`}
              <span style={{ color: '#475569' }}> ({c.connectionType})</span>
            </div>
          ))}
        </>
      )}

      {/* Tags */}
      {node.tags.length > 0 && (
        <>
          <SectionHeader>Tags</SectionHeader>
          <div style={{ paddingLeft: 8, color: '#64748b', fontSize: 11 }}>
            {node.tags.join(', ')}
          </div>
        </>
      )}
    </div>
  );
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    marginTop: 10,
    marginBottom: 4,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#475569',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: 3,
  }}>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 8 }}>
    <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
    <span style={{ color: '#cbd5e1', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {value}
    </span>
  </div>
);

// ─── find node by name ────────────────────────────────────────────────────────

function findNode(root: NodeLayout, name: string): NodeLayout | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

// ─── main panel ───────────────────────────────────────────────────────────────

export interface HierarchyPanelProps {
  root: NodeLayout;
  connections: ConnectionLayout[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const HierarchyPanel: React.FC<HierarchyPanelProps> = ({
  root, connections, collapsed = false, onToggleCollapse,
}) => {
  const { selectedName } = useSelection();
  const selectedNode = useMemo(
    () => (selectedName ? findNode(root, selectedName) : null),
    [root, selectedName]
  );

  // All nodes start collapsed; root expanded by default.
  const [expandedSet, setExpandedSet] = useState<Set<string>>(
    () => new Set([root.name])
  );

  const toggleExpanded = useCallback((name: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const panelWidth = collapsed ? 40 : 280;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: panelWidth,
      display: 'flex',
      flexDirection: 'column',
      background: PANEL_BG,
      borderLeft: PANEL_BORDER,
      backdropFilter: 'blur(12px)',
      zIndex: 10,
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: PANEL_BORDER,
        flexShrink: 0,
      }}>
        {!collapsed && (
          <span style={{ color: '#93c5fd', fontSize: 12, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: '0.04em' }}>
            HIERARCHY
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#475569',
            fontSize: 14,
            padding: '2px 4px',
            marginLeft: 'auto',
            lineHeight: 1,
          }}
        >
          {collapsed ? '«' : '»'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Tree area */}
          <div style={{
            flex: selectedNode ? '0 0 55%' : '1 1 auto',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingTop: 4,
            paddingBottom: 8,
          }}>
            <TreeNode
              node={root}
              depth={0}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
            />
          </div>

          {/* Inspector area — visible only when something is selected */}
          {selectedNode && (
            <div style={{
              flex: '1 1 auto',
              borderTop: PANEL_BORDER,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}>
              {/* Inspector header */}
              <div style={{
                padding: '6px 14px',
                fontSize: 10,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.02)',
              }}>
                Inspector
              </div>
              <PropertyInspector node={selectedNode} connections={connections} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
