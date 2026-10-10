import copy
from typing import Any

from pydantic import BaseModel

from twin_sim.dsl.semantics import _set_nested_field
from twin_sim.ingestion.models import ExternalModel, RuntimeComponent, RuntimeConnection


class EventLayer(BaseModel):
    event_id: str
    source_order: int
    start_time: float
    end_time: float
    node_key: str  # e.g., "component:Gen1" or "connection:Gen1_data_Gen2" or "external:network"
    field_path: str  # e.g., "value.temperature" or "status"
    value: Any


class TimelineStateManager:
    def __init__(
        self,
        components: list[RuntimeComponent],
        connections: list[RuntimeConnection],
        external: ExternalModel,
    ):
        # We store the base state as deep copies so we don't mutate the originals
        self.base_components = {c.name: copy.deepcopy(c) for c in components}

        # Connections need a unique key. Let's use "{source}_{type}_{target}"
        self.base_connections = {
            f"{c.source}_{c.type}_{c.target}": copy.deepcopy(c) for c in connections
        }

        self.base_external = copy.deepcopy(external)

        # Active layers affecting fields
        self.active_layers: list[EventLayer] = []

        # Permanent layers (infinite events applied to base state)
        self.permanent_layers: list[EventLayer] = []

        # Current effective state (recalculated whenever layers change)
        self.effective_components = {
            k: copy.deepcopy(v) for k, v in self.base_components.items()
        }
        self.effective_connections = {
            k: copy.deepcopy(v) for k, v in self.base_connections.items()
        }
        self.effective_external = copy.deepcopy(self.base_external)

    def _get_node_key(self, node: Any) -> str:
        if isinstance(node, RuntimeComponent):
            return f"component:{node.name}"
        elif isinstance(node, RuntimeConnection):
            return f"connection:{node.source}_{node.type}_{node.target}"
        elif isinstance(node, ExternalModel):
            return "external:root"
        elif type(node).__name__ == "NetworkModel":
            return "external:network"
        elif type(node).__name__ == "WeatherModel":
            return "external:weather"
        elif type(node).__name__ == "SupplyModel":
            return "external:supplies"
        raise ValueError(f"Unknown node type: {type(node)}")

    def _get_base_node(self, node_key: str) -> Any:
        kind, ident = node_key.split(":", 1)
        if kind == "component":
            return self.base_components[ident]
        if kind == "connection":
            return self.base_connections[ident]
        if kind == "external":
            if ident == "root":
                return self.base_external
            if ident == "network":
                return self.base_external.network
            if ident == "weather":
                return self.base_external.weather
            if ident == "supplies":
                return self.base_external.supplies
            return self.base_external
        raise ValueError(f"Unknown node kind {kind}")

    def _get_effective_node(self, node_key: str) -> Any:
        kind, ident = node_key.split(":", 1)
        if kind == "component":
            return self.effective_components[ident]
        if kind == "connection":
            return self.effective_connections[ident]
        if kind == "external":
            if ident == "root":
                return self.effective_external
            if ident == "network":
                return self.effective_external.network
            if ident == "weather":
                return self.effective_external.weather
            if ident == "supplies":
                return self.effective_external.supplies
            return self.effective_external
        raise ValueError(f"Unknown node kind {kind}")

    def apply_infinite_event(
        self,
        event_id: str,
        source_order: int,
        start: float,
        node: Any,
        field_path: str,
        value: Any,
    ):
        """
        Applies a for=inf event.
        - Removes active layers for this specific field.
        - Writes to base state.
        - Recalculates effective state.
        """
        node_key = self._get_node_key(node)

        # Remove active layers for this field
        self.active_layers = [
            layer
            for layer in self.active_layers
            if not (layer.node_key == node_key and layer.field_path == field_path)
        ]

        # Write to base state
        base_node = self._get_base_node(node_key)
        _set_nested_field(base_node, field_path, value)

        # Track for observability
        self.permanent_layers.append(
            EventLayer(
                event_id=event_id,
                source_order=source_order,
                start_time=start,
                end_time=float("inf"),
                node_key=node_key,
                field_path=field_path,
                value=value,
            )
        )

        self.recalculate_effective_state()

    def add_finite_event(
        self,
        event_id: str,
        source_order: int,
        start: float,
        end: float,
        node: Any,
        field_path: str,
        value: Any,
    ):
        """Adds a temporary event layer."""
        node_key = self._get_node_key(node)

        layer = EventLayer(
            event_id=event_id,
            source_order=source_order,
            start_time=start,
            end_time=end,
            node_key=node_key,
            field_path=field_path,
            value=value,
        )
        self.active_layers.append(layer)
        self.recalculate_effective_state()

    def expire_events(self, current_time: float) -> list[EventLayer]:
        """Removes events whose end_time <= current_time and returns the expired ones."""
        initial_count = len(self.active_layers)
        expired = [layer for layer in self.active_layers if layer.end_time <= current_time]
        self.active_layers = [
            layer for layer in self.active_layers if layer.end_time > current_time
        ]

        if len(self.active_layers) != initial_count:
            self.recalculate_effective_state()
            
        return expired

    def recalculate_effective_state(self):
        """
        Rebuilds effective state from base state + sorted active layers.
        Layers are sorted by (start_time, source_order).
        """
        # Reset effective state to base
        self.effective_components = {
            k: copy.deepcopy(v) for k, v in self.base_components.items()
        }
        self.effective_connections = {
            k: copy.deepcopy(v) for k, v in self.base_connections.items()
        }
        self.effective_external = copy.deepcopy(self.base_external)

        # Sort layers: first by start time (oldest first), then by source order
        sorted_layers = sorted(
            self.active_layers, key=lambda x: (x.start_time, x.source_order)
        )

        for layer in sorted_layers:
            eff_node = self._get_effective_node(layer.node_key)
            _set_nested_field(eff_node, layer.field_path, layer.value)

    def get_effective_state_dict(self) -> dict[str, Any]:
        """Returns the dictionary format expected by semantic evaluators."""
        return {
            "components": list(self.effective_components.values()),
            "connections": list(self.effective_connections.values()),
            "external": self.effective_external,
        }
