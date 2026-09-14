import React, { useState, useEffect, useRef } from 'react';
import type { ConnectionLayout } from '../lib/layout';
import { useSelection } from './SelectionContext';

interface ConnectionsListProps {
  connections: ConnectionLayout[];
}

export const ConnectionsList: React.FC<ConnectionsListProps> = ({ connections }) => {
  const { selectedName, setSelectedName, hiddenSet, toggleVisibility } = useSelection();
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to selected
  useEffect(() => {
    if (selectedName) {
      const el = itemRefs.current.get(selectedName);
      if (el && containerRef.current) {
        // smooth scroll to center
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedName]);

  const [sortBy, setSortBy] = useState<'source' | 'target'>('source');

  // Filter
  const filtered = connections.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.source.toLowerCase().includes(q) ||
           c.target.toLowerCase().includes(q) ||
           c.connectionType.toLowerCase().includes(q);
  });

  // Group by chosen sort property
  const grouped = new Map<string, ConnectionLayout[]>();
  for (const c of filtered) {
    const key = sortBy === 'source' ? c.source : c.target;
    const arr = grouped.get(key) || [];
    arr.push(c);
    grouped.set(key, arr);
  }

  // Sort groups alphabetically
  const sortedKeys = Array.from(grouped.keys()).sort();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setCollapsedGroups(new Set());
  const collapseAll = () => setCollapsedGroups(new Set(sortedKeys));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <input 
          type="text" 
          placeholder="Search connections..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid #334155',
            borderRadius: 4,
            color: '#e2e8f0',
            padding: '6px 10px',
            fontSize: 12,
            outline: 'none',
            marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
            <span>Sort By:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as 'source' | 'target')}
              style={{ 
                background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', border: '1px solid #334155', 
                borderRadius: 4, padding: '2px 4px', fontSize: 11, outline: 'none'
              }}
            >
              <option value="source">source</option>
              <option value="target">target</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {sortedKeys.length > 0 && collapsedGroups.size === 0 ? (
              <button 
                onClick={collapseAll}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
              >
                Collapse All
              </button>
            ) : (
              <button 
                onClick={expandAll}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
              >
                Expand All
              </button>
            )}
          </div>
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {sortedKeys.length === 0 ? (
          <div style={{ padding: 16, color: '#475569', fontSize: 12 }}>No connections match search.</div>
        ) : (
          sortedKeys.map((groupKey, idx) => {
            const groupConnections = grouped.get(groupKey)!;
            // Sort inner items by the other property
            groupConnections.sort((a, b) => {
              const valA = sortBy === 'source' ? a.target : a.source;
              const valB = sortBy === 'source' ? b.target : b.source;
              return valA.localeCompare(valB);
            });

            const isCollapsed = collapsedGroups.has(groupKey);
            const headingLabel = sortBy === 'source' ? 'Source:' : 'Target:';

            return (
              <div key={groupKey} style={{ marginBottom: 4 }}>
                <div 
                  onClick={() => toggleGroup(groupKey)}
                  style={{ 
                    padding: '6px 16px', 
                    fontSize: 12, 
                    color: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span
                    style={{
                      display: 'inline-flex', width: 14, height: 14,
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#475569', fontSize: 9,
                      transform: isCollapsed ? 'none' : 'rotate(90deg)',
                      transition: 'transform 0.15s ease',
                      marginRight: 4
                    }}
                  >
                    ▶
                  </span>
                  <span style={{ color: '#64748b', marginRight: 4, fontWeight: 500 }}>{headingLabel}</span>
                  <span style={{ fontWeight: 600 }}>{groupKey}</span>
                </div>
                
                {!isCollapsed && (
                  <div>
                    {groupConnections.map((c) => {
                      const isSelected = selectedName === c.id;
                      const innerLabel = sortBy === 'source' ? 'Target:' : 'Source:';
                      const innerValue = sortBy === 'source' ? c.target : c.source;
                      
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
                            background: isSelected ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
                            borderLeft: `2px solid ${isSelected ? '#22d3ee' : 'transparent'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', justifyContent: 'space-between' }}>
                            <div style={{ color: isSelected ? '#e2e8f0' : '#cbd5e1', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ color: '#64748b', marginRight: 4, fontWeight: 500 }}>{innerLabel}</span>
                              <span style={{ fontWeight: 600 }}>{innerValue}</span>
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', flexShrink: 0, paddingLeft: 8, paddingRight: 8 }}>
                              [{c.connectionType}]
                            </div>
                          </div>
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleVisibility(c.id); }}
                            style={{
                              cursor: 'pointer', fontSize: 12, padding: '2px 4px',
                              color: hiddenSet.has(c.id) ? '#475569' : '#94a3b8',
                              opacity: hiddenSet.has(c.id) ? 0.5 : 1,
                            }}
                            title={hiddenSet.has(c.id) ? 'Show connection' : 'Hide connection'}
                          >
                            {hiddenSet.has(c.id) ? '👁‍🗨' : '👁'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {idx < sortedKeys.length - 1 && (
                  <div style={{ margin: '6px 16px 2px', borderBottom: '1px solid rgba(255,255,255,0.05)' }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
