"""
station_loader.py — Phase 16

Loads a compiled station directory into a ready-to-run SimulationEngineCore.

A compiled station directory contains:
  hierarchy.json  — full hierarchy including type, parent, children, priority, backup
  connection.json — compiled connections (source/target/type/relation)
  spec.json       — per-component spec with ratings and dimensions
  component.json  — (optional) existing runtime state snapshot to restore from
  external.json   — (optional) initial external model state

Usage
-----
  from twin_sim.simulation.station_loader import StationLoader, LoadedStation

  station = StationLoader.load("data/compiled/Maitri")
  engine = station.build_engine(scenes=[...], global_tolerance=10.0)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.dsl.models import SceneEvent
from twin_sim.ingestion.loaders import (
    generate_runtime_components,
    generate_runtime_connections,
    load_external,
)
from twin_sim.ingestion.models import (
    ExternalModel,
    NetworkModel,
    RuntimeComponent,
    RuntimeConnection,
    SupplyModel,
    WeatherModel,
)
from twin_sim.simulation.engine_core import HierarchyGraph, SimulationEngineCore


# ---------------------------------------------------------------------------
# Default external model (no field data available yet)
# ---------------------------------------------------------------------------

_DEFAULT_EXTERNAL = ExternalModel(
    weather=WeatherModel(
        temperature=-30.0,
        wind_speed=10.0,
        humidity=60.0,
        o2_level=0.21,
        co2_level=0.00041,
        wind_direction=180.0,
        visibility=5000.0,
        pressure=1013.25,
        dew_frost_point=-35.0,
        irradiance=0.0,
    ),
    network=NetworkModel(
        bandwidth=5.0,
        mainland_connectivity=True,
        upload_window=False,
        upload_speed=2.0,
        download_speed=5.0,
    ),
    supplies=[],
)


class LoadedStation:
    """
    Holds a fully-validated set of station data and can produce a
    ``SimulationEngineCore`` ready for tick-based simulation.
    """

    def __init__(
        self,
        station_id: str,
        hierarchy_list: List[Dict[str, Any]],
        runtime_components: List[RuntimeComponent],
        runtime_connections: List[RuntimeConnection],
        external: ExternalModel,
    ):
        self.station_id = station_id
        self.hierarchy_list = hierarchy_list
        self.runtime_components = runtime_components
        self.runtime_connections = runtime_connections
        self.external = external

        # Build HierarchyGraph once — shared across engine instances
        self.hierarchy_graph = HierarchyGraph(hierarchy_list)

    def build_engine(
        self,
        scenes: Optional[List[SceneEvent]] = None,
        global_tolerance: float = 10.0,
    ) -> SimulationEngineCore:
        """
        Construct a fresh ``SimulationEngineCore`` from this station data.
        Each call produces an independent engine instance with its own state.
        """
        import copy

        # Deep-copy runtime state so multiple engines don't share mutable objects
        comps = copy.deepcopy(self.runtime_components)
        conns = copy.deepcopy(self.runtime_connections)
        ext = copy.deepcopy(self.external)

        state_manager = TimelineStateManager(
            components=comps,
            connections=conns,
            external=ext,
        )

        return SimulationEngineCore(
            state_manager=state_manager,
            scenes=list(scenes or []),
            hierarchy=self.hierarchy_graph,
            global_tolerance=global_tolerance,
        )

    def to_manifest(self) -> Dict[str, Any]:
        """Return a lightweight manifest describing this station."""
        return {
            "station_id": self.station_id,
            "component_count": len(self.runtime_components),
            "connection_count": len(self.runtime_connections),
        }


class StationLoader:
    """
    Reads compiled station artefacts from a directory and returns a
    ``LoadedStation`` ready for simulation.
    """

    @staticmethod
    def load(
        compiled_dir: str | Path,
        external_path: Optional[str | Path] = None,
    ) -> LoadedStation:
        """
        Load a compiled station from *compiled_dir*.

        Parameters
        ----------
        compiled_dir:
            Directory containing hierarchy.json, connection.json, spec.json
            and optionally component.json and external.json.
        external_path:
            Override path for external.json.  When None, the loader looks for
            external.json inside *compiled_dir*, then falls back to the
            built-in default model.
        """
        compiled_dir = Path(compiled_dir)

        hierarchy_path = compiled_dir / "hierarchy.json"
        connection_path = compiled_dir / "connection.json"
        spec_path = compiled_dir / "spec.json"

        if not hierarchy_path.exists():
            raise FileNotFoundError(f"hierarchy.json not found in {compiled_dir}")
        if not connection_path.exists():
            raise FileNotFoundError(f"connection.json not found in {compiled_dir}")
        if not spec_path.exists():
            raise FileNotFoundError(f"spec.json not found in {compiled_dir}")

        hierarchy_list: List[Dict[str, Any]] = _load_json(hierarchy_path)
        compiled_connections: List[Dict[str, Any]] = _load_json(connection_path)
        specs: List[Dict[str, Any]] = _load_json(spec_path)

        # Generate runtime models
        runtime_components = generate_runtime_components(hierarchy_list, specs)
        runtime_connections = generate_runtime_connections(compiled_connections)

        # External model: explicit path → compiled_dir/external.json → built-in default
        ext_file = Path(external_path) if external_path else compiled_dir / "external.json"
        if ext_file.exists():
            external = load_external(ext_file)
        else:
            external = _DEFAULT_EXTERNAL

        station_id = compiled_dir.name
        return LoadedStation(
            station_id=station_id,
            hierarchy_list=hierarchy_list,
            runtime_components=runtime_components,
            runtime_connections=runtime_connections,
            external=external,
        )

    @staticmethod
    def list_stations(compiled_root: str | Path) -> List[str]:
        """
        Return the names of all compiled stations found under *compiled_root*.
        A directory is considered a compiled station if it contains hierarchy.json.
        """
        compiled_root = Path(compiled_root)
        if not compiled_root.exists():
            return []
        return sorted(
            d.name
            for d in compiled_root.iterdir()
            if d.is_dir() and (d / "hierarchy.json").exists()
        )


def _load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
