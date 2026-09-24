"""
Twin domain models for PolarTwin (implementation_plan.md Phase 2).

These are the Python dataclass representations of the compiled JSON models.
They must match the specification exactly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


# ---------------------------------------------------------------------------
# 2.1 Hierarchy model (spec §1, hierarchy.twin -> hierarchy.json)
# ---------------------------------------------------------------------------

CONTAINER_TYPES: frozenset[str] = frozenset({
    "campus", "station", "floor", "block", "system"
})
# Note: "subsystem" is NOT a supported container type (confirmed by spec).

LEAF_COMPONENT_TYPES: frozenset[str] = frozenset({
    "sensor", "antenna", "generator", "controller", "tank",
    "pump", "storage", "vent", "alarm", "server", "vehicle",
    "solar_panel", "air_conditioner",
})

ALL_COMPONENT_TYPES: frozenset[str] = CONTAINER_TYPES | LEAF_COMPONENT_TYPES


@dataclass
class HierarchyComponent:
    """
    Represents one component entry in hierarchy.json (spec §1.5).

    All fields match the specification output exactly.
    """

    name: str
    """Globally unique component name."""

    type: str
    """Component or container type."""

    parent: Optional[str]
    """Name of the component's direct parent; None for root."""

    priority: int
    """Priority within the component's local scope. Lower = higher priority."""

    floor: int
    """Floor level on which the component is located; defaults to 0."""

    is_backup: bool
    """Whether the component is designated as a backup."""

    backup: list[str] = field(default_factory=list)
    """Names of components that this component backs up (empty if is_backup=False)."""

    external_field: Optional[str] = None
    """Referenced external field path (e.g. 'network.up'), or None."""

    children: list[str] = field(default_factory=list)
    """Names of the component's direct children."""

    tags: list[str] = field(default_factory=list)
    """Tags assigned to the component."""

    @property
    def is_container(self) -> bool:
        return self.type in CONTAINER_TYPES

    @property
    def is_leaf(self) -> bool:
        return self.type in LEAF_COMPONENT_TYPES

    def to_dict(self) -> dict:
        """Serialize to the hierarchy.json format (spec §1.5)."""
        return {
            "name": self.name,
            "type": self.type,
            "parent": self.parent,
            "priority": self.priority,
            "floor": self.floor,
            "is_backup": self.is_backup,
            "backup": list(self.backup),
            "external_field": self.external_field,
            "children": list(self.children),
            "tags": list(self.tags),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "HierarchyComponent":
        """Deserialize from the hierarchy.json format."""
        return cls(
            name=data["name"],
            type=data["type"],
            parent=data.get("parent"),
            priority=data.get("priority", 0),
            floor=data.get("floor", 0),
            is_backup=data.get("is_backup", False),
            backup=list(data.get("backup", [])),
            external_field=data.get("external_field"),
            children=list(data.get("children", [])),
            tags=list(data.get("tags", [])),
        )


# ---------------------------------------------------------------------------
# 2.2 Connection model (spec §2, connection.twin -> connection.json)
# ---------------------------------------------------------------------------

SUPPORTED_CONNECTION_TYPES: frozenset[str] = frozenset({
    "power", "data", "signal", "resource"
})


@dataclass(frozen=True)
class CompiledConnection:
    """
    Compiled connection entry (spec §2.4).

    This is the static, compiled form (from connection.twin -> connection.json).
    It includes the relation field.
    """

    source: str
    """Name of the source component."""

    target: str
    """Name of the target component."""

    type: str
    """Connection type: power, data, signal, or resource."""

    relation: str
    """Relationship associated with the connection."""

    def to_dict(self) -> dict:
        """Serialize to the compiled connection.json format (spec §2.4)."""
        return {
            "source": self.source,
            "target": self.target,
            "type": self.type,
            "relation": self.relation,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CompiledConnection":
        return cls(
            source=data["source"],
            target=data["target"],
            type=data["type"],
            relation=data["relation"],
        )


@dataclass
class RuntimeConnection:
    """
    Runtime connection entry (spec §6).

    This is the simulation runtime form (simulation connection.json).
    It removes the relation field and adds status.
    """

    source: str
    target: str
    type: str
    status: str = "active"  # "active" | "inactive" | "failure"

    def to_dict(self) -> dict:
        """Serialize to the runtime connection.json format (spec §6.2)."""
        return {
            "source": self.source,
            "target": self.target,
            "type": self.type,
            "status": self.status,
        }

    @classmethod
    def from_compiled(cls, compiled: CompiledConnection) -> "RuntimeConnection":
        """Create a runtime connection from a compiled connection."""
        return cls(
            source=compiled.source,
            target=compiled.target,
            type=compiled.type,
            status="active",
        )

    @classmethod
    def from_dict(cls, data: dict) -> "RuntimeConnection":
        return cls(
            source=data["source"],
            target=data["target"],
            type=data["type"],
            status=data.get("status", "active"),
        )


# ---------------------------------------------------------------------------
# 2.3 Specification model (spec §3, spec.twin -> spec.json)
# ---------------------------------------------------------------------------

@dataclass
class RatingValue:
    """
    A single rating value, which may be a scalar or a range (spec §3.3).
    """

    value: Optional[float] = None
    """Scalar value (for fixed parameters like voltage=240)."""

    min: Optional[float] = None
    """Minimum of a range (for voltage=120:255)."""

    max: Optional[float] = None
    """Maximum of a range."""

    unit: Optional[str] = None
    """Unit string after canonical conversion."""

    def is_scalar(self) -> bool:
        return self.value is not None and self.min is None and self.max is None

    def is_range(self) -> bool:
        return self.min is not None and self.max is not None

    def to_dict(self) -> dict:
        result: dict = {}
        if self.value is not None:
            result["value"] = self.value
        if self.min is not None:
            result["min"] = self.min
        if self.max is not None:
            result["max"] = self.max
        if self.unit is not None:
            result["unit"] = self.unit
        return result


@dataclass
class ComponentSpec:
    """
    Fully resolved specification for one component (spec §3.5).

    After CSS-like inheritance is applied, every omitted field is filled from the default.
    """

    name: str
    type: str
    rating: dict[str, Any] = field(default_factory=dict)
    """rating@input, rating@output, rating@state — or flat for sensors."""

    dimension: dict[str, Any] = field(default_factory=dict)
    """length, width, height with units."""

    description: str = ""
    representation: str = ""

    # Sensor-specific
    measures: Optional[str] = None
    """For sensor type: the measurement type (e.g. 'voltage')."""

    # Extra type-specific fields (HP for pump, etc.)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Serialize to the spec.json format (spec §3.5)."""
        result: dict = {
            "name": self.name,
            "type": self.type,
        }
        if self.measures is not None:
            result["measures"] = self.measures
        if self.rating:
            result["rating"] = self.rating
        if self.dimension:
            result["dimension"] = self.dimension
        if self.description:
            result["description"] = self.description
        if self.representation:
            result["representation"] = self.representation
        result.update(self.extra)
        return result


# ---------------------------------------------------------------------------
# Runtime component state (spec §5)
# ---------------------------------------------------------------------------

@dataclass
class RuntimeComponent:
    """
    Runtime state for one component (spec §5 — component.json entry).

    All values are stored in canonical units (spec §5.1).
    """

    name: str
    type: str
    is_backup: bool = False
    status: str = "active"  # ComponentStatus value
    value: dict[str, Any] = field(default_factory=dict)
    """Current values in canonical units."""

    def to_dict(self) -> dict:
        """Serialize to the component.json format (spec §5.3)."""
        return {
            "name": self.name,
            "type": self.type,
            "is_backup": self.is_backup,
            "status": self.status,
            "value": dict(self.value),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RuntimeComponent":
        return cls(
            name=data["name"],
            type=data["type"],
            is_backup=data.get("is_backup", False),
            status=data.get("status", "active"),
            value=dict(data.get("value", {})),
        )
