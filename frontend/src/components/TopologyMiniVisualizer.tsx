import React, { useState } from 'react';

export type TopologyMedium = 'all' | 'power' | 'fluid' | 'data' | 'signal';

interface NodeData {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  category: 'power' | 'fluid' | 'data' | 'signal';
  metric: string;
}

interface EdgeData {
  id: string;
  from: string;
  to: string;
  medium: 'power' | 'fluid' | 'data' | 'signal';
  label: string;
  color: string;
}

const NODES: NodeData[] = [
  { id: 'gen1', name: '⚡ Generator 1', type: 'Diesel Turbine', x: 50, y: 55, category: 'power', metric: '400V AC · 62.5 kVA' },
  { id: 'switchboard', name: '⚡ Main Switchboard', type: 'Primary Bus A', x: 200, y: 55, category: 'power', metric: '86.4 kW Delivery' },
  { id: 'battery', name: '🔋 Backup LiFePO4', type: 'ESS Bank 2', x: 350, y: 55, category: 'power', metric: '48V DC · 94% State' },
  { id: 'chiller', name: '💧 Glycol Chiller', type: 'Cooling Loop', x: 50, y: 155, category: 'fluid', metric: '24.2 L/min · 12°C' },
  { id: 'exchanger', name: '💧 Heat Exchanger', type: 'Thermal Recovery', x: 200, y: 155, category: 'fluid', metric: 'Delta T: 18.5°C' },
  { id: 'habitat_hvac', name: '💧 Habitat HVAC', type: 'Thermal Envelope', x: 350, y: 155, category: 'fluid', metric: 'Air Temp: 21.4°C' },
  { id: 'rtu', name: '📡 SCADA RTU-01', type: 'Modbus Gateway', x: 120, y: 245, category: 'data', metric: '48 Channels · 10 Hz' },
  { id: 'sat_comms', name: '🛰️ LEO Satellite Comms', type: 'Uplink Station', x: 280, y: 245, category: 'signal', metric: 'Uplink: 14ms Sync' },
];

const EDGES: EdgeData[] = [
  { id: 'e1', from: 'gen1', to: 'switchboard', medium: 'power', label: '400V AC Bus', color: '#50dbc0' },
  { id: 'e2', from: 'switchboard', to: 'battery', medium: 'power', label: 'Float Charging', color: '#50dbc0' },
  { id: 'e3', from: 'chiller', to: 'exchanger', medium: 'fluid', label: 'Ethylene Glycol', color: '#38d9f5' },
  { id: 'e4', from: 'exchanger', to: 'habitat_hvac', medium: 'fluid', label: 'Warm Air Convection', color: '#38d9f5' },
  { id: 'e5', from: 'switchboard', to: 'rtu', medium: 'data', label: 'Bus Telemetry', color: '#a78bfa' },
  { id: 'e6', from: 'exchanger', to: 'rtu', medium: 'data', label: 'Thermal Modbus', color: '#a78bfa' },
  { id: 'e7', from: 'rtu', to: 'sat_comms', medium: 'signal', label: 'Encrypted LEO Stream', color: '#f8d57e' },
  { id: 'e8', from: 'battery', to: 'sat_comms', medium: 'power', label: 'Essential 24V', color: '#50dbc0' },
];

export function TopologyMiniVisualizer({
  activeMedium,
  isLight,
}: {
  activeMedium: TopologyMedium;
  isLight: boolean;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodeMap = new Map(NODES.map(n => [n.id, n]));

  return (
    <div style={{
      width: '100%',
      position: 'relative',
      borderRadius: 'var(--radius-lg)',
      background: isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.45)',
      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
      padding: '12px',
      overflow: 'hidden',
    }}>
      {/* SVG Canvas for Topological Graph */}
      <svg
        viewBox="0 0 400 290"
        style={{
          width: '100%',
          height: '220px',
          display: 'block',
          overflow: 'visible',
        }}
      >
        <defs>
          {/* Animated gradient pulses for each medium */}
          <linearGradient id="grad-power" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#50dbc0" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#50dbc0" stopOpacity="1" />
            <stop offset="100%" stopColor="#50dbc0" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="grad-fluid" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38d9f5" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#38d9f5" stopOpacity="1" />
            <stop offset="100%" stopColor="#38d9f5" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="grad-data" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="grad-signal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f8d57e" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#f8d57e" stopOpacity="1" />
            <stop offset="100%" stopColor="#f8d57e" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* ── Edges ── */}
        {EDGES.map(edge => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;

          const isEdgeActive = activeMedium === 'all' || activeMedium === edge.medium;
          const isConnectedToHover = hoveredNode === edge.from || hoveredNode === edge.to;

          return (
            <g key={edge.id} style={{ transition: 'opacity 0.25s ease' }}>
              {/* Glow background line */}
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={edge.color}
                strokeWidth={isEdgeActive ? (isConnectedToHover ? 4 : 2.5) : 1}
                strokeOpacity={isEdgeActive ? (isConnectedToHover ? 0.9 : 0.6) : 0.12}
                strokeLinecap="round"
              />

              {/* Animated flowing dash line for active mediums */}
              {isEdgeActive && (
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={isLight ? edge.color : '#ffffff'}
                  strokeWidth={isConnectedToHover ? 2.5 : 1.8}
                  strokeDasharray="4 8"
                  strokeOpacity={0.8}
                  className="edge-flow-active"
                  style={{
                    animation: 'flowAnimation 1.4s linear infinite',
                  }}
                />
              )}
            </g>
          );
        })}

        {/* ── Nodes ── */}
        {NODES.map(node => {
          const isNodeActive = activeMedium === 'all' || activeMedium === node.category;
          const isHovered = hoveredNode === node.id;

          const categoryColors = {
            power: '#50dbc0',
            fluid: '#38d9f5',
            data: '#a78bfa',
            signal: '#f8d57e',
          };
          const nodeColor = categoryColors[node.category];

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.2s ease, opacity 0.25s ease',
                opacity: isNodeActive ? 1 : 0.25,
              }}
            >
              {/* Outer halo */}
              <circle
                r={isHovered ? 20 : 16}
                fill={isLight ? '#ffffff' : '#0c101b'}
                stroke={nodeColor}
                strokeWidth={isHovered ? 2.5 : 1.5}
                filter="drop-shadow(0 2px 6px rgba(0,0,0,0.3))"
              />

              {/* Inner core status pulse */}
              <circle
                r={isHovered ? 7 : 5}
                fill={nodeColor}
                opacity={isNodeActive ? 1 : 0.4}
              />

              {/* Label */}
              <text
                y={isHovered ? 28 : 24}
                textAnchor="middle"
                fontSize={9.5}
                fontWeight={700}
                fill={isLight ? '#1e293b' : '#e2e8f0'}
                fontFamily="system-ui, sans-serif"
              >
                {node.name.replace(/^[^\s]+\s/, '')}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Node Telemetry Tooltip ── */}
      <div style={{
        marginTop: 6,
        padding: '8px 12px',
        borderRadius: 6,
        background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
        border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
      }}>
        {hoveredNode && nodeMap.get(hoveredNode) ? (
          <>
            <div>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                {nodeMap.get(hoveredNode)!.name}
              </span>
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                ({nodeMap.get(hoveredNode)!.type})
              </span>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {nodeMap.get(hoveredNode)!.metric}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>Active Domain: <strong>{activeMedium.toUpperCase()}</strong> (Edge isolation enabled)</span>
            <span style={{ color: 'var(--text-tertiary)' }}>Hover node to inspect live flow</span>
          </div>
        )}
      </div>
    </div>
  );
}
