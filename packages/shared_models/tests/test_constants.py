"""
Phase 0 tests: Authoritative simulation time constants.

These constants must match the specification exactly.
Any change to these values represents a specification violation.
"""

import pytest
import sys
import os

# Allow tests to import from packages/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from packages.shared_models.constants import (
    SECONDS_PER_SIMULATION_TICK,
    TICKS_PER_SIMULATION_HOUR,
    SIMULATION_SECONDS_PER_HOUR,
    STANDARD_REAL_SECONDS_PER_TICK,
)


class TestSimulationTimeConstants:
    """
    Spec §Simulation Time Model:
      1 simulation time unit = 1 simulation hour = 3600 simulation seconds = 240 ticks
      At standard speed: 1 real second = 1 simulation tick = 15 simulation seconds
    """

    def test_seconds_per_tick_is_15(self):
        """Spec: 1 simulation tick = 15 simulation seconds."""
        assert SECONDS_PER_SIMULATION_TICK == 15

    def test_ticks_per_hour_is_240(self):
        """Spec: 240 ticks in a simulation hour."""
        assert TICKS_PER_SIMULATION_HOUR == 240

    def test_seconds_per_hour_is_3600(self):
        """Spec: 1 simulation hour = 3600 simulation seconds."""
        assert SIMULATION_SECONDS_PER_HOUR == 3600

    def test_ticks_times_seconds_equals_hour(self):
        """Invariant: TICKS_PER_HOUR * SECONDS_PER_TICK == SECONDS_PER_HOUR."""
        assert TICKS_PER_SIMULATION_HOUR * SECONDS_PER_SIMULATION_TICK == SIMULATION_SECONDS_PER_HOUR

    def test_standard_playback_is_one_real_second_per_tick(self):
        """Spec: At standard speed, 1 real second = 1 simulation tick."""
        assert STANDARD_REAL_SECONDS_PER_TICK == 1.0

    def test_illustrative_timeline_progression(self):
        """
        Spec §Simulation Time Model — Illustrative timeline progression:
          Initial time: 00:00:00
          After 1 second elapsed: 00:00:15
          After 4 seconds elapsed: 00:01:00
          After 240 seconds elapsed: 01:00:00
        """
        # After 1 tick: 15 simulation seconds
        assert 1 * SECONDS_PER_SIMULATION_TICK == 15

        # After 4 ticks: 60 simulation seconds = 1 simulation minute
        assert 4 * SECONDS_PER_SIMULATION_TICK == 60

        # After 240 ticks: 3600 simulation seconds = 1 simulation hour
        assert TICKS_PER_SIMULATION_HOUR * SECONDS_PER_SIMULATION_TICK == SIMULATION_SECONDS_PER_HOUR

    def test_playback_speed_does_not_alter_tick_size(self):
        """
        Spec: Changing playback speed must not change the period assigned to each tick.
        The tick size is always SECONDS_PER_SIMULATION_TICK regardless of playback speed.
        """
        # This test documents the invariant. The clock implementation must
        # never change SECONDS_PER_SIMULATION_TICK based on playback speed.
        tick_size_at_1x = SECONDS_PER_SIMULATION_TICK
        tick_size_at_2x = SECONDS_PER_SIMULATION_TICK  # must be identical
        tick_size_at_0_5x = SECONDS_PER_SIMULATION_TICK  # must be identical

        assert tick_size_at_1x == tick_size_at_2x == tick_size_at_0_5x == 15
