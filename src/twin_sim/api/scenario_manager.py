"""
scenario_manager.py — Phase 17 (Scenario & Event API Manager)

Manages CRUD operations for simulation scenarios (.scene) and event definitions (.event).

Storage Layout:
- Scenarios are stored per-station: data/source/{station_id}/scenarios/{name}.scene
- Event Definitions are global: data/events/{name}.event

Scenario IDs are formatted as '{station_id}:{name}' to be globally unique for the /scenarios/{id} endpoints.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import shutil

from twin_sim.dsl.scene_parser import parse_scene_file, SceneParseError


class ScenarioManager:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        self.source_dir = self.data_dir / "source"
        self.events_dir = self.data_dir / "events"
        self.events_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # ID Helpers
    # ------------------------------------------------------------------

    def _parse_id(self, scenario_id: str) -> tuple[str, str]:
        """Split 'station:name' into (station_id, name)."""
        if ":" not in scenario_id:
            raise ValueError("Invalid scenario ID format. Expected 'station:name'")
        parts = scenario_id.split(":", 1)
        return parts[0], parts[1]

    def _get_scenario_path(self, station_id: str, name: str) -> Path:
        scenarios_dir = self.source_dir / station_id / "scenarios"
        scenarios_dir.mkdir(parents=True, exist_ok=True)
        return scenarios_dir / f"{name}.scene"

    # ------------------------------------------------------------------
    # Scenarios (CRUD)
    # ------------------------------------------------------------------

    def list_for_station(self, station_id: str) -> List[Dict[str, Any]]:
        scenarios_dir = self.source_dir / station_id / "scenarios"
        if not scenarios_dir.exists():
            return []
        
        results = []
        for p in scenarios_dir.glob("*.scene"):
            name = p.stem
            results.append({
                "id": f"{station_id}:{name}",
                "station_id": station_id,
                "name": name,
                "created_at": p.stat().st_ctime,
                "updated_at": p.stat().st_mtime
            })
        return sorted(results, key=lambda x: x["name"])

    def create(self, station_id: str, name: str, source: str = "") -> Dict[str, Any]:
        # Basic sanitisation
        name = name.strip().replace("/", "").replace("\\", "").replace(":", "")
        if not name:
            raise ValueError("Scenario name cannot be empty")
            
        path = self._get_scenario_path(station_id, name)
        if path.exists():
            raise ValueError(f"Scenario '{name}' already exists for station '{station_id}'")
            
        path.write_text(source, encoding="utf-8")
        return {
            "id": f"{station_id}:{name}",
            "station_id": station_id,
            "name": name
        }

    def get(self, scenario_id: str) -> Dict[str, Any]:
        station_id, name = self._parse_id(scenario_id)
        path = self._get_scenario_path(station_id, name)
        if not path.exists():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        return {
            "id": scenario_id,
            "station_id": station_id,
            "name": name,
            "created_at": path.stat().st_ctime,
            "updated_at": path.stat().st_mtime
        }

    def get_source(self, scenario_id: str) -> str:
        station_id, name = self._parse_id(scenario_id)
        path = self._get_scenario_path(station_id, name)
        if not path.exists():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
        return path.read_text(encoding="utf-8")

    def update_source(self, scenario_id: str, source: str) -> Dict[str, Any]:
        station_id, name = self._parse_id(scenario_id)
        path = self._get_scenario_path(station_id, name)
        if not path.exists():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        path.write_text(source, encoding="utf-8")
        return self.get(scenario_id)

    def duplicate(self, scenario_id: str) -> Dict[str, Any]:
        station_id, name = self._parse_id(scenario_id)
        path = self._get_scenario_path(station_id, name)
        if not path.exists():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        copy_name = f"{name}_copy"
        i = 1
        while self._get_scenario_path(station_id, copy_name).exists():
            copy_name = f"{name}_copy_{i}"
            i += 1
            
        new_path = self._get_scenario_path(station_id, copy_name)
        shutil.copy2(path, new_path)
        
        return self.get(f"{station_id}:{copy_name}")

    def delete(self, scenario_id: str) -> None:
        station_id, name = self._parse_id(scenario_id)
        path = self._get_scenario_path(station_id, name)
        if path.exists():
            path.unlink()

    def get_parsed_events(self, scenario_id: str) -> List[SceneEvent]:
        station_id, name = self._parse_id(scenario_id)
        path = self._get_scenario_path(station_id, name)
        if not path.exists():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
        return parse_scene_file(path)

    def validate(self, scenario_id: str) -> Dict[str, Any]:
        station_id, name = self._parse_id(scenario_id)
        path = self._get_scenario_path(station_id, name)
        if not path.exists():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        try:
            # We use the existing scene_parser which will raise SceneParseError if invalid
            events = parse_scene_file(path)
            return {
                "valid": True,
                "errors": [],
                "parsed_event_count": len(events)
            }
        except SceneParseError as e:
            return {
                "valid": False,
                "errors": [str(e)],
                "parsed_event_count": 0
            }
        except Exception as e:
             return {
                "valid": False,
                "errors": [f"Unexpected error: {str(e)}"],
                "parsed_event_count": 0
            }

    # ------------------------------------------------------------------
    # Event Definitions
    # ------------------------------------------------------------------

    def list_events(self) -> List[Dict[str, Any]]:
        results = []
        for p in self.events_dir.glob("*.event"):
            name = p.stem
            results.append({
                "name": name,
                "created_at": p.stat().st_ctime,
                "updated_at": p.stat().st_mtime
            })
        return sorted(results, key=lambda x: x["name"])

    def get_event(self, name: str) -> Dict[str, Any]:
        path = self.events_dir / f"{name}.event"
        if not path.exists():
            raise FileNotFoundError(f"Event definition '{name}' not found")
        
        return {
            "name": name,
            "source": path.read_text(encoding="utf-8"),
            "created_at": path.stat().st_ctime,
            "updated_at": path.stat().st_mtime
        }
