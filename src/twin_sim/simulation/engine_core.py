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
import math
import random
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from twin_sim.dsl.models import SceneEvent
from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.ingestion.models import RuntimeComponent, RuntimeConnection, ExternalModel
import twin_sim.simulation.behaviors as behaviors


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


class HierarchyNode:
    """Lightweight in-memory representation of a hierarchy entry."""
    __slots__ = ("name", "type", "parent", "children", "priority",
                 "floor", "is_backup", "backup_for", "external_field", "tags")

    def __init__(self, entry: Dict[str, Any]):
        self.name: str = entry["name"]
        self.type: str = entry["type"]
        self.parent: Optional[str] = entry.get("parent")
        self.children: List[str] = entry.get("children", [])
        self.priority: int = entry.get("priority", 0)
        self.floor: int = entry.get("floor", 0)
        self.is_backup: bool = entry.get("is_backup", False)
        self.backup_for: List[str] = entry.get("backup", [])
        self.external_field: Optional[str] = entry.get("external_field")
        self.tags: List[str] = entry.get("tags", [])


class HierarchyGraph:
    """
    Provides ancestor/descendant queries over the hierarchy.
    Built once from hierarchy.json list.
    """

    def __init__(self, hierarchy_list: List[Dict[str, Any]]):
        self.nodes: Dict[str, HierarchyNode] = {
            e["name"]: HierarchyNode(e) for e in hierarchy_list
        }

    def ancestors(self, name: str) -> List[str]:
        """Returns list of ancestor names from parent → root."""
        result = []
        current = self.nodes.get(name)
        while current and current.parent:
            result.append(current.parent)
            current = self.nodes.get(current.parent)
        return result

    def descendants(self, name: str) -> List[str]:
        """Returns all descendant names (BFS)."""
        result: List[str] = []
        queue = list(self.nodes[name].children) if name in self.nodes else []
        while queue:
            child = queue.pop(0)
            result.append(child)
            if child in self.nodes:
                queue.extend(self.nodes[child].children)
        return result

    def direct_children(self, name: str) -> List[str]:
        return self.nodes[name].children if name in self.nodes else []

    def parent_of(self, name: str) -> Optional[str]:
        node = self.nodes.get(name)
        return node.parent if node else None

    def is_ancestor_inactive_or_failed(self, name: str, component_statuses: Dict[str, str]) -> bool:
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

    def __init__(self, connections: List[RuntimeConnection]):
        # Index by (source, type, target) for O(1) lookup
        self._conns: List[RuntimeConnection] = list(connections)

    def update(self, connections: List[RuntimeConnection]):
        self._conns = list(connections)

    def active_power_sources(self, target_name: str) -> List[str]:
        """Components that send power to `target_name` via an active power connection."""
        return [
            c.source for c in self._conns
            if c.target == target_name and c.type == "power" and c.status == "active"
        ]

    def active_power_targets(self, source_name: str) -> List[str]:
        """Components receiving power from `source_name` via active power connections."""
        return [
            c.target for c in self._conns
            if c.source == source_name and c.type == "power" and c.status == "active"
        ]

    def active_resource_sources(self, target_name: str) -> List[str]:
        """Components that send resources (flowrate) to `target_name` via active resource connections."""
        return [
            c.source for c in self._conns
            if c.target == target_name and c.type == "resource" and c.status == "active"
        ]

    def active_resource_targets(self, source_name: str) -> List[str]:
        return [
            c.target for c in self._conns
            if c.source == source_name and c.type == "resource" and c.status == "active"
        ]

    def active_signal_sources(self, target_name: str) -> List[str]:
        return [
            c.source for c in self._conns
            if c.target == target_name and c.type == "signal" and c.status == "active"
        ]

    def active_connections_for_node(self, node_name: str) -> List[RuntimeConnection]:
        """All active connections where node is source or target."""
        return [
            c for c in self._conns
            if (c.source == node_name or c.target == node_name) and c.status == "active"
        ]

    def active_connection_count(self, node_name: str) -> int:
        return len(self.active_connections_for_node(node_name))

    def connections_of_type(self, conn_type: str) -> List[RuntimeConnection]:
        return [c for c in self._conns if c.type == conn_type]

    def get_connection(self, source: str, conn_type: str, target: str) -> Optional[RuntimeConnection]:
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

    CONTAINERS = {"campus", "station", "block", "floor", "system", "generic"}

    def __init__(
        self,
        state_manager: TimelineStateManager,
        scenes: List[SceneEvent],
        hierarchy: Optional[HierarchyGraph] = None,
        global_tolerance: float = 10.0,
    ):
        self.state = state_manager
        # Sort by (at, stable source order) — scene order preserved within same at
        self.scenes: List[SceneEvent] = sorted(scenes, key=lambda s: s.at)
        self._scene_index = 0  # pointer into sorted scenes list

        self.time: float = 0.0  # simulation hours
        self.hierarchy: Optional[HierarchyGraph] = hierarchy
        self.global_tolerance: float = global_tolerance

        # Track which components had their inactive state explicitly imposed by
        # a scene event; these must not be auto-activated.
        self._explicit_inactive: Set[str] = set()

        # Telemetry list (one entry per tick when publishing is enabled)
        self.telemetry: List[Dict[str, Any]] = []
        self.telemetry_publishing: bool = False

        # Build connection graph from initial base connections
        self._conn_graph = ConnectionGraph(
            list(state_manager.base_connections.values())
        )

        # Last-valid data cache for missing data extrapolation (field → value)
        self._last_valid: Dict[str, Dict[str, Any]] = {}  # comp_name → {field: value}

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

        # Build effective status map (considers event layers) for hierarchical checks
        eff = self.state.get_effective_state_dict()
        eff_status: Dict[str, str] = {c.name: c.status for c in eff["components"]}

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

        # ── Recalculate effective state with new physics base ─────────────
        self.state.recalculate_effective_state()

        # ── Steps 17-18: Telemetry ───────────────────────────────────────
        if self.telemetry_publishing:
            self.telemetry.append(self._snapshot(base_comps, base_conns, external))

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
        eff_comps = {c.name: c for c in self.state.get_effective_state_dict()["components"]}
        eff_conns = list(self.state.effective_connections.values())
        ext = self.state.base_external

        for scene in list(self.scenes):
            if scene.at > self.time:
                break  # list is sorted; no more events at this time

            self.scenes.remove(scene)

            # Determine targets
            targets = self._resolve_scene_targets(scene, eff_comps, eff_conns, ext)

            for target, node_key_hint in targets:
                # Track explicitly imposed inactive
                if scene.payload.get("status") == "inactive":
                    if isinstance(target, RuntimeComponent):
                        self._explicit_inactive.add(target.name)

                is_inf = scene.duration == float("inf")
                for field, value in scene.payload.items():
                    field_path = field if field in ("status",) else f"value.{field}"
                    if isinstance(target, RuntimeComponent) and field == "status":
                        field_path = "status"
                    elif isinstance(target, RuntimeConnection) and field == "status":
                        field_path = "status"

                    if is_inf:
                        self.state.apply_infinite_event(target, field_path, value)
                    else:
                        self.state.add_finite_event(
                            scene.event_ref, 0,
                            scene.at, scene.at + scene.duration,
                            target, field_path, value
                        )

    def _resolve_scene_targets(
        self,
        scene: SceneEvent,
        eff_comps: Dict[str, RuntimeComponent],
        eff_conns: List[RuntimeConnection],
        ext: ExternalModel,
    ) -> List[Tuple[Any, str]]:
        """Return list of (target_object, node_key_hint) for a scene event."""
        selector = scene.selector or ""
        targets = []

        if not selector:
            return targets

        # @external.network / @external.weather / @external.supplies
        if selector == "@external.network" or selector == "@network":
            targets.append((ext.network, "external"))
        elif selector == "@external.weather" or selector == "@weather":
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
            sel_val = selector[1:]  # strip leading @

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
        base_comps: Dict[str, RuntimeComponent],
        base_conns: Dict[str, RuntimeConnection],
        eff_status: Dict[str, str],
    ):
        """
        If a connection's source or target component is failed/inactive (or has
        an ancestor that is), mark the connection as inactive in base state.
        Only downgrade; do not upgrade connections that were set to failure by events.
        """
        for key, conn in base_conns.items():
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

    def _component_is_effectively_down(self, name: str, eff_status: Dict[str, str]) -> bool:
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
        base_comps: Dict[str, RuntimeComponent],
        base_conns: Dict[str, RuntimeConnection],
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
        base_comps: Dict[str, RuntimeComponent],
        external: ExternalModel,
    ):
        """
        Phase 14: Multi-supply power/resource allocation.
        For each generator (power source) find its consumers via active power
        connections and distribute demand proportionally based on current load.

        Also handles pump → flowrate distribution.
        """
        # --- Power allocation from generators ---
        generators = [c for c in base_comps.values() if c.type == "generator" and c.status == "active"]
        for gen in generators:
            consumer_names = self._conn_graph.active_power_targets(gen.name)
            if not consumer_names:
                continue

            # Total demanded power
            total_demanded = sum(
                _v(base_comps[n].value.get("power", {}), "value", 0.0)
                for n in consumer_names if n in base_comps
            )

            p_max = _v(base_comps[gen.name].value.get("power", {}), "max", 0.0)
            p_curr = _v(base_comps[gen.name].value.get("power", {}), "value", 0.0)

            if total_demanded <= 0:
                continue

            if total_demanded <= p_max:
                # Generator can satisfy all demand; output = total demanded
                p_obj = base_comps[gen.name].value.get("power", {})
                _set_v(p_obj, "value", total_demanded)
            else:
                # Generator cannot satisfy full demand
                ratio = p_max / total_demanded if total_demanded > 0 else 0.0

                if ratio >= 0.35:
                    # Proportional allocation: each consumer gets x * requested
                    p_obj = base_comps[gen.name].value.get("power", {})
                    _set_v(p_obj, "value", p_max)
                    for n in consumer_names:
                        if n in base_comps:
                            c_p_obj = base_comps[n].value.get("power", {})
                            c_demand = _v(c_p_obj, "value", 0.0)
                            _set_v(c_p_obj, "value", ratio * c_demand)
                else:
                    # Below 35%: shut down lowest-priority consumer
                    # Try activating an inactive component first
                    activated = self._try_activate_for_power(base_comps, gen, consumer_names, total_demanded, p_max)
                    if not activated:
                        self._deactivate_lowest_priority(base_comps, consumer_names)

        # --- Flowrate allocation from tanks/pumps ---
        tanks = [c for c in base_comps.values() if c.type == "tank" and c.status == "active"]
        for tank in tanks:
            pump_names = self._conn_graph.active_resource_targets(tank.name)
            if not pump_names:
                continue

            total_fr_requested = sum(
                _v(base_comps[p].value.get("flowrate", {}), "value", 0.0)
                for p in pump_names if p in base_comps
            )

            v_obj = base_comps[tank.name].value.get("volume", {})
            v_curr = _v(v_obj, "value", 100.0)

            if v_curr <= 0:
                # Tank empty — deactivate connected pumps
                for p_name in pump_names:
                    if p_name in base_comps:
                        # Only deactivate if no other non-empty tank supplies them
                        other_tanks = [
                            t for t in tanks
                            if t.name != tank.name and p_name in self._conn_graph.active_resource_targets(t.name)
                        ]
                        other_nonempty = any(
                            _v(base_comps[t.name].value.get("volume", {}), "value", 0.0) > 0
                            for t in other_tanks
                        )
                        if not other_nonempty:
                            base_comps[p_name].status = "inactive"

    def _try_activate_for_power(
        self,
        base_comps: Dict[str, RuntimeComponent],
        gen: RuntimeComponent,
        consumer_names: List[str],
        total_demanded: float,
        p_max: float,
    ) -> bool:
        """Try to activate an inactive component to restore ≥35% supply."""
        inactive_consumers = [
            n for n in consumer_names
            if n in base_comps and base_comps[n].status == "inactive"
               and n not in self._explicit_inactive
        ]
        if not inactive_consumers:
            return False

        # Sort by priority (ascending = higher priority first)
        if self.hierarchy:
            inactive_consumers.sort(
                key=lambda n: self.hierarchy.nodes.get(n, HierarchyNode({"name": n, "type": "generic"})).priority
            )

        for candidate in inactive_consumers:
            # Activate and see if ratio improves to ≥35%
            candidate_demand = _v(base_comps[candidate].value.get("power", {}), "value", 0.0)
            new_total = total_demanded + candidate_demand
            if p_max / new_total >= 0.35:
                base_comps[candidate].status = "active"
                return True

        return False

    def _deactivate_lowest_priority(
        self,
        base_comps: Dict[str, RuntimeComponent],
        consumer_names: List[str],
    ):
        """Deactivate the lowest-priority active consumer."""
        active_consumers = [
            n for n in consumer_names
            if n in base_comps and base_comps[n].status == "active"
        ]
        if not active_consumers:
            return

        if self.hierarchy:
            # Highest priority number = lowest priority
            active_consumers.sort(
                key=lambda n: -(self.hierarchy.nodes.get(n, HierarchyNode({"name": n, "type": "generic"})).priority)
            )
        # Deactivate the first (lowest priority)
        base_comps[active_consumers[0]].status = "inactive"

    # ------------------------------------------------------------------
    # Step 9: Controller adjustments (Phase 12)
    # ------------------------------------------------------------------

    def _apply_controller_adjustments(self, base_comps: Dict[str, RuntimeComponent]):
        """
        Components connected to an active controller via signal connections
        may have their operational values adjusted.
        Simplified: if a controller is active and connected via signal to a generator,
        set generator power to full capacity (controller manages demand).
        """
        controllers = [c for c in base_comps.values() if c.type == "controller" and c.status == "active"]
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
                            _set_v(p_obj, "value", p_max)

    # ------------------------------------------------------------------
    # Step 10: Component-specific behaviours (Phase 15)
    # ------------------------------------------------------------------

    def _run_component_behaviours(
        self,
        base_comps: Dict[str, RuntimeComponent],
        base_conns: Dict[str, RuntimeConnection],
        external: ExternalModel,
    ):
        """Run per-component-type physics for every non-skipped component."""
        eff_status: Dict[str, str] = {c.name: c.status for c in base_comps.values()}

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
        base_comps: Dict[str, RuntimeComponent],
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
        base_comps: Dict[str, RuntimeComponent],
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

        # Required flowrate proportional to power
        fr_max_rated = _v(fr_obj, "max", 100.0)
        if p_max > 0:
            fr_required = fr_max_rated * (p_curr / p_max)
        else:
            fr_required = 0.0
        _set_v(fr_obj if isinstance(fr_obj, dict) else c.value.setdefault("flowrate", {}), "value", fr_required)

        # Startup deadlock prevention: generator inactive + pump inactive → start at p_min
        if p_curr <= 0:
            pump_sources = [
                n for n in self._conn_graph.active_resource_sources(c.name)
                if n in base_comps and base_comps[n].type == "pump"
            ]
            if pump_sources and all(base_comps[p].status == "inactive" for p in pump_sources):
                p_curr = p_min
                _set_v(p_obj, "value", p_curr)

        new_t = behaviors.generator_temperature(t_prev, t_surr, p_curr, p_max, p_min, t_max, t_min_t)
        _set_v(t_obj if isinstance(t_obj, dict) else c.value.setdefault("temperature", {}), "value", new_t)

    # ── Pump ───────────────────────────────────────────────────────────

    def _behaviour_pump(
        self,
        c: RuntimeComponent,
        t_surr: float,
        base_comps: Dict[str, RuntimeComponent],
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
            for n in consumers if n in base_comps
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

        _set_v(fr_obj if isinstance(fr_obj, dict) else c.value.setdefault("flowrate", {}), "value", fr_curr)

        # Temperature uses generator model with fr term
        new_t = behaviors.pump_temperature(t_prev, t_surr, fr_curr, fr_max, fr_min, t_max, t_min_t)
        _set_v(t_obj if isinstance(t_obj, dict) else c.value.setdefault("temperature", {}), "value", new_t)

        # Power proportional to flowrate
        p_max_val = _v(p_obj, "max", 1000.0)
        if fr_max > 0:
            new_p = p_max_val * (fr_curr / fr_max)
        else:
            new_p = 0.0
        _set_v(p_obj if isinstance(p_obj, dict) else c.value.setdefault("power", {}), "value", new_p)

    # ── Solar panel ────────────────────────────────────────────────────

    def _behaviour_solar_panel(self, c: RuntimeComponent, external: ExternalModel):
        p_obj = c.value.get("power", {})
        p_max = _v(p_obj, "max", 100.0)
        # Use external irradiance if available; fall back to 0 (no irradiance data)
        i_curr = getattr(external.weather, "irradiance", 0.0)
        i_max = _v(c.value.get("irradiance", {}), "max", 1000.0)
        new_p = behaviors.solar_panel_power(p_max, i_curr, i_max)
        _set_v(p_obj if isinstance(p_obj, dict) else c.value.setdefault("power", {}), "value", new_p)

    # ── Tank ───────────────────────────────────────────────────────────

    def _behaviour_tank(self, c: RuntimeComponent, base_comps: Dict[str, RuntimeComponent]):
        v_obj = c.value.get("volume", {})
        v_prev = _v(v_obj, "value", 100.0)
        dt = 15.0 / 3600.0

        # Sum flowrate from all connected active pumps draining this tank
        pumps = self._conn_graph.active_resource_targets(c.name)
        total_fr = sum(
            _v(base_comps[p].value.get("flowrate", {}), "value", 0.0)
            for p in pumps if p in base_comps
        )

        new_v = behaviors.tank_volume(v_prev, total_fr, dt)
        _set_v(v_obj if isinstance(v_obj, dict) else c.value.setdefault("volume", {}), "value", new_v)

    # ── Antenna ────────────────────────────────────────────────────────

    def _behaviour_antenna(self, c: RuntimeComponent):
        p_obj = c.value.get("power", {})
        fr_obj = c.value.get("frequency", {})

        # Frequency: random within rated range
        f_min = _v(fr_obj, "min", 100.0)
        f_max = _v(fr_obj, "max", 900.0)
        if f_max > f_min:
            _set_v(fr_obj if isinstance(fr_obj, dict) else c.value.setdefault("frequency", {}),
                   "value", random.uniform(f_min, f_max))

        # Current based on active connections
        active_count = self._conn_graph.active_connection_count(c.name)
        i_max = _v(p_obj, "max", 10.0)
        new_i = behaviors.antenna_current(active_count, i_max)

        # P = V * I; use voltage if available
        v_obj = c.value.get("voltage", {})
        voltage = _v(v_obj, "value", 220.0)
        new_p = voltage * new_i
        _set_v(p_obj if isinstance(p_obj, dict) else c.value.setdefault("power", {}), "value", new_p)

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

        new_t = behaviors.server_temperature(t_prev, t_surr, p_req, p_max, p_min, t_max, t_min_t)
        _set_v(t_obj if isinstance(t_obj, dict) else c.value.setdefault("temperature", {}), "value", new_t)

    # ── Alarm ─────────────────────────────────────────────────────────

    def _behaviour_alarm(self, c: RuntimeComponent):
        p_obj = c.value.get("power", {})
        v_obj = c.value.get("voltage", {})
        voltage = _v(v_obj, "value", 220.0)
        new_i = behaviors.alarm_current(c.status)
        new_p = voltage * new_i
        _set_v(p_obj if isinstance(p_obj, dict) else c.value.setdefault("power", {}), "value", new_p)

    # ── Air conditioner ───────────────────────────────────────────────

    def _behaviour_air_conditioner(
        self,
        c: RuntimeComponent,
        t_surr: float,
        base_comps: Dict[str, RuntimeComponent],
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
        _set_v(t_obj if isinstance(t_obj, dict) else c.value.setdefault("temperature", {}), "value", new_t_out)

        # Airflow requirement from connected vents
        vent_names = self._conn_graph.active_resource_targets(c.name)
        fr_required = sum(
            _v(base_comps[v].value.get("airflow", {}), "value", 0.0)
            for v in vent_names if v in base_comps
        )

        fr_obj = c.value.get("airflow", {})
        fr_max_ac = _v(fr_obj, "max", 1000.0)
        fr_curr = min(fr_max_ac, max(fr_required, _v(fr_obj, "value", 0.0)))
        _set_v(fr_obj if isinstance(fr_obj, dict) else c.value.setdefault("airflow", {}), "value", fr_curr)
        fr_max_for_i = fr_max_ac if fr_max_ac > 0 else 1.0

        # Current and power
        i_max = _v(p_obj, "max", 5000.0)
        voltage = _v(v_obj, "value", 220.0)
        new_i = behaviors.ac_current_requirement(i_max, fr_curr, fr_max_for_i, new_t_out, t_surr, t_max, t_min_t)
        new_p = voltage * new_i
        _set_v(p_obj if isinstance(p_obj, dict) else c.value.setdefault("power", {}), "value", new_p)

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
        _set_v(p_obj if isinstance(p_obj, dict) else c.value.setdefault("power", {}), "value", new_p)

    # ------------------------------------------------------------------
    # Step 11: Failure countdown (Phase 13)
    # ------------------------------------------------------------------

    def _evaluate_failure_countdowns(
        self,
        base_comps: Dict[str, RuntimeComponent],
        eff_status: Dict[str, str],
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
                max_rating = _v(field_val, "max", float("inf"))

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

                toff = behaviors.calculate_failure_countdown(val, max_rating, max_tolerated)

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
        base_comps: Dict[str, RuntimeComponent],
        eff_status: Dict[str, str],
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
            backed_up_names: List[str] = []
            if self.hierarchy and c.name in self.hierarchy.nodes:
                backed_up_names = self.hierarchy.nodes[c.name].backup_for

            if not backed_up_names:
                # Fallback: find same-type non-backup components (legacy behaviour)
                backed_up_names = [
                    name for name, comp in base_comps.items()
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
        base_comps: Dict[str, RuntimeComponent],
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
                t_surr = behaviors.station_surrounding_temperature(external.weather.temperature)
            else:
                t_surr = self._surrounding_temperature(name, base_comps, external)

            # Gather child temperatures
            child_temps: List[float] = []
            if self.hierarchy:
                for child_name in self.hierarchy.direct_children(name):
                    if child_name in base_comps:
                        child_t = base_comps[child_name].value.get("temperature", {})
                        child_temps.append(_v(child_t, "value", t_prev))

            # Gather AC vent data for connected vents
            ac_vent_data: List[Dict[str, float]] = []
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
                        if ac_name in base_comps and base_comps[ac_name].type == "air_conditioner":
                            ac_t_obj = base_comps[ac_name].value.get("temperature", {})
                            t_ac_out = _v(ac_t_obj, "value", 20.0)
                            ac_vent_data.append({"t_out": t_ac_out, "a_curr": a_curr, "a_max": a_max})

            new_t = behaviors.container_temperature(t_prev, t_surr, child_temps, ac_vent_data)
            _set_v(t_obj if isinstance(t_obj, dict) else c.value.setdefault("temperature", {}), "value", new_t)

            # Thermal corrective action when overheating (Phase 15.10)
            if new_t > t_max:
                self._container_thermal_correction(c, name, base_comps)

    def _container_thermal_correction(
        self,
        c: RuntimeComponent,
        name: str,
        base_comps: Dict[str, RuntimeComponent],
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
                    _set_v(a_obj if isinstance(a_obj, dict) else desc.value.setdefault("airflow", {}), "value", a_max)
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
                    _set_v(
                        tt_obj if isinstance(tt_obj, dict) else desc.value.setdefault("target_temperature", {}),
                        "value",
                        new_target
                    )

    def _bottom_up_order(
        self,
        base_comps: Dict[str, RuntimeComponent],
        containers: Set[str],
    ) -> List[str]:
        """
        Return container names in bottom-up order (leaves first, root last).
        Uses a simple postorder DFS over the hierarchy.
        """
        result: List[str] = []
        visited: Set[str] = set()

        def dfs(name: str):
            if name in visited:
                return
            visited.add(name)
            if name in self.hierarchy.nodes:
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
        base_comps: Dict[str, RuntimeComponent],
        base_conns: Dict[str, RuntimeConnection],
        external: ExternalModel,
    ) -> Dict[str, Any]:
        return {
            "time": self.time,
            "persistence_time": time.time(),
            "source": "SIMULATION",
            "components": [copy.deepcopy(c) for c in base_comps.values()],
            "connections": [copy.deepcopy(c) for c in base_conns.values()],
            "external": copy.deepcopy(external),
        }
