"""
Phase 0 tests: Domain models.

Tests that domain model serialization/deserialization round-trips correctly
and that all spec-required fields are present.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from packages.shared_models.domain import (
    HierarchyComponent,
    CompiledConnection,
    RuntimeConnection,
    RuntimeComponent,
    CONTAINER_TYPES,
    LEAF_COMPONENT_TYPES,
    ALL_COMPONENT_TYPES,
    SUPPORTED_CONNECTION_TYPES,
)


class TestHierarchyComponent:
    """Tests for HierarchyComponent serialization and field compliance."""

    def test_required_fields_present_in_to_dict(self):
        comp = HierarchyComponent(
            name="Gen1",
            type="generator",
            parent="SystemA",
            priority=1,
            floor=1,
            is_backup=False,
        )
        d = comp.to_dict()
        for field in ["name", "type", "parent", "priority", "floor",
                      "is_backup", "backup", "external_field", "children", "tags"]:
            assert field in d, f"Missing field: {field}"

    def test_round_trip_serialization(self):
        comp = HierarchyComponent(
            name="Gen1",
            type="generator",
            parent="SystemA",
            priority=2,
            floor=1,
            is_backup=True,
            backup=["Gen2"],
            tags=["primary"],
            children=["Sensor1"],
            external_field=None,
        )
        d = comp.to_dict()
        restored = HierarchyComponent.from_dict(d)
        assert restored.name == comp.name
        assert restored.type == comp.type
        assert restored.parent == comp.parent
        assert restored.priority == comp.priority
        assert restored.floor == comp.floor
        assert restored.is_backup == comp.is_backup
        assert restored.backup == comp.backup
        assert restored.tags == comp.tags
        assert restored.children == comp.children
        assert restored.external_field == comp.external_field

    def test_is_container_true_for_station(self):
        comp = HierarchyComponent("S", "station", None, 0, 0, False)
        assert comp.is_container is True
        assert comp.is_leaf is False

    def test_is_leaf_true_for_generator(self):
        comp = HierarchyComponent("G", "generator", "S", 0, 0, False)
        assert comp.is_leaf is True
        assert comp.is_container is False

    def test_globally_unique_name_required(self):
        """Spec invariant: names are globally unique. This documents the requirement."""
        comp1 = HierarchyComponent("Gen1", "generator", "A", 0, 0, False)
        comp2 = HierarchyComponent("Gen1", "generator", "B", 0, 0, False)
        # Both can be created; uniqueness enforcement is the compiler's job.
        assert comp1.name == comp2.name == "Gen1"


class TestCompiledConnection:
    """Tests for CompiledConnection serialization."""

    def test_required_fields_in_to_dict(self):
        conn = CompiledConnection("Gen1", "Controller1", "power", "supplies")
        d = conn.to_dict()
        assert d["source"] == "Gen1"
        assert d["target"] == "Controller1"
        assert d["type"] == "power"
        assert d["relation"] == "supplies"

    def test_round_trip(self):
        conn = CompiledConnection("A", "B", "signal", "controls")
        d = conn.to_dict()
        restored = CompiledConnection.from_dict(d)
        assert restored == conn


class TestRuntimeConnection:
    """Tests for RuntimeConnection serialization."""

    def test_runtime_has_status_not_relation(self):
        """Spec §6.2: Runtime connection.json has status and not relation."""
        conn = RuntimeConnection("A", "B", "power", "active")
        d = conn.to_dict()
        assert "status" in d
        assert "relation" not in d

    def test_from_compiled_defaults_to_active(self):
        compiled = CompiledConnection("A", "B", "power", "supplies")
        runtime = RuntimeConnection.from_compiled(compiled)
        assert runtime.status == "active"

    def test_round_trip(self):
        conn = RuntimeConnection("A", "B", "data", "failure")
        d = conn.to_dict()
        restored = RuntimeConnection.from_dict(d)
        assert restored.source == conn.source
        assert restored.target == conn.target
        assert restored.type == conn.type
        assert restored.status == conn.status


class TestRuntimeComponent:
    """Tests for RuntimeComponent serialization."""

    def test_required_fields_present(self):
        comp = RuntimeComponent("Gen1", "generator")
        d = comp.to_dict()
        for field in ["name", "type", "is_backup", "status", "value"]:
            assert field in d

    def test_default_status_is_active(self):
        comp = RuntimeComponent("Gen1", "generator")
        assert comp.status == "active"

    def test_round_trip(self):
        comp = RuntimeComponent(
            name="Gen1",
            type="generator",
            is_backup=False,
            status="active",
            value={"power_output_W": 100_000.0, "temperature_C": 25.0},
        )
        d = comp.to_dict()
        restored = RuntimeComponent.from_dict(d)
        assert restored.name == comp.name
        assert restored.type == comp.type
        assert restored.status == comp.status
        assert restored.value == comp.value


class TestContainerAndLeafSets:
    """Tests that container and leaf type sets match specification §1.2, §1.3."""

    def test_container_types_include_required(self):
        required = {"campus", "station", "floor", "block", "system"}
        assert required.issubset(CONTAINER_TYPES)

    def test_leaf_types_include_required(self):
        required = {
            "sensor", "antenna", "generator", "controller", "tank",
            "pump", "storage", "vent", "alarm", "server", "vehicle",
            "solar_panel", "air_conditioner",
        }
        assert required.issubset(LEAF_COMPONENT_TYPES)

    def test_container_and_leaf_disjoint(self):
        """Container and leaf types must not overlap."""
        assert CONTAINER_TYPES.isdisjoint(LEAF_COMPONENT_TYPES)

    def test_all_types_is_union(self):
        assert ALL_COMPONENT_TYPES == CONTAINER_TYPES | LEAF_COMPONENT_TYPES

    def test_four_connection_types(self):
        assert SUPPORTED_CONNECTION_TYPES == {"power", "data", "signal", "resource"}
