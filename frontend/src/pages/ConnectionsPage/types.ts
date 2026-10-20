import { Zap, Thermometer, Radio, Droplets, Activity, Package, Cpu, Box } from 'lucide-react';

export interface SubsystemTheme {
  id: string;
  name: string;
  title: string;
  icon: any;
  color: string;
  lightColor: string;
  bgDark: string;
  bgLight: string;
  borderDark: string;
  borderLight: string;
  tag: string;
  category: string;
  description: string;
}

export const SUBSYSTEM_CONFIGS: Record<string, SubsystemTheme> = {
  EnergyBlock: {
    id: 'EnergyBlock',
    name: 'EnergyBlock',
    title: 'Energy & Power Grid',
    icon: Zap,
    color: '#f8d57e',
    lightColor: '#b45309',
    bgDark: 'rgba(248, 213, 126, 0.12)',
    bgLight: '#fef3c7',
    borderDark: 'rgba(248, 213, 126, 0.32)',
    borderLight: '#fde68a',
    tag: 'Primary 400V AC Bus',
    category: 'Power Infrastructure',
    description: 'Diesel generation, wind harvesting & 400V AC distribution bus',
  },
  HVACBlock: {
    id: 'HVACBlock',
    name: 'HVACBlock',
    title: 'HVAC & Life Support',
    icon: Thermometer,
    color: '#38d9f5',
    lightColor: '#0284c7',
    bgDark: 'rgba(56, 217, 245, 0.12)',
    bgLight: '#e0f2fe',
    borderDark: 'rgba(56, 217, 245, 0.32)',
    borderLight: '#bae6fd',
    tag: 'Atmospheric Envelope',
    category: 'Habitability & Thermal',
    description: 'Habitat heating, ventilation loops & thermal glycol heat recovery',
  },
  ControlBlock: {
    id: 'ControlBlock',
    name: 'ControlBlock',
    title: 'Central SCADA & Comms',
    icon: Radio,
    color: '#a78bfa',
    lightColor: '#7c3aed',
    bgDark: 'rgba(167, 139, 250, 0.12)',
    bgLight: '#ede9fe',
    borderDark: 'rgba(167, 139, 250, 0.32)',
    borderLight: '#ddd6fe',
    tag: 'Telemetry & Modbus',
    category: 'Command & Avionics',
    description: 'SCADA telemetry server, Modbus RTUs, and LEO satellite uplinks',
  },
  WaterAndWasteBlock: {
    id: 'WaterAndWasteBlock',
    name: 'WaterAndWasteBlock',
    title: 'Water & Fluid Systems',
    icon: Droplets,
    color: '#60a5fa',
    lightColor: '#2563eb',
    bgDark: 'rgba(96, 165, 250, 0.12)',
    bgLight: '#dbeafe',
    borderDark: 'rgba(96, 165, 250, 0.32)',
    borderLight: '#bfdbfe',
    tag: 'Closed Fluid Loop',
    category: 'Consumables & Hydrology',
    description: 'Meltwater heating, potable water distribution & graywater recycling',
  },
  ResearchBlock: {
    id: 'ResearchBlock',
    name: 'ResearchBlock',
    title: 'Research & Science Labs',
    icon: Activity,
    color: '#50dbc0',
    lightColor: '#059669',
    bgDark: 'rgba(80, 219, 192, 0.12)',
    bgLight: '#d1fae5',
    borderDark: 'rgba(80, 219, 192, 0.32)',
    borderLight: '#a7f3d0',
    tag: 'Payload & Sensors',
    category: 'Polar Science',
    description: 'Analytical labs, geomagnetic sensors & aurora science telemetry',
  },
  InventoryBlock: {
    id: 'InventoryBlock',
    name: 'InventoryBlock',
    title: 'Inventory & Cryo Fuel',
    icon: Package,
    color: '#fb923c',
    lightColor: '#ea580c',
    bgDark: 'rgba(251, 146, 60, 0.12)',
    bgLight: '#ffedd5',
    borderDark: 'rgba(251, 146, 60, 0.32)',
    borderLight: '#fed7aa',
    tag: 'Mission Reserves',
    category: 'Logistics & Fuel',
    description: 'Arctic fuel storage, emergency provisions & mechanical spares',
  },
};

export const DEFAULT_SUBSYSTEM: SubsystemTheme = {
  id: 'General',
  name: 'General',
  title: 'Auxiliary Subsystem',
  icon: Cpu,
  color: '#50dbc0',
  lightColor: '#0284c7',
  bgDark: 'rgba(80, 219, 192, 0.1)',
  bgLight: '#f0f9ff',
  borderDark: 'rgba(80, 219, 192, 0.25)',
  borderLight: '#e0f2fe',
  tag: 'Auxiliary Node',
  category: 'General Infrastructure',
  description: 'Unclassified auxiliary station equipment and structural mounts',
};

export interface MediumConfig {
  id: string;
  label: string;
  icon: any;
  color: string;
  lightColor: string;
  glow: string;
  badge: string;
  description: string;
}

export const MEDIUM_CONFIGS: Record<string, MediumConfig> = {
  power: {
    id: 'power',
    label: 'Power Grid',
    icon: Zap,
    color: '#f59e0b',
    lightColor: '#d97706',
    glow: 'rgba(245, 158, 11, 0.45)',
    badge: '400V AC / 24V DC',
    description: 'Primary generation, ESS battery storage, and 400V 3-phase AC distribution'
  },
  data: {
    id: 'data',
    label: 'SCADA & Comms',
    icon: Radio,
    color: '#22d3ee',
    lightColor: '#0891b2',
    glow: 'rgba(34, 211, 238, 0.45)',
    badge: 'Modbus / Eth / LEO',
    description: 'Industrial control networks, telemetry packets, and remote telemetry'
  },
  signal: {
    id: 'signal',
    label: 'Science & Signals',
    icon: Activity,
    color: '#a78bfa',
    lightColor: '#7c3aed',
    glow: 'rgba(167, 139, 250, 0.45)',
    badge: 'Telemetry / RF',
    description: 'Sensory payload channels, RF radio antennas, and discrete alerts'
  },
  fluid: {
    id: 'fluid',
    label: 'Hydronics & Fluid',
    icon: Droplets,
    color: '#34d399',
    lightColor: '#059669',
    glow: 'rgba(52, 211, 153, 0.45)',
    badge: 'Glycol / Potable',
    description: 'Thermal glycol heating loops, meltwater, and graywater fluid circulation'
  },
  resource: {
    id: 'resource',
    label: 'Hydronics & Fluid',
    icon: Droplets,
    color: '#34d399',
    lightColor: '#059669',
    glow: 'rgba(52, 211, 153, 0.45)',
    badge: 'Glycol / Potable',
    description: 'Thermal glycol heating loops, meltwater, and graywater fluid circulation'
  },
  mechanical: {
    id: 'mechanical',
    label: 'Structural / Couplings',
    icon: Box,
    color: '#fb923c',
    lightColor: '#ea580c',
    glow: 'rgba(251, 146, 60, 0.45)',
    badge: 'Shaft / Corridor',
    description: 'Turbine driveshafts, physical couplings, and pressurized hallways'
  }
};

export type ViewMode = 'schematic' | 'bus_architecture' | 'matrix';
export type TraceMode = 'upstream' | 'downstream' | 'blast_radius' | null;

export interface TraceResult {
  mode: TraceMode;
  targetId: string;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  blastAffectedCount?: number;
}

export function normalizeMedium(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('power') || t.includes('electric') || t.includes('wire') || t.includes('volt')) return 'power';
  if (t.includes('data') || t.includes('modbus') || t.includes('ethernet') || t.includes('comms')) return 'data';
  if (t.includes('fluid') || t.includes('water') || t.includes('glycol') || t.includes('pipe') || t.includes('resource') || t.includes('cool')) return 'fluid';
  if (t.includes('signal') || t.includes('sensor') || t.includes('rf') || t.includes('telemetry')) return 'signal';
  if (t.includes('mech') || t.includes('hallway') || t.includes('shaft') || t.includes('corridor')) return 'mechanical';
  return 'data';
}
