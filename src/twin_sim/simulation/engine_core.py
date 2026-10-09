"""
engine_core.py — Phases 12-15 full implementation.

The SimulationEngineCore now accepts an optional HierarchyGraph and ConnectionGraph
so it can perform:

- Phase 12: Backup logic (respecting explicit scene-imposed inactive), controller
  awareness, tolerance/rating, hierarchical status propagation.
- Phase 13: General failure model with spec-based tolerance per field.
- Phase 14: Multi-supply power/resource allocation with topological distribution.
- Phase 15: Component-specific behaviour wired to the actual connection graph
  (generator, pump, solar panel, tank, antenna, server, alarm, AC, vent, containers,
  station).

Architecture note:
  The engine operates on BASE state for physics and writes back to base state.
  Effective state (base + active event layers) is recalculated after each tick.
  This ensures scene events correctly override physics results.
"""

import copy
import random
import time
from typing import Any

from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.dsl.models import SceneEvent
from twin_sim.ingestion.models import ExternalModel, RuntimeComponent, RuntimeConnection
from twin_sim.simulation import behaviors

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _v(data: Any, key: str, default: float) -> float:
    """Extract a float value from a dict-like value object or scalar."""
    if isinstance(data, dict):
        return float(data.get(key, default))
    try:
        return float(data)
    except (TypeError, ValueError):
        return default


def _set_v(data: Any, key: str, value: float):
    """Set a value inside a dict-like value object."""
    if isinstance(data, dict):
        data[key] = value


def _update_field(c, field: str, new_val: float):
    obj = c.value.get(field)
    if isinstance(obj, dict):
        obj["value"] = new_val
    elif obj is not None:
        # Upgrade scalar to dict to preserve its value as max
        c.value[field] = {"value": new_val, "max": float(obj)}
    else:
        c.value[field] = new_val


class HierarchyNode:
    """Lightweight in-memory representation of a hierarchy entry."""

    __slots__ = (
        "backup_for",
        "children",
        "external_field",
        "floor",
        "is_backup",
        "name",
        "parent",
        "priority",
        "tags",
        "type",
    )

    def __init__(self, entry: dict[str, Any]):
        self.name: str = entry["name"]
        self.type: str = entry["type"]
        self.parent: str | None = entry.get("parent")
        self.children: list[str] = entry.get("children", [])
        self.priority: int = entry.get("priority", 0)
        self.floor: int = entry.get("floor", 0)
        self.is_backup: bool = entry.get("is_backup", False)
        self.backup_for: list[str] = entry.get("backup", [])
        self.external_field: str | None = entry.get("external_field")
        self.tags: list[str] = entry.get("tags", [])


class HierarchyGraph:
    """
    Provides ancestor/descendant queries over the hierarchy.
    Built once from hierarchy.json list.
    """

    def __init__(self, hierarchy_list: list[dict[str, Any]]):
        self.nodes: dict[str, HierarchyNode] = {
            e["name"]: HierarchyNode(e) for e in hierarchy_list
        }

    def ancestors(self, name: str) -> list[str]:
        """Returns list of ancestor names from parent → root."""
        result = []
        current = self.nodes.get(name)
        while current and current.parent:
            result.append(current.parent)
            current = self.nodes.get(current.parent)
        return result

    def descendants(self, name: str) -> list[str]:
        """Returns all descendant names (BFS)."""
        result: list[str] = []
        queue = list(self.nodes[name].children) if name in self.nodes else []
        while queue:
            child = queue.pop(0)
            result.append(child)
            if child in self.nodes:
                queue.extend(self.nodes[child].children)
        return result

    def direct_children(self, name: str) -> list[str]:
        return self.nodes[name].children if name in self.nodes else []

    def parent_of(self, name: str) -> str | None:
        node = self.nodes.get(name)
        return node.parent if node else None

    def is_ancestor_inactive_or_failed(
        self, name: str, component_statuses: dict[str, str]
    ) -> bool:
        """
        Returns True if any ancestor of `name` is inactive or in failure.
        This implements hierarchical status propagation without mutating descendants.
        """
        for anc in self.ancestors(name):
            s = component_statuses.get(anc)
            if s in ("inactive", "failure"):
                return True
        return False


class ConnectionGraph:
    """
    Thin wrapper over the runtime connection list providing neighbour queries.
    """

    def __init__(self, connections: list[RuntimeConnection]):
        # Index by (source, type, target) for O(1) lookup
        self._conns: list[RuntimeConnection] = list(connections)

    def update(self, connections: list[RuntimeConnection]):
        self._conns = list(connections)

    def active_power_sources(self, target_name: str) -> list[str]:
        """Components that send power to `target_name` via an active power connection."""
        return [
            c.source
            for c in self._conns
            if c.target == target_name and c.type == "power" and c.status == "active"
        ]

    def active_power_targets(self, source_name: str) -> list[str]:
        """Components receiving power from `source_name` via active power connections."""
        return [
            c.target
            for c in self._conns
            if c.source == source_name and c.type == "power" and c.status == "active"
        ]

    def active_resource_sources(self, target_name: str) -> list[str]:
        """Components that send resources (flowrate) to `target_name` via active resource connections."""
        return [
            c.source
            for c in self._conns
            if c.target == target_name and c.type == "resource" and c.status == "active"
        ]

    def active_resource_targets(self, source_name: str) -> list[str]:
        return [
            c.target
            for c in self._conns
            if c.source == source_name and c.type == "resource" and c.status == "active"
        ]

    def active_signal_sources(self, target_name: str) -> list[str]:
        return [
            c.source
            for c in self._conns
            if c.target == target_name and c.type == "signal" and c.status == "active"
        ]

    def active_connections_for_node(self, node_name: str) -> list[RuntimeConnection]:
        """All active connections where node is source or target."""
        return [
            c
            for c in self._conns
            if (c.source == node_name or c.target == node_name) and c.status == "active"
        ]

    def active_connection_count(self, node_name: str) -> int:
        return len(self.active_connections_for_node(node_name))

    def connections_of_type(self, conn_type: str) -> list[RuntimeConnection]:
        return [c for c in self._conns if c.type == conn_type]

    def get_connection(
        self, source: str, conn_type: str, target: str
    ) -> RuntimeConnection | None:
        for c in self._conns:
            if c.source == source and c.type == conn_type and c.target == target:
                return c
        return None


# ---------------------------------------------------------------------------
# SimulationEngineCore
# ---------------------------------------------------------------------------


class SimulationEngineCore:
    """
    Full Phase 12-15 simulation engine.

    Parameters
    ----------
    state_manager : TimelineStateManager
        The stateful event/layer manager containing base + effective state.
    scenes : list[SceneEvent]
        All scene events to be instantiated at their `at` times.
    hierarchy : HierarchyGraph | None
        Compiled hierarchy providing ancestor/descendant queries.
        When None, hierarchical propagation is skipped (useful for unit tests
        that do not provide full station topology).
    global_tolerance : float
        Global tolerance percentage (default 10.0).
    """

    CONTAINERS = {"campus", "station", "block", "floor", "system", "generic"}  # noqa: RUF012

    def __init__(
        self,
        state_manager: TimelineStateManager,
        scenes: list[SceneEvent],
        hierarchy: HierarchyGraph | None = None,
        global_tolerance: float = 10.0,
        specs: list[dict] | None = None,
    ):
        self.specs = specs or []
        self.state = state_manager
        # Sort by (at, stable source order) — scene order preserved within same at
        self.scenes: list[SceneEvent] = sorted(scenes, key=lambda s: s.at)
        self._scene_index = 0  # pointer into sorted scenes list

        self.time: float = 0.0  # simulation hours
        self.hierarchy: HierarchyGraph | None = hierarchy
        self.global_tolerance: float = global_tolerance

        # Track which components had their inactive state explicitly imposed by
        # a scene event; these must not be auto-activated.
        self._explicit_inactive: set[str] = set()

        # Telemetry list (one entry per tick when publishing is enabled)
        self.telemetry: list[dict[str, Any]] = []
        self.telemetry_publishing: bool = False

        # Simulation event logs
        self.logs: list[dict[str, Any]] = []

        # Build connection graph from initial base connections
        self._conn_graph = ConnectionGraph(
            list(state_manager.base_connections.values())
        )

        # Last-valid data cache for missing data extrapolation (field → value)
        self._last_valid: dict[str, dict[str, Any]] = {}  # comp_name → {field: value}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_tick(self):
        """Execute one deterministic simulation tick (15 simulation seconds)."""
        dt = 15.0 / 3600.0  # hours per tick

        # ── Step 1: Advance simulation time ─────────────────────────────
        self.time += dt

        # ── Steps 2-3: Instantiate scene events ──────────────────────────
        self._instantiate_events()

        # ── Step 4: Expire finite event layers ───────────────────────────
        self.state.expire_events(self.time)

        # ── Refresh connection graph from current base connections ────────
        self._conn_graph.update(list(self.state.base_connections.values()))

        # Snapshot base components for physics
        base_comps = self.state.base_components
        base_conns = self.state.base_connections
        external = self.state.base_external

        prev_statuses = {name: c.status for name, c in base_comps.items()}

        # Build effective status map (considers event layers) for hierarchical checks
        eff = self.state.get_effective_state_dict()
        eff_status: dict[str, str] = {c.name: c.status for c in eff["components"]}

        # ── Step 5: Hierarchical effective status ─────────────────────────
        # No mutation of descendants; we just use the eff_status for decisions.

        # ── Step 6: Resolve connection statuses ──────────────────────────
        # A connection involving a failed/inactive (or ancestor-failed/inactive)
        # endpoint is set to inactive in base state.
        self._resolve_connection_statuses(base_comps, base_conns, eff_status)
        self._conn_graph.update(list(base_conns.values()))

        # ── Step 7: Resolve missing data ─────────────────────────────────
        self._resolve_missing_data(base_comps, base_conns)

        # ── Step 8: Resource allocation (power + flowrate) ───────────────
        self._resolve_resource_allocation(base_comps, external)

        # ── Step 9: Controller adjustments ───────────────────────────────
        self._apply_controller_adjustments(base_comps)

        # ── Step 10: Type-specific component behaviour ───────────────────
        self._run_component_behaviours(base_comps, base_conns, external)

        # ── Step 11: Rating/tolerance failure countdowns ─────────────────
        self._evaluate_failure_countdowns(base_comps, eff_status, dt)

        # ── Step 12: Backup auto-activation ──────────────────────────────
        self._apply_backup_logic(base_comps, eff_status)

        # ── Step 13: Container/station thermal state ──────────────────────
        self._update_container_temperatures(base_comps, external)

        # ── Step 14-15: Write runtime state ──────────────────────────────
        # (base_comps and base_conns are already the runtime state; we mutate in-place)

        # Log status changes
        for name, c in base_comps.items():
            prev = prev_statuses.get(name)
            if prev and c.status != prev:
                level = (
                    "ERROR"
                    if c.status == "failure"
                    else ("WARN" if c.status == "inactive" else "INFO")
                )
                self.logs.append(
                    {
                        "time": self.time,
                        "level": level,
                        "message": f"Component '{name}' status changed from {prev.upper()} to {c.status.upper()}",
                    }
                )

        # ── Recalculate effective state with new physics base ─────────────
        self.state.recalculate_effective_state()

        # ── Steps 17-18: Telemetry ───────────────────────────────────────
        # if self.telemetry_publishing:
        self.telemetry.append(
            self._snapshot(
                self.state.effective_components,
                self.state.effective_connections,
                self.state.effective_external,
            )
        )

    def run_duration(self, hours: float):
        """Run for the given number of simulation hours."""
        ticks = round(hours * 3600.0 / 15.0)
        for _ in range(ticks):
            self.run_tick()

    # ------------------------------------------------------------------
    # Step 2-3: Event instantiation
    # ------------------------------------------------------------------

    def _instantiate_events(self):
        """Instantiate all scene events whose `at` time ≤ current simulation time."""
        eff_comps = {
            c.name: c for c in self.state.get_effective_state_dict()["components"]
        }
        eff_conns = list(self.state.effective_connections.values())
        ext = self.state.base_external

        for scene in list(self.scenes):
            if scene.at > self.time:
                break  # list is sorted; no more events at this time

            self.scenes.remove(scene)

            # Determine targets
            targets = self._resolve_scene_targets(scene, eff_comps, eff_conns, ext)

            # --- GAP 1: Target Match Strictness ---
            if scene.selector and not targets:
                expected_kind = getattr(scene, "event_definition", None)
                kind_str = expected_kind.target_kind if expected_kind else "unknown"
                raise ValueError(
                    f"Event '{scene.event_ref}' targeting '{scene.selector}' "
                    f"yielded no matching targets (expected kind: {kind_str})."
                )

            for target, node_key_hint in targets:
                # Track explicitly imposed inactive
                if scene.payload.get("status") == "inactive":  # noqa: SIM102
                    if isinstance(target, RuntimeComponent):
                        self._explicit_inactive.add(target.name)

                is_inf = scene.duration == float("inf")
                for field, value in scene.payload.items():
                    if not isinstance(target, (RuntimeComponent, RuntimeConnection)):
                        field_path = field
                    else:
                        if isinstance(target, RuntimeComponent):
                            if field == "status":
                                # --- GAP 3: Top-level status validation ---
                                if value not in ("active", "inactive", "failure"):
                                    raise ValueError(f"Invalid status '{value}' for component {target.name}")
                                field_path = "status"
                            elif field == "is_backup":
                                raise ValueError("is_backup is immutable and cannot be set")
                            else:
                                # --- GAP 2: Field existence validation against spec.json ---
                                root_field = field.split(".")[0]
                                comp_spec = next((s for s in self.specs if s.get("type") == target.type), None)
                                if comp_spec:
                                    valid_fields = set()
                                    rating = comp_spec.get("rating", {})
                                    for section in ("state", "input", "output"):
                                        if section in rating:
                                            valid_fields.update(rating[section].keys())
                                    if root_field not in valid_fields:
                                        raise ValueError(
                                            f"Field '{root_field}' is not a valid field for component type '{target.type}' "
                                            f"(target: {target.name})"
                                        )
                                field_path = f"value.{field}"
                        else:  # RuntimeConnection
                            if field == "status":
                                if value not in ("active", "inactive", "failure"):
                                    raise ValueError(f"Invalid status '{value}' for connection")
                                field_path = "status"
                            else:
                                raise ValueError(f"Connections only support 'status' mutations, got '{field}'")

                    if is_inf:
                        self.state.apply_infinite_event(
                            scene.event_ref, 0, scene.at, target, field_path, value
                        )
                    else:
                        self.state.add_finite_event(
                            scene.event_ref,
                            0,
                            scene.at,
                            scene.at + scene.duration,
                            target,
                            field_path,
                            value,
                        )

            # Log event start
            self.logs.append(
                {
                    "time": self.time,
                    "level": "INFO",
                    "message": f"Event '{scene.event_ref}' started"
                    + (f" targeting {scene.selector}" if scene.selector else ""),
                }
            )

            # if self.telemetry_publishing:
            snap = self._snapshot(eff_comps, self.state.effective_connections, ext)
            snap["source"] = scene.event_ref
            self.telemetry.append(snap)

    def _resolve_scene_targets(
        self,
        scene: SceneEvent,
        eff_comps: dict[str, RuntimeComponent],
        eff_conns: list[RuntimeConnection],
        ext: ExternalModel,
    ) -> list[tuple[Any, str]]:
        """
        Return list of (target_object, node_key_hint) for a scene event.

        Resolution is governed by the event definition's target_kind when present
        (attached as ``scene.event_definition`` by ScenarioManager). When no
        definition is available the old heuristic fallback is used so that
        ad-hoc / test scenes continue to work.

        Spec 9 target kinds:
          component.name   -- exact component name from scene selector
          component.type   -- all components of the given type
          component.any    -- combined: match by name OR type
          connection       -- full @(source|type|target) three-field selector
          connection.source/target/type -- single-field, selector is the value
          connection.multi -- two connection fields, selector is still 3-field
          external         -- scene selector is @network / @weather / @supplies
          external.network / .weather / .supplies -- no selector needed
        """
        selector = scene.selector or ""
        targets: list[tuple[Any, str]] = []

        # Retrieve attached event definition (set by ScenarioManager)
        event_def = getattr(scene, "event_definition", None)
        target_kind: str = event_def.target_kind if event_def else ""

        # Build the state dict once for where-clause evaluation
        state_dict = self.state.get_effective_state_dict()

        def _apply_where(node):
            """Evaluate where clauses from the event definition against a node."""
            if event_def is None or not event_def.where:
                return True
            from twin_sim.dsl.semantics import evaluate_node
            return evaluate_node(node, event_def.where, state_dict)

        # External targets - specific (no selector needed, Spec 9.3)
        if target_kind == "external.network":
            if _apply_where(ext.network):
                targets.append((ext.network, "external"))
            return targets

        if target_kind == "external.weather":
            if _apply_where(ext.weather):
                targets.append((ext.weather, "external"))
            return targets

        if target_kind == "external.supplies":
            if _apply_where(ext.supplies):
                targets.append((ext.supplies, "external"))
            return targets

        if target_kind == "external":
            # Scene provides the group selector: @network / @weather / @supplies
            sel_stripped = selector.lstrip("@").lower()
            if sel_stripped == "network":
                if _apply_where(ext.network):
                    targets.append((ext.network, "external"))
            elif sel_stripped == "weather":
                if _apply_where(ext.weather):
                    targets.append((ext.weather, "external"))
            elif sel_stripped == "supplies":
                if _apply_where(ext.supplies):
                    targets.append((ext.supplies, "external"))
            return targets

        # Component targets
        if target_kind in ("component.name", "component.type", "component.any"):
            sel_val = selector.lstrip("@")

            if target_kind == "component.name":
                # Exact name match only (Spec 9.1)
                if sel_val in eff_comps:
                    base_c = self.state.base_components.get(sel_val)
                    if base_c and _apply_where(base_c):
                        targets.append((base_c, "component"))

            elif target_kind == "component.type":
                # All components of the given type (Spec 9.1)
                for cname, comp in eff_comps.items():
                    if comp.type == sel_val:
                        base_c = self.state.base_components.get(cname)
                        if base_c and _apply_where(base_c):
                            targets.append((base_c, "component"))

            else:
                # component.any: try name first; if not found, match by type (Spec 9.1)
                if sel_val in eff_comps:
                    base_c = self.state.base_components.get(sel_val)
                    if base_c and _apply_where(base_c):
                        targets.append((base_c, "component"))
                else:
                    for cname, comp in eff_comps.items():
                        if comp.type == sel_val:
                            base_c = self.state.base_components.get(cname)
                            if base_c and _apply_where(base_c):
                                targets.append((base_c, "component"))
            return targets

        # Connection targets - full three-field selector (Spec 9.2)
        if target_kind == "connection":
            if selector.startswith("@(") and "|" in selector:
                inner = selector[2:-1]
                parts = inner.split("|")
                src_f = parts[0] if len(parts) > 0 else ""
                typ_f = parts[1] if len(parts) > 1 else ""
                tgt_f = parts[2] if len(parts) > 2 else ""
                for c in eff_conns:
                    if src_f and c.source != src_f:
                        continue
                    if typ_f and c.type != typ_f:
                        continue
                    if tgt_f and c.target != tgt_f:
                        continue
                    key = "{}_{}_{}" .format(c.source, c.type, c.target)
                    base_conn = self.state.base_connections.get(key)
                    if base_conn and _apply_where(base_conn):
                        targets.append((base_conn, "connection"))
            return targets

        # Connection targets - single field (Spec 9.2 field-specific)
        if target_kind in ("connection.source", "connection.target", "connection.type"):
            field = target_kind.split(".", 1)[1]  # "source", "target", or "type"
            sel_val = selector.lstrip("@")
            for c in eff_conns:
                if getattr(c, field, None) == sel_val:
                    key = "{}_{}_{}" .format(c.source, c.type, c.target)
                    base_conn = self.state.base_connections.get(key)
                    if base_conn and _apply_where(base_conn):
                        targets.append((base_conn, "connection"))
            return targets

        # Connection targets - multi-field (Spec 9.2 @connection.(field1 & field2))
        if target_kind == "connection.multi":
            fields = event_def.connection_multi_fields if event_def else []
            if selector.startswith("@(") and "|" in selector:
                inner = selector[2:-1]
                parts = inner.split("|")
                slot_map = {"source": 0, "type": 1, "target": 2}
                filter_vals = {}
                for f in fields:
                    idx = slot_map.get(f)
                    if idx is not None and idx < len(parts) and parts[idx]:
                        filter_vals[f] = parts[idx]
                for c in eff_conns:
                    if all(getattr(c, f, None) == v for f, v in filter_vals.items()):
                        key = "{}_{}_{}" .format(c.source, c.type, c.target)
                        base_conn = self.state.base_connections.get(key)
                        if base_conn and _apply_where(base_conn):
                            targets.append((base_conn, "connection"))
            return targets

        # FALLBACK: no event definition attached -- use heuristic (legacy / tests)
        if not selector:
            return targets

        if selector.startswith("@external.network") or selector.startswith("@network"):
            targets.append((ext.network, "external"))
        elif selector.startswith("@external.weather") or selector.startswith("@weather"):
            targets.append((ext.weather, "external"))
        elif selector.startswith("@external.supplies") or selector.startswith("@supplies"):
            targets.append((ext.supplies, "external"))
        elif selector.startswith("@(") and "|" in selector:
            inner = selector[2:-1]
            parts = inner.split("|")
            src_f = parts[0] if len(parts) > 0 else ""
            typ_f = parts[1] if len(parts) > 1 else ""
            tgt_f = parts[2] if len(parts) > 2 else ""
            for c in eff_conns:
                if src_f and c.source != src_f:
                    continue
                if typ_f and c.type != typ_f:
                    continue
                if tgt_f and c.target != tgt_f:
                    continue
                key = "{}_{}_{}" .format(c.source, c.type, c.target)
                base_conn = self.state.base_connections.get(key)
                if base_conn:
                    targets.append((base_conn, "connection"))
        elif selector.startswith("@"):
            sel_val = selector.lstrip("@")
            if sel_val in eff_comps:
                base_c = self.state.base_components.get(sel_val)
                if base_c:
                    targets.append((base_c, "component"))
            else:
                for cname, comp in eff_comps.items():
                    if comp.type == sel_val:
                        base_c = self.state.base_components.get(cname)
                        if base_c:
                            targets.append((base_c, "component"))

        return targets

        # @external.network / @external.weather / @external.supplies
        base_sel = (
            selector.split(".")[0]
            if "." in selector and not selector.startswith("@(")
            else selector
        )
        full_base = selector  # noqa: F841
        if selector.startswith("@external.network") or selector.startswith("@network"):  # noqa: PIE810
            targets.append((ext.network, "external"))
        elif selector.startswith("@external.weather") or selector.startswith(  # noqa: PIE810
            "@weather"
        ):
            targets.append((ext.weather, "external"))
        elif selector.startswith("@(") and "|" in selector:
            # Connection selector: @(source|type|target)
            inner = selector[2:-1]  # strip @( and )
            parts = inner.split("|")
            src_f = parts[0] if len(parts) > 0 else ""
            typ_f = parts[1] if len(parts) > 1 else ""
            tgt_f = parts[2] if len(parts) > 2 else ""
            for c in eff_conns:
                if src_f and c.source != src_f:
                    continue
                if typ_f and c.type != typ_f:
                    continue
                if tgt_f and c.target != tgt_f:
                    continue
                key = f"{c.source}_{c.type}_{c.target}"
                base_conn = self.state.base_connections.get(key)
                if base_conn:
                    targets.append((base_conn, "connection"))
        elif selector.startswith("@"):
            sel_val = base_sel[1:]  # strip leading @

            # Try as component name first (exact match)
            if sel_val in eff_comps:
                base_c = self.state.base_components.get(sel_val)
                if base_c:
                    targets.append((base_c, "component"))
            else:
                # Try as component type
                for name, comp in eff_comps.items():
                    if comp.type == sel_val:
                        base_c = self.state.base_components.get(name)
                        if base_c:
                            targets.append((base_c, "component"))

        return targets

    # ------------------------------------------------------------------
    # Step 6: Connection status resolution
    # ------------------------------------------------------------------

    def _resolve_connection_statuses(
        self,
        base_comps: dict[str, RuntimeComponent],
        base_conns: dict[str, RuntimeConnection],
        eff_status: dict[str, str],
    ):
        """
        If a connection's source or target component is failed/inactive (or has
        an ancestor that is), mark the connection as inactive in base state.
        Only downgrade; do not upgrade connections that were set to failure by events.
        """
        for key, conn in base_conns.items():  # noqa: PERF102
            if conn.status == "failure":
                continue  # event-set failure, leave alone

            src_down = self._component_is_effectively_down(conn.source, eff_status)
            tgt_down = self._component_is_effectively_down(conn.target, eff_status)

            if src_down or tgt_down:
                conn.status = "inactive"
            else:
                if conn.status == "inactive":
                    # Only restore to active if it was not explicitly set to failure
                    conn.status = "active"

    def _component_is_effectively_down(
        self, name: str, eff_status: dict[str, str]
    ) -> bool:
        """Returns True if the component or any ancestor is inactive/failed."""
        s = eff_status.get(name, "active")
        if s in ("inactive", "failure"):
            return True
        if self.hierarchy:
            return self.hierarchy.is_ancestor_inactive_or_failed(name, eff_status)
        return False

    # ------------------------------------------------------------------
    # Step 7: Missing data extrapolation
    # ------------------------------------------------------------------

    def _resolve_missing_data(
        self,
        base_comps: dict[str, RuntimeComponent],
        base_conns: dict[str, RuntimeConnection],
    ):
        """
        For any data connection that is inactive, the transmitted value is NULL.
        Extrapolate missing values from previously valid data or other available data.
        """
        for conn in base_conns.values():
            if conn.type != "data":
                continue
            if conn.status != "active":
                # Target may be missing its sensor input; record last valid
                src = base_comps.get(conn.source)
                tgt = base_comps.get(conn.target)
                if src and tgt:
                    # Cache last valid source values
                    cache = self._last_valid.setdefault(conn.source, {})
                    for k, v in src.value.items():
                        if v is not None:
                            cache[k] = v
            else:
                src = base_comps.get(conn.source)
                if src:
                    cache = self._last_valid.setdefault(conn.source, {})
                    for k, v in src.value.items():
                        if v is not None:
                            cache[k] = v

    # ------------------------------------------------------------------
    # Step 8: Resource allocation (Phase 14 – topological)
    # ------------------------------------------------------------------

    def _resolve_resource_allocation(
        self,
        base_comps: dict[str, RuntimeComponent],
        external: ExternalModel,
    ):
        """
        Phase 14: Multi-supply power/resource allocation.
        For each generator (power source) find its consumers via active power
        connections and distribute demand proportionally based on current load.

        Also handles pump → flowrate distribution.
        """
        # --- Power allocation from generators ---
        generators = [c for c in base_comps.values() if c.type == "generator"]
        for gen in generators:
            if gen.status != "active":
                _update_field(base_comps[gen.name], "power", 0.0)
                continue

            consumer_names = self._conn_graph.active_power_targets(gen.name)
            if not consumer_names:
                _update_field(base_comps[gen.name], "power", 0.0)
                continue

            # Total demanded power
            total_demanded = sum(
                _v(base_comps[n].value.get("power", {}), "value", 0.0)
                for n in consumer_names
                if n in base_comps
            )

            p_max = _v(base_comps[gen.name].value.get("power", {}), "max", 0.0)
            p_curr = _v(base_comps[gen.name].value.get("power", {}), "value", 0.0)  # noqa: F841

            if total_demanded <= 0:
                p_obj = base_comps[gen.name].value.get("power", {})
                _update_field(base_comps[gen.name], "power", 0.0)
                continue

            if total_demanded <= p_max:
                # Generator can satisfy all demand; output = total demanded
                p_obj = base_comps[gen.name].value.get("power", {})
                _update_field(base_comps[gen.name], "power", total_demanded)
            else:
                # Generator cannot satisfy full demand
                ratio = p_max / total_demanded if total_demanded > 0 else 0.0

                if ratio >= 0.35:
                    # Proportional allocation: each consumer gets x * requested
                    p_obj = base_comps[gen.name].value.get("power", {})  # noqa: F841
                    _update_field(base_comps[gen.name], "power", p_max)
                    for n in consumer_names:
                        if n in base_comps:
                            c_p_obj = base_comps[n].value.get("power", {})
                            c_demand = _v(c_p_obj, "value", 0.0)
                            _update_field(base_comps[n], "power", ratio * c_demand)
                else:
                    # Below 35%: shut down lowest-priority consumer
                    # Try activating an inactive component first
                    activated = self._try_activate_for_power(
                        base_comps, gen, consumer_names, total_demanded, p_max
                    )
                    if not activated:
                        self._deactivate_lowest_priority(base_comps, consumer_names)

        # --- Flowrate allocation from tanks/pumps ---
        tanks = [c for c in base_comps.values() if c.type == "tank"]
        for tank in tanks:
            if tank.status != "active":
                continue

            pump_names = self._conn_graph.active_resource_targets(tank.name)
            if not pump_names:
                continue

            total_fr_requested = sum(  # noqa: F841
                _v(base_comps[p].value.get("flowrate", {}), "value", 0.0)
                for p in pump_names
                if p in base_comps
            )

            v_obj = base_comps[tank.name].value.get("volume", {})
            v_curr = _v(v_obj, "value", 100.0)

            if v_curr <= 0:
                # Tank empty — deactivate connected pumps
                for p_name in pump_names:
                    if p_name in base_comps:
                        # Only deactivate if no other non-empty tank supplies them
                        other_tanks = [
                            t
                            for t in tanks
                            if t.name != tank.name
                            and p_name
                            in self._conn_graph.active_resource_targets(t.name)
                        ]
                        other_nonempty = any(
                            _v(base_comps[t.name].value.get("volume", {}), "value", 0.0)
                            > 0
                            for t in other_tanks
                        )
                        if not other_nonempty:
                            base_comps[p_name].status = "inactive"

    def _try_activate_for_power(
        self,
        base_comps: dict[str, RuntimeComponent],
        gen: RuntimeComponent,
        consumer_names: list[str],
        total_demanded: float,
        p_max: float,
    ) -> bool:
        """Try to activate an inactive component to restore ≥35% supply."""
        inactive_consumers = [
            n
            for n in consumer_names
            if n in base_comps
            and base_comps[n].status == "inactive"
            and n not in self._explicit_inactive
        ]
        if not inactive_consumers:
            return False

        # Sort by priority (ascending = higher priority first)
        if self.hierarchy:
            hier = self.hierarchy
            inactive_consumers.sort(
                key=lambda n: hier.nodes.get(
                    n, HierarchyNode({"name": n, "type": "generic"})
                ).priority
            )

        for candidate in inactive_consumers:
            # Activate and see if ratio improves to ≥35%
            candidate_demand = _v(
                base_comps[candidate].value.get("power", {}), "value", 0.0
            )
            new_total = total_demanded + candidate_demand
            if p_max / new_total >= 0.35:
                base_comps[candidate].status = "active"
                return True

        return False

    def _deactivate_lowest_priority(
        self,
        base_comps: dict[str, RuntimeComponent],
        consumer_names: list[str],
    ):
        """Deactivate the lowest-priority active consumer."""
        active_consumers = [
            n
            for n in consumer_names
            if n in base_comps and base_comps[n].status == "active"
        ]
        if not active_consumers:
            return

        if self.hierarchy:
            # Highest priority number = lowest priority
            hier = self.hierarchy
            active_consumers.sort(
                key=lambda n: -(
                    hier.nodes.get(
                        n, HierarchyNode({"name": n, "type": "generic"})
                    ).priority
                )
            )
        # Deactivate the first (lowest priority)
        base_comps[active_consumers[0]].status = "inactive"

    # ------------------------------------------------------------------
    # Step 9: Controller adjustments (Phase 12)
    # ------------------------------------------------------------------

    def _apply_controller_adjustments(self, base_comps: dict[str, RuntimeComponent]):
        """
        Components connected to an active controller via signal connections
        may have their operational values adjusted.
        Simplified: if a controller is active and connected via signal to a generator,
        set generator power to full capacity (controller manages demand).
        """
        controllers = [
            c
            for c in base_comps.values()
            if c.type == "controller" and c.status == "active"
        ]
        for ctrl in controllers:
            controlled = self._conn_graph.active_signal_sources(ctrl.name)
            for comp_name in controlled:
                if comp_name in base_comps:
                    comp = base_comps[comp_name]
                    if comp.type == "generator" and comp.status == "active":
                        # Controller drives generator to meet demand — set to max
                        p_obj = comp.value.get("power", {})
                        p_max = _v(p_obj, "max", 0.0)
                        if p_max > 0:
                            _update_field(base_comps[comp.name], "power", p_max)

    # ------------------------------------------------------------------
    # Step 10: Component-specific behaviours (Phase 15)
    # ------------------------------------------------------------------

    def _run_component_behaviours(
        self,
        base_comps: dict[str, RuntimeComponent],
        base_conns: dict[str, RuntimeConnection],
        external: ExternalModel,
    ):
        """Run per-component-type physics for every non-skipped component."""
        eff_status: dict[str, str] = {c.name: c.status for c in base_comps.values()}

        for c in base_comps.values():
            # Ensure failure tracking field exists
            c.value.setdefault("failure_time", 0.0)

            # Skip inactive or failed components (and those with inactive ancestors)
            if c.status in ("inactive", "failure"):
                continue
            if self._component_is_effectively_down(c.name, eff_status):
                continue

            # Resolve surrounding temperature (parent container temp or station default)
            t_surr = self._surrounding_temperature(c.name, base_comps, external)

            if c.type == "generator":
                self._behaviour_generator(c, t_surr, base_comps, external)

            elif c.type == "pump":
                self._behaviour_pump(c, t_surr, base_comps)

            elif c.type == "solar_panel":
                self._behaviour_solar_panel(c, external)

            elif c.type == "tank":
                self._behaviour_tank(c, base_comps)

            elif c.type == "antenna":
                self._behaviour_antenna(c)

            elif c.type == "server":
                self._behaviour_server(c, t_surr)

            elif c.type == "alarm":
                self._behaviour_alarm(c)

            elif c.type == "air_conditioner":
                self._behaviour_air_conditioner(c, t_surr, base_comps)

            elif c.type == "vent":
                self._behaviour_vent(c)

    def _surrounding_temperature(
        self,
        name: str,
        base_comps: dict[str, RuntimeComponent],
        external: ExternalModel,
    ) -> float:
        """
        Tsurr = parent container's temperature if it has one,
        otherwise station minimum (Texternal + 20).
        """
        if self.hierarchy:
            parent_name = self.hierarchy.parent_of(name)
            if parent_name and parent_name in base_comps:
                parent = base_comps[parent_name]
                t_obj = parent.value.get("temperature", {})
                return _v(t_obj, "value", external.weather.temperature + 20.0)
        return external.weather.temperature + 20.0

    # ── Generator ─────────────────────────────────────────────────────

    def _behaviour_generator(
        self,
        c: RuntimeComponent,
        t_surr: float,
        base_comps: dict[str, RuntimeComponent],
        external: ExternalModel,
    ):
        t_obj = c.value.get("temperature", {})
        p_obj = c.value.get("power", {})
        fr_obj = c.value.get("flowrate", {})

        t_prev = _v(t_obj, "value", 20.0)
        p_curr = _v(p_obj, "value", 0.0)
        p_max = _v(p_obj, "max", 1000.0)
        p_min = _v(p_obj, "min", 0.0)
        t_max = _v(t_obj, "max", 120.0)
        t_min_t = _v(t_obj, "min", -20.0)

        # Ensure power has a value even if 0
        _update_field(c, "power", p_curr)

        # Required flowrate proportional to power
        fr_max_rated = _v(fr_obj, "max", 100.0)
        if p_max > 0:
            fr_required = fr_max_rated * (p_curr / p_max)
        else:
            fr_required = 0.0
        _update_field(c, "flowrate", fr_required)

        # Startup deadlock prevention: generator inactive + pump inactive → start at p_min
        if p_curr <= 0:
            pump_sources = [
                n
                for n in self._conn_graph.active_resource_sources(c.name)
                if n in base_comps and base_comps[n].type == "pump"
            ]
            if pump_sources and all(
                base_comps[p].status == "inactive" for p in pump_sources
            ):
                p_curr = p_min
                _update_field(c, "power", p_curr)

        new_t = behaviors.generator_temperature(
            t_prev, t_surr, p_curr, p_max, p_min, t_max, t_min_t
        )
        _update_field(c, "temperature", new_t)

    # ── Pump ───────────────────────────────────────────────────────────

    def _behaviour_pump(
        self,
        c: RuntimeComponent,
        t_surr: float,
        base_comps: dict[str, RuntimeComponent],
    ):
        t_obj = c.value.get("temperature", {})
        fr_obj = c.value.get("flowrate", {})
        p_obj = c.value.get("power", {})

        fr_curr = _v(fr_obj, "value", 0.0)
        fr_max = _v(fr_obj, "max", 100.0)
        fr_min = _v(fr_obj, "min", 0.0)
        t_max = _v(t_obj, "max", 100.0)
        t_min_t = _v(t_obj, "min", -20.0)
        t_prev = _v(t_obj, "value", 20.0)

        # Requested flowrate = sum of connected consumers
        consumers = self._conn_graph.active_resource_targets(c.name)
        total_fr_demand = sum(
            _v(base_comps[n].value.get("flowrate", {}), "value", 0.0)
            for n in consumers
            if n in base_comps
        )

        if total_fr_demand > fr_max:
            ratio = fr_max / total_fr_demand if total_fr_demand > 0 else 0
            if ratio >= 0.30:
                fr_curr = fr_max
            else:
                # Below 30%: deactivate lowest-priority consumer
                self._deactivate_lowest_priority(base_comps, consumers)
                fr_curr = 0.0
        elif total_fr_demand > 0:
            fr_curr = min(fr_max, total_fr_demand)
        # else no demand: keep fr_curr as-is

        _update_field(c, "flowrate", fr_curr)

        # Temperature uses generator model with fr term
        new_t = behaviors.pump_temperature(
            t_prev, t_surr, fr_curr, fr_max, fr_min, t_max, t_min_t
        )
        _update_field(c, "temperature", new_t)

        # Power proportional to flowrate
        p_max_val = _v(p_obj, "max", 1000.0)
        if fr_max > 0:
            new_p = p_max_val * (fr_curr / fr_max)
        else:
            new_p = 0.0
        _update_field(c, "power", new_p)

    # ── Solar panel ────────────────────────────────────────────────────

    def _behaviour_solar_panel(self, c: RuntimeComponent, external: ExternalModel):
        p_obj = c.value.get("power", {})
        p_max = _v(p_obj, "max", 100.0)
        # Use external irradiance if available; fall back to 0 (no irradiance data)
        i_curr = getattr(external.weather, "irradiance", 0.0)
        i_max = _v(c.value.get("irradiance", {}), "max", 1000.0)
        new_p = behaviors.solar_panel_power(p_max, i_curr, i_max)
        _update_field(c, "power", new_p)

    # ── Tank ───────────────────────────────────────────────────────────

    def _behaviour_tank(
        self, c: RuntimeComponent, base_comps: dict[str, RuntimeComponent]
    ):
        v_obj = c.value.get("volume", {})
        v_prev = _v(v_obj, "value", 100.0)
        dt = 15.0 / 3600.0

        # Sum flowrate from all connected active pumps draining this tank
        pumps = self._conn_graph.active_resource_targets(c.name)
        total_fr = sum(
            _v(base_comps[p].value.get("flowrate", {}), "value", 0.0)
            for p in pumps
            if p in base_comps
        )

        new_v = behaviors.tank_volume(v_prev, total_fr, dt)
        _update_field(c, "volume", new_v)

    # ── Antenna ────────────────────────────────────────────────────────

    def _behaviour_antenna(self, c: RuntimeComponent):
        p_obj = c.value.get("power", {})
        fr_obj = c.value.get("frequency", {})

        # Frequency: random within rated range
        f_min = _v(fr_obj, "min", 100.0)
        f_max = _v(fr_obj, "max", 900.0)
        if f_max > f_min:
            _update_field(c, "frequency", random.uniform(f_min, f_max))

        # Current based on active connections
        active_count = self._conn_graph.active_connection_count(c.name)
        i_max = _v(p_obj, "max", 10.0)
        new_i = behaviors.antenna_current(active_count, i_max)

        # P = V * I; use voltage if available
        v_obj = c.value.get("voltage", {})
        voltage = _v(v_obj, "value", 220.0)
        new_p = voltage * new_i
        _update_field(c, "power", new_p)

    # ── Server ────────────────────────────────────────────────────────

    def _behaviour_server(self, c: RuntimeComponent, t_surr: float):
        t_obj = c.value.get("temperature", {})
        p_obj = c.value.get("power", {})

        t_prev = _v(t_obj, "value", 20.0)
        p_req = _v(p_obj, "value", 0.0)
        p_max = _v(p_obj, "max", 100.0)
        p_min = _v(p_obj, "min", 0.0)
        t_max = _v(t_obj, "max", 80.0)
        t_min_t = _v(t_obj, "min", 0.0)

        new_t = behaviors.server_temperature(
            t_prev, t_surr, p_req, p_max, p_min, t_max, t_min_t
        )
        _update_field(c, "temperature", new_t)

    # ── Alarm ─────────────────────────────────────────────────────────

    def _behaviour_alarm(self, c: RuntimeComponent):
        p_obj = c.value.get("power", {})  # noqa: F841
        v_obj = c.value.get("voltage", {})
        voltage = _v(v_obj, "value", 220.0)
        new_i = behaviors.alarm_current(c.status)
        new_p = voltage * new_i
        _update_field(c, "power", new_p)

    # ── Air conditioner ───────────────────────────────────────────────

    def _behaviour_air_conditioner(
        self,
        c: RuntimeComponent,
        t_surr: float,
        base_comps: dict[str, RuntimeComponent],
    ):
        t_obj = c.value.get("temperature", {})  # output temperature
        p_obj = c.value.get("power", {})
        v_obj = c.value.get("voltage", {})

        t_out_prev = _v(t_obj, "value", 20.0)
        t_target = _v(c.value.get("target_temperature", {}), "value", 20.0)
        t_max = _v(t_obj, "max", 40.0)
        t_min_t = _v(t_obj, "min", 0.0)

        # Output temperature update
        new_t_out = behaviors.ac_output_temperature(t_out_prev, t_target)
        _update_field(c, "temperature", new_t_out)

        # Airflow requirement from connected vents
        vent_names = self._conn_graph.active_resource_targets(c.name)
        fr_required = sum(
            _v(base_comps[v].value.get("airflow", {}), "value", 0.0)
            for v in vent_names
            if v in base_comps
        )

        fr_obj = c.value.get("airflow", {})
        fr_max_ac = _v(fr_obj, "max", 1000.0)
        fr_curr = min(fr_max_ac, max(fr_required, _v(fr_obj, "value", 0.0)))
        _update_field(c, "airflow", fr_curr)
        fr_max_for_i = fr_max_ac if fr_max_ac > 0 else 1.0

        # Current and power
        i_max = _v(p_obj, "max", 5000.0)
        voltage = _v(v_obj, "value", 220.0)
        new_i = behaviors.ac_current_requirement(
            i_max, fr_curr, fr_max_for_i, new_t_out, t_surr, t_max, t_min_t
        )
        new_p = voltage * new_i
        _update_field(c, "power", new_p)

    # ── Vent ──────────────────────────────────────────────────────────

    def _behaviour_vent(self, c: RuntimeComponent):
        a_obj = c.value.get("airflow", {})
        p_obj = c.value.get("power", {})
        v_obj = c.value.get("voltage", {})

        a_curr = _v(a_obj, "value", 0.0)
        a_max = _v(a_obj, "max", 100.0)
        voltage = _v(v_obj, "value", 220.0)
        i_max = _v(p_obj, "max", 10.0)

        new_i = behaviors.vent_current(a_curr, a_max, i_max)
        new_p = voltage * new_i
        _update_field(c, "power", new_p)

    # ------------------------------------------------------------------
    # Step 11: Failure countdown (Phase 13)
    # ------------------------------------------------------------------

    def _evaluate_failure_countdowns(
        self,
        base_comps: dict[str, RuntimeComponent],
        eff_status: dict[str, str],
        dt: float,
    ):
        """
        For every leaf component: check all state fields against max_rating.
        If exceeded → compute toff → track time → trigger failure.
        Containers use corrective thermal actions instead (handled separately).
        """
        containers = self.CONTAINERS

        for c in base_comps.values():
            if c.status == "failure":
                continue
            if c.status == "inactive":
                continue

            is_container = c.type in containers
            # Iterate over a snapshot to avoid mutation-during-iteration errors
            # (we may add ft_key entries inside the loop)
            value_snapshot = list(c.value.items())
            for field_name, field_val in value_snapshot:
                # Skip internal tracking fields and scalars
                if field_name.startswith("failure_time"):
                    continue
                if not isinstance(field_val, dict):
                    continue
                if "max" not in field_val:
                    continue

                val = _v(field_val, "value", 0.0)
                max_rating = _v(field_val, "max", 0.0)

                ft_key = f"failure_time_{field_name}"

                if val <= max_rating:
                    # Reset countdown for this field
                    c.value[ft_key] = 0.0
                    continue

                # Determine tolerance: use a component-level tolerance if stored
                comp_tolerance = _v(c.value.get("tolerance", {}), "value", 5.0)
                max_tolerated = behaviors.get_max_tolerated_value(
                    max_rating, comp_tolerance, self.global_tolerance
                )

                toff = behaviors.calculate_failure_countdown(
                    val, max_rating, max_tolerated
                )

                c.value.setdefault(ft_key, 0.0)

                if toff <= 0.0 or float(c.value[ft_key]) >= toff:
                    if not is_container:
                        c.status = "failure"
                    # Container thermal corrective action handled in _update_container_temperatures
                else:
                    c.value[ft_key] = float(c.value[ft_key]) + dt

    # ------------------------------------------------------------------
    # Step 12: Backup logic (Phase 12)
    # ------------------------------------------------------------------

    def _apply_backup_logic(
        self,
        base_comps: dict[str, RuntimeComponent],
        eff_status: dict[str, str],
    ):
        """
        Backup activation rules (Phase 12):
        - A backup stays inactive until all components it backs up are inactive/failure.
        - A backup is auto-activated only if its inactive state was NOT explicitly
          imposed by a scene event.
        - When primaries recover, backup returns to inactive (unless scene imposed active).
        """
        for c in base_comps.values():
            if not c.is_backup:
                continue
            if c.name in self._explicit_inactive:
                continue  # scene explicitly set this to inactive; do not override

            # Get the list of components this backup is for (from hierarchy)
            backed_up_names: list[str] = []
            if self.hierarchy and c.name in self.hierarchy.nodes:
                backed_up_names = self.hierarchy.nodes[c.name].backup_for

            if not backed_up_names:
                # Fallback: find same-type non-backup components (legacy behaviour)
                backed_up_names = [
                    name
                    for name, comp in base_comps.items()
                    if comp.type == c.type and not comp.is_backup
                ]

            if not backed_up_names:
                continue

            all_down = all(
                eff_status.get(n, "active") in ("inactive", "failure")
                for n in backed_up_names
                if n in base_comps
            )

            if all_down:
                c.status = "active"
            else:
                # Only deactivate if not explicitly set active by scene
                if c.status == "active":
                    c.status = "inactive"

    # ------------------------------------------------------------------
    # Step 13: Container thermal state (Phase 15.10-15.11)
    # ------------------------------------------------------------------

    def _update_container_temperatures(
        self,
        base_comps: dict[str, RuntimeComponent],
        external: ExternalModel,
    ):
        """
        Update temperature for all container-type components using the spec formula.
        Also runs thermal corrective logic (vents → AC target) when overheating.
        Processes bottom-up (leaves first) so parent temperatures are accurate.
        """
        containers = self.CONTAINERS

        # Build bottom-up processing order
        if self.hierarchy:
            order = self._bottom_up_order(base_comps, containers)
        else:
            order = [name for name, c in base_comps.items() if c.type in containers]

        for name in order:
            if name not in base_comps:
                continue
            c = base_comps[name]
            if c.type not in containers:
                continue

            t_obj = c.value.get("temperature", {})
            t_prev = _v(t_obj, "value", 20.0)
            t_max = _v(t_obj, "max", 30.0)

            # Surrounding temperature
            if c.type == "station":
                t_surr = behaviors.station_surrounding_temperature(
                    external.weather.temperature
                )
            else:
                t_surr = self._surrounding_temperature(name, base_comps, external)

            # Gather child temperatures
            child_temps: list[float] = []
            if self.hierarchy:
                for child_name in self.hierarchy.direct_children(name):
                    if child_name in base_comps:
                        child_t = base_comps[child_name].value.get("temperature", {})
                        child_temps.append(_v(child_t, "value", t_prev))

            # Gather AC vent data for connected vents
            ac_vent_data: list[dict[str, float]] = []
            # Find vents that are direct children or descendants
            if self.hierarchy:
                desc_names = self.hierarchy.descendants(name)
            else:
                desc_names = []

            for desc_name in desc_names:
                if desc_name not in base_comps:
                    continue
                desc = base_comps[desc_name]
                if desc.type == "vent" and desc.status == "active":
                    a_obj = desc.value.get("airflow", {})
                    a_curr = _v(a_obj, "value", 0.0)
                    a_max = _v(a_obj, "max", 100.0)
                    # Find associated AC (AC → vent resource connection)
                    ac_sources = self._conn_graph.active_resource_sources(desc_name)
                    for ac_name in ac_sources:
                        if (
                            ac_name in base_comps
                            and base_comps[ac_name].type == "air_conditioner"
                        ):
                            ac_t_obj = base_comps[ac_name].value.get("temperature", {})
                            t_ac_out = _v(ac_t_obj, "value", 20.0)
                            ac_vent_data.append(
                                {"t_out": t_ac_out, "a_curr": a_curr, "a_max": a_max}
                            )

            new_t = behaviors.container_temperature(
                t_prev, t_surr, child_temps, ac_vent_data
            )
            _update_field(c, "temperature", new_t)

            # Thermal corrective action when overheating (Phase 15.10)
            if new_t > t_max:
                self._container_thermal_correction(c, name, base_comps)

    def _container_thermal_correction(
        self,
        c: RuntimeComponent,
        name: str,
        base_comps: dict[str, RuntimeComponent],
    ):
        """
        Corrective sequence when container overheats:
        1. Increase connected vent airflow to max.
        2. If vents already maxed, decrease AC target by 2°C.
        3. Otherwise, attempt to decrease inner component temperatures.
        """
        if not self.hierarchy:
            return

        desc_names = self.hierarchy.descendants(name)

        # Step 1: Increase vent airflow
        vents_maxed = True
        for desc_name in desc_names:
            if desc_name not in base_comps:
                continue
            desc = base_comps[desc_name]
            if desc.type == "vent" and desc.status == "active":
                a_obj = desc.value.get("airflow", {})
                a_curr = _v(a_obj, "value", 0.0)
                a_max = _v(a_obj, "max", 100.0)
                if a_curr < a_max:
                    _update_field(desc, "airflow", a_max)
                    vents_maxed = False

        if vents_maxed:
            # Step 2: Decrease AC target temperature by 2°C
            for desc_name in desc_names:
                if desc_name not in base_comps:
                    continue
                desc = base_comps[desc_name]
                if desc.type == "air_conditioner" and desc.status == "active":
                    tt_obj = desc.value.get("target_temperature", {})
                    curr_target = _v(tt_obj, "value", 20.0)
                    new_target = curr_target - 2.0
                    _update_field(desc, "target_temperature", new_target)

    def _bottom_up_order(
        self,
        base_comps: dict[str, RuntimeComponent],
        containers: set[str],
    ) -> list[str]:
        """
        Return container names in bottom-up order (leaves first, root last).
        Uses a simple postorder DFS over the hierarchy.
        """
        result: list[str] = []
        visited: set[str] = set()

        def dfs(name: str):
            if name in visited:
                return
            visited.add(name)
            if self.hierarchy is not None and name in self.hierarchy.nodes:
                for child in self.hierarchy.nodes[name].children:
                    dfs(child)
            if name in base_comps and base_comps[name].type in containers:
                result.append(name)

        for name in base_comps:
            dfs(name)

        return result

    # ------------------------------------------------------------------
    # Telemetry snapshot
    # ------------------------------------------------------------------

    def _snapshot(
        self,
        base_comps: dict[str, RuntimeComponent],
        base_conns: dict[str, RuntimeConnection],
        external: ExternalModel,
    ) -> dict[str, Any]:
        return {
            "time": self.time,
            "persistence_time": time.time(),
            "source": "SIMULATION",
            "components": [copy.deepcopy(c) for c in base_comps.values()],
            "connections": [copy.deepcopy(c) for c in base_conns.values()],
            "external": copy.deepcopy(external),
        }
