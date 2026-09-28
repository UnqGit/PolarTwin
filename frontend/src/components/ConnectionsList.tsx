import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Eye, EyeOff } from 'lucide-react';
import type { ConnectionLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';

interface ConnectionsListProps {
  connections: ConnectionLayout[];
  onShowGraph?: () => void;
  isEditingInitials?: boolean;
  onEditInitials?: (name: string, type: 'component' | 'connection') => void;
}

export const ConnectionsList: React.FC<ConnectionsListProps> = ({ connections, onShowGraph, isEditingInitials, onEditInitials }) => {
  const { selectedName, setSelectedName, hiddenSet, toggleVisibility } = useSelection();
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [sortBy, setSortBy] = useState<'source' | 'target' | 'type'>('source');

  const { filtered, grouped, sortedKeys } = React.useMemo(() => {
    // Filter
    const f = connections.filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.source.toLowerCase().includes(q) ||
             c.target.toLowerCase().includes(q) ||
             c.connectionType.toLowerCase().includes(q);
    });

    // Group by chosen sort property
    const g = new Map<string, ConnectionLayout[]>();
    for (const c of f) {
      const key = sortBy === 'source' ? c.source : sortBy === 'target' ? c.target : c.connectionType;
      const arr = g.get(key) || [];
      arr.push(c);
      g.set(key, arr);
    }

    // Sort groups alphabetically
    const s = Array.from(g.keys()).sort();
    return { filtered: f, grouped: g, sortedKeys: s };
  }, [connections, search, sortBy]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Scroll to selected and auto-expand groups
  useEffect(() => {
    if (selectedName) {
      // Auto-expand groups containing the selection
      let groupToExpand = null;
      for (const [groupKey, items] of grouped.entries()) {
        if (items.some(c => c.id === selectedName || c.source === selectedName || c.target === selectedName)) {
          groupToExpand = groupKey;
          break;
        }
      }
      
      if (groupToExpand) {
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.add(groupToExpand);
          return next;
        });
      }

      // Small delay to allow render/expansion before scrolling
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <input 
          type="text" 
          placeholder="Search connections..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-solid)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            padding: '6px 10px',
            fontSize: 12,
            outline: 'none',
            marginBottom: 8,
            boxSizing: 'border-box',
          }}
        />
        {onShowGraph && (
          <button
            onClick={onShowGraph}
            style={{
              width: '100%',
              marginBottom: 8,
              padding: '6px',
              backgroundColor: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12,
              boxSizing: 'border-box',
            }}
          >
            Show Graph
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Sort By:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as 'source' | 'target')}
              style={{ 
                background: 'var(--bg-panel-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-solid)', 
                borderRadius: 4, padding: '2px 4px', fontSize: 11, outline: 'none', cursor: 'pointer' 
              }}
            >
              <option value="source">source</option>
              <option value="target">target</option>
              <option value="type">type</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {sortedKeys.length > 0 && expandedGroups.size > 0 ? (
              <button 
                onClick={collapseAll}
                style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
              >
                Collapse All
              </button>
            ) : (
              <button 
                onClick={expandAll}
                style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border-solid)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
              >
                Expand All
              </button>
            )}
          </div>
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {sortedKeys.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 12 }}>No connections match search.</div>
        ) : (
          sortedKeys.map((groupKey, idx) => {
            const groupConnections = grouped.get(groupKey)!;
            // Sort inner items by the other property
            groupConnections.sort((a, b) => {
              const valA = sortBy === 'source' ? a.target : sortBy === 'target' ? a.source : `${a.source}->${a.target}`;
              const valB = sortBy === 'source' ? b.target : sortBy === 'target' ? b.source : `${b.source}->${b.target}`;
              return valA.localeCompare(valB);
            });

            const isCollapsed = !expandedGroups.has(groupKey);
            const headingLabel = sortBy === 'source' ? 'Source:' : sortBy === 'target' ? 'Target:' : 'Type:';
            const hasSelectedChild = groupConnections.some(c => c.id === selectedName || c.source === selectedName || c.target === selectedName);

            return (
              <div key={groupKey} style={{ marginBottom: 4 }}>
                <div 
                  onClick={() => toggleGroup(groupKey)}
                  style={{ 
                    padding: '6px 16px', 
                    fontSize: 12, 
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: hasSelectedChild ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                    borderLeft: `3px solid ${hasSelectedChild ? 'rgba(34, 197, 94, 0.4)' : 'transparent'}`,
                    marginLeft: hasSelectedChild ? 0 : 3
                  }}
                  onMouseEnter={e => { if (!hasSelectedChild) (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; }}
                  onMouseLeave={e => { if (!hasSelectedChild) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span
                    style={{
                      display: 'inline-flex', width: 14, height: 14,
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: 'var(--text-tertiary)', fontSize: 9,
                      transform: isCollapsed ? 'none' : 'rotate(90deg)',
                      transition: 'transform 0.15s ease',
                      marginRight: 4
                    }}
                  >
                    ▶
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', marginRight: 4, fontWeight: 500 }}>{headingLabel}</span>
                  <span style={{ fontWeight: 600 }}>{groupKey}</span>
                </div>
                
                {!isCollapsed && (
                  <div>
                    {groupConnections.map((c) => {
                      const isSelected = selectedName === c.id || selectedName === c.source || selectedName === c.target;
                      let innerLabel = '';
                      let innerValue = '';
                      if (sortBy === 'source') { innerLabel = 'Target:'; innerValue = c.target; }
                      else if (sortBy === 'target') { innerLabel = 'Source:'; innerValue = c.source; }
                      
                      return (
                        <div
                          key={c.id}
                          ref={el => {
                            if (el) itemRefs.current.set(c.id, el);
                            else itemRefs.current.delete(c.id);
                          }}
                          onClick={() => setSelectedName(c.id)}
                          style={{
                            padding: '6px 16px 6px 36px',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                            borderLeft: `3px solid ${isSelected ? '#22c55e' : 'transparent'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--hover-overlay)'; }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', justifyContent: 'space-between' }}>
                            <div style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sortBy === 'type' ? (
                                <span style={{ fontWeight: 600 }}>{c.source} <span style={{ color: 'var(--text-tertiary)', margin: '0 4px', fontWeight: 'normal' }}>→</span> {c.target}</span>
                              ) : (
                                <>
                                  <span style={{ color: 'var(--text-tertiary)', marginRight: 4, fontWeight: 500 }}>{innerLabel}</span>
                                  <span style={{ fontWeight: 600 }}>{innerValue}</span>
                                </>
                              )}
                            </div>
                            {sortBy !== 'type' && (
                              <div style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', flexShrink: 0, paddingLeft: 8, paddingRight: 8 }}>
                                [{c.connectionType}]
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isEditingInitials && (
                              <span 
                                onClick={(e) => { e.stopPropagation(); onEditInitials?.(c.id, 'connection'); }}
                                style={{ cursor: 'pointer', fontSize: 10, color: 'var(--text-tertiary)' }}
                                title="Edit Initials"
                              >
                                <Edit2 size={12} color="var(--text-secondary)" />
                              </span>
                            )}
                            <span
                              onClick={(e) => { e.stopPropagation(); toggleVisibility(c.id); }}
                              style={{
                                cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
                                color: hiddenSet.has(c.id) ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                              }}
                              title={hiddenSet.has(c.id) ? 'Show connection' : 'Hide connection'}
                            >
                              {hiddenSet.has(c.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {idx < sortedKeys.length - 1 && (
                  <div style={{ margin: '6px 16px 2px', borderBottom: '1px solid var(--hover-overlay)' }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
