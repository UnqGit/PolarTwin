/**
 * scenarioProfiles.ts
 *
 * Curated Antarctic mission profiles, DEFCON threat classifications,
 * and dynamic DSL narrative generator for PolarTwin.
 */

export type ThreatLevel = 
  | 'DEFCON 1 - CATASTROPHIC'
  | 'DEFCON 2 - CRITICAL'
  | 'DEFCON 3 - ELEVATED'
  | 'DEFCON 4 - NOMINAL';

export interface ThreatMeta {
  level: ThreatLevel;
  tier: number;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;
  glow: string;
}

export const THREAT_TIERS: Record<string, ThreatMeta> = {
  catastrophic: {
    level: 'DEFCON 1 - CATASTROPHIC',
    tier: 1,
    badgeColor: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    glow: '0 0 12px rgba(239, 68, 68, 0.4)',
  },
  critical: {
    level: 'DEFCON 2 - CRITICAL',
    tier: 2,
    badgeColor: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
    glow: '0 0 12px rgba(249, 115, 22, 0.4)',
  },
  elevated: {
    level: 'DEFCON 3 - ELEVATED',
    tier: 3,
    badgeColor: '#eab308',
    badgeBg: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    glow: '0 0 12px rgba(234, 179, 8, 0.4)',
  },
  nominal: {
    level: 'DEFCON 4 - NOMINAL',
    tier: 4,
    badgeColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    glow: '0 0 12px rgba(16, 185, 129, 0.4)',
  },
};

export interface ScenarioMissionProfile {
  id: string;
  codename: string;
  title: string;
  category: string;
  threat: ThreatMeta;
  summary: string;
  missionDirectives: string[];
  subsystemsAtRisk: string[];
  ambientEnvelope: {
    temperature: string;
    windSpeed: string;
    visibility: string;
    stormCondition: string;
    satelliteLink: string;
  };
  recommendedCountermeasures: string[];
}

/**
 * Curated mission profiles for standard scenarios
 */
const CURATED_PROFILES: Record<string, Partial<ScenarioMissionProfile>> = {
  gen_failure: {
    codename: 'OPERATION BLACKOUT POLARIS',
    title: 'Primary Microgrid Turbine Loss & Thermal Cascade',
    category: 'Power Grid Infrastructure Failure',
    threat: THREAT_TIERS.critical,
    summary:
      'Severe mechanical seizure detected in Main Diesel Generator 1 during sub-zero operational window. Station microgrid drops to secondary reserve bus. Operator must observe automated load shedding and verify living quarter heating remains viable before catastrophic pipe freeze.',
    missionDirectives: [
      'Monitor automated transfer switch to Backup Generator within 300s window.',
      'Shed non-essential research laboratory electrical loads to stabilize the 400V AC bus.',
      'Maintain habitation envelope temperature above critical freeze threshold (+14°C).',
      'Prevent cascading thermal shock to water extraction and greywater circulation loops.'
    ],
    subsystemsAtRisk: ['EnergyBlock', 'HVACBlock', 'WaterAndWasteBlock'],
    ambientEnvelope: {
      temperature: '-38.5 °C',
      windSpeed: '92 km/h (Katabatic Gale)',
      visibility: '350 m (Blowing Snow)',
      stormCondition: 'Active Katabatic Incursion',
      satelliteLink: 'DEGRADED (High Latency)'
    },
    recommendedCountermeasures: [
      'Activate Auxiliary Diesel Unit 2 via Control Block interface.',
      'Isolate Research Wing HVAC circuits to channel thermal heat to Crew Living Quarters.',
      'Engage secondary glycol heat exchanger loop.'
    ]
  },
  weather_inflation: {
    codename: 'OPERATION WHITE-OUT VORTEX',
    title: 'Category 4 Katabatic Blizzard & Atmospheric Plunge',
    category: 'Severe Polar Meteorology',
    threat: THREAT_TIERS.catastrophic,
    summary:
      'Polar vortex compression bringing ambient temperatures down to -52°C with wind gusts exceeding 130 km/h. High risk of external perimeter sensor freezing, antenna displacement, and extreme heat loss through module envelopes.',
    missionDirectives: [
      'Stress-test station heating coils against extreme exterior temperature differentials.',
      'Track antenna azimuth alignment and telecommunication packet loss.',
      'Validate emergency shelter thermal retention curves during maximum exterior wind load.'
    ],
    subsystemsAtRisk: ['HVACBlock', 'ControlBlock', 'EnergyBlock'],
    ambientEnvelope: {
      temperature: '-52.0 °C',
      windSpeed: '128 km/h (Hurricane Force)',
      visibility: '< 50 m (Total Whiteout)',
      stormCondition: 'Polar Cyclone Grade 4',
      satelliteLink: 'OFFLINE (LEO Tracking Lost)'
    },
    recommendedCountermeasures: [
      'Engage redundant perimeter heating tracing along fuel and water delivery conduits.',
      'Switch communication relay to HF ground bounce backup.',
      'Pre-heat emergency diesel generator block to prevent fuel waxing.'
    ]
  },
  power_outage: {
    codename: 'OPERATION ZERO VOLT',
    title: 'Total Station Microgrid Collapse & Island Recovery',
    category: 'Critical Infrastructure Emergency',
    threat: THREAT_TIERS.catastrophic,
    summary:
      'Unscheduled blackout across both primary and secondary 400V power buses. Station enters emergency battery island mode with 45 minutes of critical life support reserve.',
    missionDirectives: [
      'Execute emergency battery islanding protocol.',
      'Track time-to-critical-freeze across living modules.',
      'Re-energize primary distribution bus within battery endurance limit.'
    ],
    subsystemsAtRisk: ['EnergyBlock', 'HVACBlock', 'ControlBlock', 'WaterAndWasteBlock', 'ResearchBlock'],
    ambientEnvelope: {
      temperature: '-34.0 °C',
      windSpeed: '65 km/h',
      visibility: '1.2 km',
      stormCondition: 'Sub-Zero Drift',
      satelliteLink: 'EMERGENCY BEACON ONLY'
    },
    recommendedCountermeasures: [
      'Cold-start emergency diesel turbine.',
      'Manual override of SCADA safety interlocks if telemetry drops.'
    ]
  }
};

/**
 * Intelligently generates or retrieves a Mission Profile for any scenario ID, name, or raw DSL content.
 */
export function getScenarioMissionProfile(
  scenarioId: string | null,
  name: string = 'Custom Scenario',
  source: string = ''
): ScenarioMissionProfile {
  const normKey = (scenarioId || name).toLowerCase().replace(/.*[:/]/, '').replace(/[^a-z0-9_]/g, '');

  // Check if a curated profile matches
  for (const [key, profile] of Object.entries(CURATED_PROFILES)) {
    if (normKey.includes(key)) {
      return {
        id: scenarioId || normKey,
        codename: profile.codename || `OPERATION ${name.toUpperCase().replace(/\.SCENE$/, '')}`,
        title: profile.title || name,
        category: profile.category || 'Antarctic Operational Drill',
        threat: profile.threat || THREAT_TIERS.critical,
        summary: profile.summary || 'Simulated stress drill evaluating Antarctic station resilience.',
        missionDirectives: profile.missionDirectives || ['Observe station response and record telemetry.'],
        subsystemsAtRisk: profile.subsystemsAtRisk || ['EnergyBlock', 'HVACBlock'],
        ambientEnvelope: profile.ambientEnvelope || {
          temperature: '-35.0 °C',
          windSpeed: '75 km/h',
          visibility: '500 m',
          stormCondition: 'Moderate Polar Storm',
          satelliteLink: 'ONLINE'
        },
        recommendedCountermeasures: profile.recommendedCountermeasures || [
          'Monitor subsystem status on the live Command HUD.',
          'Analyze telemetry deviations upon completion.'
        ]
      };
    }
  }

  // Synthesize dynamic profile from source DSL
  const safeSource = typeof source === 'string' ? source : '';
  const hasWeather = /weather|temperature\s*=\s*-[2-9]\d/i.test(safeSource);
  const hasFailure = /failure/i.test(safeSource);
  const targets = Array.from(new Set(Array.from(safeSource.matchAll(/@([A-Za-z0-9_]+)/g)).map(m => m[1])));

  let threat = THREAT_TIERS.nominal;
  if (hasFailure && targets.length > 2) threat = THREAT_TIERS.catastrophic;
  else if (hasFailure || hasWeather) threat = THREAT_TIERS.critical;
  else if (targets.length > 0) threat = THREAT_TIERS.elevated;

  const cleanName = name.replace(/\.scene$/i, '').replace(/[_-]/g, ' ').toUpperCase();

  return {
    id: scenarioId || 'custom_scenario',
    codename: `DRILL: ${cleanName}`,
    title: `${cleanName} Operational Proving Scenario`,
    category: hasFailure ? 'Injected System Failure Simulation' : 'Operational Readiness & State Validation',
    threat,
    summary: `Dynamic scenario orchestrating ${targets.length > 0 ? targets.length : 'station'} target component(s) under deterministic Antarctic environmental constraints.`,
    missionDirectives: [
      `Validate deterministic response of targeted components: ${targets.slice(0, 4).join(', ') || 'Station Grid'}.`,
      'Ensure cascading fault propagation does not breach core life-support thresholds.',
      'Record full telemetry timeline for post-mission diagnostic audit.'
    ],
    subsystemsAtRisk: targets.some(t => /gen|power|energy|volt/i.test(t))
      ? ['EnergyBlock', 'HVACBlock']
      : targets.some(t => /ac|temp|heat|hvac/i.test(t))
      ? ['HVACBlock']
      : ['EnergyBlock', 'ControlBlock'],
    ambientEnvelope: {
      temperature: hasWeather ? '-45.0 °C' : '-32.0 °C',
      windSpeed: hasWeather ? '110 km/h (Storm Force)' : '60 km/h (Moderate Drift)',
      visibility: hasWeather ? '200 m' : '1.5 km',
      stormCondition: hasWeather ? 'Katabatic Gale Active' : 'Nominal Antarctic Day',
      satelliteLink: hasFailure ? 'INTERMITTENT' : 'STABLE'
    },
    recommendedCountermeasures: [
      'Maintain close monitoring of the live Subsystem Health HUD.',
      'Inspect event timings on the Timeline Editor to forecast failure spikes.'
    ]
  };
}
