import React, { useState, useMemo } from 'react';
import {
  Grid3X3, AlertTriangle, ShieldCheck, ExternalLink, Zap, Radio, Droplets, Activity, Info
} from 'lucide-react';
import { SUBSYSTEM_CONFIGS, MEDIUM_CONFIGS, normalizeMedium } from './types';
import type { NodeLayout, ConnectionLayout } from '../../lib/layout';

interface DependencyMatrixViewProps {
  root: NodeLayout;
  connections: ConnectionLayout[];
  isLight: boolean;
  onSelectConnection: (id: string) => void;
  onSwitchToSchematic: (focusNodeName?: string) => void;
}

export const DependencyMatrixView: React.FC<DependencyMatrixViewProps> = ({
  root,
  connections,
  isLight,
  onSelectConnection,
  onSwitchToSchematic,
}) => {
  const [selectedCell, setSelectedCell] = useState<{
    src: string;
    tgt: string;
    conns: ConnectionLayout[];
  } | null>(null);

  // Map each component to its top-level block
  const nodeToBlockMap = useMemo(() => {
    const map = new Map<string, string>();
    function visit(n: NodeLayout, topParentName?: string) {
      const isTopLevel = !topParentName && root && n.name !== root.name;
      const currentTop = isTopLevel ? n.name : topParentName;
      if (currentTop) {
        map.set(n.name, currentTop);
      }
      for (const c of n.children) {
        visit(c, currentTop || n.name);
      }
    }
    if (root) {
      for (const child of root.children) {
        visit(child, child.name);
      }
    }
    return map;
  }, [root]);

  const subsystemKeys = useMemo(() => {
    return Object.keys(SUBSYSTEM_CONFIGS);
  }, []);

  // Compute 2D matrix: matrix[src][tgt] = ConnectionLayout[]
  const matrix = useMemo(() => {
    const grid: Record<string, Record<string, ConnectionLayout[]>> = {};

    subsystemKeys.forEach(s => {
      grid[s] = {};
      subsystemKeys.forEach(t => {
        grid[s][t] = [];
      });
    });

    connections.forEach(c => {
      const srcBlock = nodeToBlockMap.get(c.source) || 'General';
      const tgtBlock = nodeToBlockMap.get(c.target) || 'General';

      if (grid[srcBlock] && grid[srcBlock][tgtBlock]) {
        grid[srcBlock][tgtBlock].push(c);
      }
    });

    return grid;
  }, [connections, nodeToBlockMap, subsystemKeys]);

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: isLight ? '#f8fafc' : 'var(--bg-main)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Intro Header */}
      <div
        style={{
          padding: '12px 24px',
          background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(18, 24, 38, 0.6)',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(80, 219, 192, 0.15)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Grid3X3 size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Subsystem Cross-Coupling & Dependency Matrix
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              N×N structural interaction matrix: evaluate interface coupling, load dependencies, and redundancy
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(80, 219, 192, 0.15)', border: '1px solid rgba(80, 219, 192, 0.3)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>1-2 Lines (Low/SPOF Risk)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(80, 219, 192, 0.35)', border: '1px solid rgba(80, 219, 192, 0.6)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>3-6 Lines (Moderate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(80, 219, 192, 0.75)', border: '1px solid var(--accent-primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>7+ Lines (Dense Coupling)</span>
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div style={{ flex: 1, padding: 24, overflow: 'auto', display: 'flex', gap: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Rows: <b>Source Subsystem</b> (Feeds Output) ➔ Columns: <b>Target Subsystem</b> (Receives Input)
          </div>

          <table
            style={{
              borderCollapse: 'collapse',
              background: isLight ? '#ffffff' : 'rgba(15, 21, 37, 0.94)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: isLight ? '0 4px 14px rgba(0,0,0,0.06)' : '0 8px 24px rgba(0,0,0,0.5)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: '12px 14px',
                    fontSize: 11,
                    textAlign: 'left',
                    color: 'var(--text-tertiary)',
                    borderBottom: isLight ? '2px solid #cbd5e1' : '2px solid var(--border-color)',
                    background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.3)',
                    minWidth: 150,
                  }}
                >
                  Source \ Target
                </th>
                {subsystemKeys.map(key => {
                  const theme = SUBSYSTEM_CONFIGS[key];
                  const Icon = theme.icon;
                  return (
                    <th
                      key={key}
                      style={{
                        padding: '12px 10px',
                        fontSize: 11,
                        textAlign: 'center',
                        color: 'var(--text-primary)',
                        borderBottom: isLight ? '2px solid #cbd5e1' : '2px solid var(--border-color)',
                        background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.3)',
                        minWidth: 110,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <Icon size={14} color={theme.color} />
                        <span style={{ fontWeight: 600 }}>{theme.name.replace('Block', '')}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {subsystemKeys.map(srcKey => {
                const srcTheme = SUBSYSTEM_CONFIGS[srcKey];
                const SrcIcon = srcTheme.icon;

                return (
                  <tr key={srcKey}>
                    {/* Row Header */}
                    <td
                      style={{
                        padding: '10px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)',
                        borderRight: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
                        background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.15)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SrcIcon size={14} color={srcTheme.color} />
                        <span>{srcTheme.name.replace('Block', '')}</span>
                      </div>
                    </td>

                    {/* Matrix Cells */}
                    {subsystemKeys.map(tgtKey => {
                      const conns = matrix[srcKey]?.[tgtKey] || [];
                      const count = conns.length;
                      const isDiagonal = srcKey === tgtKey;
                      const isSelected = selectedCell?.src === srcKey && selectedCell?.tgt === tgtKey;

                      // Cell background shading based on count
                      let bg = 'transparent';
                      let textColor = 'var(--text-tertiary)';
                      let border = isSelected ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.03)';

                      if (count > 0) {
                        textColor = isLight ? '#030A0F' : 'var(--text-primary)';
                        if (count >= 7) {
                          bg = 'rgba(80, 219, 192, 0.45)';
                        } else if (count >= 3) {
                          bg = 'rgba(80, 219, 192, 0.25)';
                        } else {
                          bg = 'rgba(80, 219, 192, 0.12)';
                        }
                      }

                      return (
                        <td
                          key={tgtKey}
                          onClick={() => {
                            if (count > 0) {
                              setSelectedCell({ src: srcKey, tgt: tgtKey, conns });
                            }
                          }}
                          style={{
                            padding: '10px',
                            textAlign: 'center',
                            fontSize: 12,
                            fontWeight: count > 0 ? 700 : 400,
                            color: textColor,
                            background: isSelected ? 'rgba(80, 219, 192, 0.35)' : bg,
                            border,
                            cursor: count > 0 ? 'pointer' : 'default',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (count > 0 && !isSelected) {
                              e.currentTarget.style.filter = 'brightness(1.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (count > 0 && !isSelected) {
                              e.currentTarget.style.filter = 'none';
                            }
                          }}
                        >
                          {count > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span>{count}</span>
                              {count === 1 && !isDiagonal && (
                                <span style={{ fontSize: 9, color: '#f8d57e' }} title="Single line (SPOF potential)">
                                  ●
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ opacity: 0.2 }}>·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected Cell Detail Inspector */}
        {selectedCell && (
          <div
            style={{
              width: 340,
              background: isLight ? '#ffffff' : 'rgba(15, 21, 37, 0.94)',
              borderRadius: 'var(--radius-lg)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isLight ? '0 4px 14px rgba(0,0,0,0.06)' : '0 8px 24px rgba(0,0,0,0.5)',
              maxHeight: 520,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Coupling Details
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16 }}
              >
                &times;
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              <b>{selectedCell.src}</b> feeds into <b>{selectedCell.tgt}</b> ({selectedCell.conns.length} circuits)
            </div>

            {selectedCell.conns.length === 1 && selectedCell.src !== selectedCell.tgt && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(248, 213, 126, 0.15)',
                  border: '1px solid rgba(248, 213, 126, 0.3)',
                  color: '#f8d57e',
                  fontSize: 11,
                  marginBottom: 12,
                }}
              >
                <AlertTriangle size={13} />
                <span>Single Point of Failure: No parallel redundancy.</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedCell.conns.map(c => {
                const m = normalizeMedium(c.connectionType);
                const conf = MEDIUM_CONFIGS[m] || MEDIUM_CONFIGS.data;
                const Icon = conf.icon;

                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectConnection(c.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon size={12} color={conf.color} />
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.source} <span style={{ color: 'var(--text-tertiary)' }}>→</span> {c.target}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: `${conf.color}22`,
                        color: conf.color,
                        fontWeight: 600,
                      }}
                    >
                      {c.connectionType}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => onSwitchToSchematic(selectedCell.src)}
              className="btn btn-sm btn-secondary"
              style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span>View in Schematic Topology</span>
              <ExternalLink size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
