"""
Authoritative simulation time constants for PolarTwin.

From specification §Simulation Time Model:
  1 simulation time unit = 1 simulation hour = 3600 simulation seconds = 240 ticks
  At standard speed: 1 real second = 1 simulation tick = 15 simulation seconds

These constants must never be altered without updating the specification.
They must be used consistently throughout the simulation engine, timeline,
telemetry, UI, and tests.
"""

# Simulation tick is exactly 15 simulation seconds.
SECONDS_PER_SIMULATION_TICK: int = 15

# 240 ticks per simulation hour (3600 / 15 = 240).
TICKS_PER_SIMULATION_HOUR: int = 240

# 1 simulation hour = 3600 simulation seconds.
SIMULATION_SECONDS_PER_HOUR: int = 3600

# At standard playback: 1 real second = 1 simulation tick.
# Changing playback speed changes how quickly ticks execute in wall-clock time.
# It NEVER changes event timestamps, durations, ordering, tick size, or internal timestamps.
STANDARD_REAL_SECONDS_PER_TICK: float = 1.0

# Convenience: simulation hours per hour (always 1 by definition).
SIMULATION_HOURS_PER_HOUR: int = 1
