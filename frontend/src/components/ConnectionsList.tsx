import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Edit2, Eye, EyeOff, PanelLeft, Search, X, GitFork, Compass,
  Zap, Radio, Droplets, Activity, Box, Filter, ChevronDown, ChevronRight
} from 'lucide-react';
import type { ConnectionLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';
import { Dropdown } from './Dropdown';

interface ConnectionsListProps {
  connections: ConnectionLayout[];
  onShowGraph?: () => void;
  isEditingInitials?: boolean;
  onEditInitials?: (name: string, type: 'component' | 'connection') => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeFilterMedium?: string;
  onSelectFilterMedium?: (m: string) => void;
  onTraceCircuit?: (name: string, mode: 'upstream' | 'downstream') => void;
  onFocusNode?: (name: string) => void;
  liveStateRef?: React.MutableRefObject<Record<string, unknown>>;
}

const MEDIUM_COLORS: Record<string, string> = {
  power: '#f8d57e',
  data: '#a78bfa',
  fluid: '#38d9f5',
  resource: '#38d9f5',
  signal: '#50dbc0',
  mechanical: '#fb923c'
};

function normalizeMedium(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('power') || t.includes('electric') || t.includes('wire') || t.includes('volt')) return 'power';
  if (t.includes('data') || t.includes('modbus') || t.includes('ethernet') || t.includes('comms')) return 'data';
  if (t.includes('fluid') || t.includes('water') || t.includes('glycol') || t.includes('pipe') || t.includes('resource') || t.includes('cool')) return 'fluid';
  if (t.includes('signal') || t.includes('sensor') || t.includes('rf') || t.includes('telemetry')) return 'signal';
  if (t.includes('mech') || t.includes('hallway') || t.includes('shaft') || t.includes('corridor')) return 'mechanical';
  return 'data';
}

function getMediumIcon(medium: string) {
  switch (medium) {
    case 'power': return <Zap size={12} color={MEDIUM_COLORS.power} />;
    case 'data': return <Radio size={12} color={MEDIUM_COLORS.data} />;
    case 'fluid':
    case 'resource': return <Droplets size={12} color={MEDIUM_COLORS.fluid} />;
    case 'signal': return <Activity size={12} color={MEDIUM_COLORS.signal} />;
    default: return <Box size={12} color={MEDIUM_COLORS.mechanical} />;
  }
}

export const ConnectionsList: React.FC<ConnectionsListProps> = ({
  connections,
  onShowGraph,
  isEditingInitials,
  onEditInitials,
  isSidebarOpen = true,
  onToggleSidebar,
  activeFilterMedium,
  onSelectFilterMedium,
  onTraceCircuit,
  onFocusNode,
  liveStateRef
}) => {
  const { selectedName, setSelectedName, hiddenSet, toggleVisibility } = useSelection();
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [sortBy, setSortBy] = useState<'source' | 'target' | 'type'>('type');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { filtered, grouped, sortedKeys } = useMemo(() => {
    // Filter
    const f = connections.filter(c => {
      const connType = c.connectionType || (c as any).type || '';
      if (activeFilterMedium && activeFilterMedium !== 'all') {
        const med = normalizeMedium(connType);
        if (med !== activeFilterMedium) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.source.toLowerCase().includes(q) ||
        c.target.toLowerCase().includes(q) ||
        connType.toLowerCase().includes(q) ||
        (c.relation && c.relation.toLowerCase().includes(q))
      );
    });

    // Group by chosen sort property
    const g = new Map<string, ConnectionLayout[]>();
    for (const c of f) {
      const connType = c.connectionType || (c as any).type || 'unspecified';
      const key = sortBy === 'source' ? c.source : sortBy === 'target' ? c.target : connType;
      const arr = g.get(key) || [];
      arr.push(c);
      g.set(key, arr);
    }

    // Sort groups alphabetically
    const s = Array.from(g.keys()).sort();
    return { filtered: f, grouped: g, sortedKeys: s };
  }, [connections, search, sortBy, activeFilterMedium]);

  // Default expand all on initial load or sort change
  useEffect(() => {
    if (sortedKeys.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(sortedKeys));
    }
  }, [sortedKeys]);

  // Scroll to selected and auto-expand groups
  useEffect(() => {
    if (selectedName) {
      let groupToExpand: string | null = null;
      for (const [groupKey, items] of grouped.entries()) {
        if (items.some(c => c.id === selectedName || c.source === selectedName || c.target === selectedName)) {
          groupToExpand = groupKey;
          break;
        }
      }

      if (groupToExpand) {
        setExpandedGroups(prev => {
          if (prev.has(groupToExpand!)) return prev;
          const next = new Set(prev);
          next.add(groupToExpand!);
          return next;
        });
      }

      setTimeout(() => {
        const el = itemRefs.current.get(selectedName);
        if (el && containerRef.current) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }, [selectedName, grouped]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpandedGroups(new Set(sortedKeys));
  const collapseAll = () => setExpandedGroups(new Set());

  const live = liveStateRef?.current || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Header / Search */}
      <div style={{ padding: '10px 12px', borderBottom: isSidebarOpen ? '1px solid var(--border-color)' : 'none', flexShrink: 0 }}>
        {isSidebarOpen ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Connections
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(80, 219, 192, 0.15)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {filtered.length}
                </span>
              </div>

              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className="btn-icon"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Collapse sidebar"
                >
                  <PanelLeft size={16} />
                </button>
              )}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: 8, color: 'var(--text-tertiary)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search circuits..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 26px 6px 26px',
                  fontSize: 12,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sort & Expand Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <span>Group:</span>
                <Dropdown
                  value={sortBy}
                  onChange={val => setSortBy(val as 'source' | 'target' | 'type')}
                  options={[
                    { value: 'type', label: 'Type' },
                    { value: 'source', label: 'Source' },
                    { value: 'target', label: 'Target' }
                  ]}
                  style={{ minWidth: 80 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {sortedKeys.length > 0 && expandedGroups.size > 0 ? (
                  <button onClick={collapseAll} className="btn btn-sm btn-secondary" style={{ fontSize: 10, padding: '2px 6px' }}>
                    Collapse
                  </button>
                ) : (
                  <button onClick={expandAll} className="btn btn-sm btn-secondary" style={{ fontSize: 10, padding: '2px 6px' }}>
                    Expand
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Expand sidebar"
              >
                <PanelLeft size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main List */}
      {isSidebarOpen && (
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {sortedKeys.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center' }}>
              No connections match search.
            </div>
          ) : (
            sortedKeys.map((groupKey, idx) => {
              const groupConnections = grouped.get(groupKey)!;
              const isCollapsed = !expandedGroups.has(groupKey);
              const hasSelectedChild = groupConnections.some(
                c => c.id === selectedName || c.source === selectedName || c.target === selectedName
              );

              return (
                <div key={groupKey} style={{ marginBottom: 4 }}>
                  {/* Group Header */}
                  <div
                    onClick={() => toggleGroup(groupKey)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: hasSelectedChild ? 'var(--accent-surface)' : 'rgba(255,255,255,0.02)',
                      borderLeft: `3px solid ${hasSelectedChild ? 'var(--accent-primary)' : 'transparent'}`,
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (!hasSelectedChild) (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)';
                    }}
                    onMouseLeave={e => {
                      if (!hasSelectedChild) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          transform: isCollapsed ? 'none' : 'rotate(90deg)',
                          transition: 'transform 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: 'var(--text-tertiary)'
                        }}
                      >
                        <ChevronRight size={13} />
                      </span>
                      <span style={{ fontWeight: 700 }}>{groupKey}</span>
                    </div>

                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                      {groupConnections.length}
                    </span>
                  </div>

                  {/* Group Items */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '2px 0' }}>
                      {groupConnections.map((c) => {
                        const isSelected = selectedName === c.id || selectedName === c.source || selectedName === c.target;
                        const medium = normalizeMedium(c.connectionType);
                        const medColor = MEDIUM_COLORS[medium] || '#a78bfa';

                        const liveState = (live as any)[c.id];
                        let statusColor = '#4ade80';
                        if (liveState?.status === 'fault' || liveState?.status === 'failure') {
                          statusColor = '#f87171';
                        } else if (liveState?.status === 'warning') {
                          statusColor = '#f8d57e';
                        }

                        return (
                          <div
                            key={c.id}
                            ref={el => {
                              if (el) itemRefs.current.set(c.id, el);
                              else itemRefs.current.delete(c.id);
                            }}
                            onClick={() => setSelectedName(c.id)}
                            style={{
                              padding: '6px 14px 6px 24px',
                              cursor: 'pointer',
                              background: isSelected ? 'var(--accent-surface)' : 'transparent',
                              borderLeft: `3px solid ${isSelected ? 'var(--accent-primary)' : 'transparent'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)';
                            }}
                            onMouseLeave={e => {
                              if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                  <span>{c.source}</span> <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>→</span> <span>{c.target}</span>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ color: medColor, fontWeight: 600 }}>{c.connectionType || (c as any).type}</span>
                                  {c.relation && <span>· {c.relation}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {onFocusNode && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onFocusNode(c.source);
                                  }}
                                  style={{ cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)' }}
                                  title="Focus in graph"
                                >
                                  <Compass size={13} />
                                </span>
                              )}

                              {isEditingInitials && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditInitials?.(c.id, 'connection');
                                  }}
                                  style={{ cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)' }}
                                  title="Edit Initials"
                                >
                                  <Edit2 size={12} />
                                </span>
                              )}

                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleVisibility(c.id);
                                }}
                                style={{
                                  cursor: 'pointer',
                                  padding: 2,
                                  color: hiddenSet.has(c.id) ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                }}
                                title={hiddenSet.has(c.id) ? 'Show connection' : 'Hide connection'}
                              >
                                {hiddenSet.has(c.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {idx < sortedKeys.length - 1 && (
                    <div style={{ margin: '4px 14px', borderBottom: '1px solid var(--hover-overlay)' }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
