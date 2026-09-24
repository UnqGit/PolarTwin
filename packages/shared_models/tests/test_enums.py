"""
Phase 0 tests: Status enums.

Tests that the status enums are defined correctly and match spec §0.3 exactly.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from packages.shared_models.enums import (
    ComponentStatus,
    ConnectionStatus,
    ConnectionType,
    SimulationStatus,
    TelemetrySource,
)


class TestComponentStatus:
    """Spec §5.2, §0.3: Component status values."""

    def test_inactive_value(self):
        assert ComponentStatus.INACTIVE == "inactive"

    def test_active_value(self):
        assert ComponentStatus.ACTIVE == "active"

    def test_failure_value(self):
        assert ComponentStatus.FAILURE == "failure"

    def test_exactly_three_values(self):
        """Spec defines exactly three component statuses."""
        values = {s.value for s in ComponentStatus}
        assert values == {"inactive", "active", "failure"}

    def test_str_coercion(self):
        """Status values must serialize as their string values (via .value)."""
        assert ComponentStatus.ACTIVE.value == "active"
        assert ComponentStatus.INACTIVE.value == "inactive"
        assert ComponentStatus.FAILURE.value == "failure"


class TestConnectionStatus:
    """Spec §6.1, §0.3: Connection status values."""

    def test_inactive_value(self):
        assert ConnectionStatus.INACTIVE == "inactive"

    def test_active_value(self):
        assert ConnectionStatus.ACTIVE == "active"

    def test_failure_value(self):
        assert ConnectionStatus.FAILURE == "failure"

    def test_exactly_three_values(self):
        values = {s.value for s in ConnectionStatus}
        assert values == {"inactive", "active", "failure"}


class TestConnectionType:
    """Spec §2.2: Four connection types."""

    def test_power_type(self):
        assert ConnectionType.POWER == "power"

    def test_data_type(self):
        assert ConnectionType.DATA == "data"

    def test_signal_type(self):
        assert ConnectionType.SIGNAL == "signal"

    def test_resource_type(self):
        assert ConnectionType.RESOURCE == "resource"

    def test_exactly_four_types(self):
        """Spec defines exactly four connection types."""
        values = {t.value for t in ConnectionType}
        assert values == {"power", "data", "signal", "resource"}


class TestSimulationStatus:
    """Spec §7.5.1: Simulation lifecycle states."""

    def test_ready(self):
        assert SimulationStatus.READY == "ready"

    def test_running(self):
        assert SimulationStatus.RUNNING == "running"

    def test_paused(self):
        assert SimulationStatus.PAUSED == "paused"

    def test_completed(self):
        assert SimulationStatus.COMPLETED == "completed"

    def test_error(self):
        assert SimulationStatus.ERROR == "error"


class TestTelemetrySource:
    """Spec §Telemetry: SIMULATION and LIVE source indicators."""

    def test_simulation_source(self):
        assert TelemetrySource.SIMULATION == "SIMULATION"

    def test_live_source(self):
        assert TelemetrySource.LIVE == "LIVE"
