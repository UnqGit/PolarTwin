from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Target kind constants (derived from parsed target clause, Spec §9)
# ---------------------------------------------------------------------------

TargetKind = Literal[
    "component.name",    # @component.name
    "component.type",    # @component.type
    "component.any",     # @component.type | @component.name  (combined)
    "connection",        # @connection  (full 3-field selector from scene)
    "connection.source", # @connection.source
    "connection.target", # @connection.target
    "connection.type",   # @connection.type
    "connection.multi",  # @connection.(field1 & field2)
    "external",          # @external  (scene provides which group)
    "external.network",  # @external.network
    "external.weather",  # @external.weather
    "external.supplies", # @external.supplies
]


def derive_target_kind(target: str) -> TargetKind:
    """Derive the TargetKind from a validated target string."""
    if "|" in target:
        return "component.any"
    if target == "@component.name":
        return "component.name"
    if target == "@component.type":
        return "component.type"
    if target == "@connection":
        return "connection"
    if target == "@connection.source":
        return "connection.source"
    if target == "@connection.target":
        return "connection.target"
    if target == "@connection.type":
        return "connection.type"
    if target.startswith("@connection.("):
        return "connection.multi"
    if target == "@external":
        return "external"
    if target == "@external.network":
        return "external.network"
    if target == "@external.weather":
        return "external.weather"
    if target == "@external.supplies":
        return "external.supplies"
    # Fallback (should not happen if target was validated)
    return "component.any"


class EventDefinition(BaseModel):
    """Represents a parsed .event file."""

    name: str
    target: str
    # Derived from target for fast dispatch in the engine
    target_kind: TargetKind = "component.any"
    # Multi-field connection fields (populated when target_kind == "connection.multi")
    connection_multi_fields: list[str] = Field(default_factory=list)

    where: list[str] = Field(default_factory=list)

    # If the set block contains `fields`
    set_fields_allowed: bool = False

    # e.g., ["value", "values.temperature"]
    set_allowed: list[str] = Field(default_factory=list)

    # Fields that are strictly required (no '?')
    set_required: list[str] = Field(default_factory=list)

    # e.g., {"status": "failure", "values.voltage.output": 120}
    set_fixed: dict[str, Any] = Field(default_factory=dict)


class SceneEvent(BaseModel):
    """Represents a single parsed event from a .scene file."""

    event_ref: str
    selector: str | None = None
    at: float
    duration: float  # can be float('inf')

    # The payload built from the `set { ... }` block inside the scene
    payload: dict[str, Any] = Field(default_factory=dict)

    source_location: int = 0
    source_order: int = 0
    
    event_definition: EventDefinition | None = Field(default=None, exclude=True)
    user_provided_keys: set[str] = Field(default_factory=set, exclude=True)
    payload_line_numbers: dict[str, int] = Field(default_factory=dict, exclude=True)
