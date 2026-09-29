"""
scenario_manager.py — Phase 17 (Scenario & Event API Manager)

Manages CRUD operations for simulation scenarios (.scene) and event definitions (.event).

Storage Layout:
- Scenarios are stored in DB.
- Event Definitions are stored in DB.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List
import uuid

from twin_sim.dsl.scene_parser import parse_scene_string, SceneParseError
from twin_sim.dsl.models import SceneEvent
from twin_sim.telemetry.database import TelemetryDatabase

class ScenarioManager:
    def __init__(self, db: TelemetryDatabase):
        self.db = db

    # ------------------------------------------------------------------
    # ID Helpers
    # ------------------------------------------------------------------

    def _parse_id(self, scenario_id: str) -> tuple[str, str]:
        """Split 'station:name' into (station_id, name)."""
        if ":" not in scenario_id:
            raise ValueError("Invalid scenario ID format. Expected 'station:name'")
        parts = scenario_id.split(":", 1)
        return parts[0], parts[1]

    # ------------------------------------------------------------------
    # Scenarios (CRUD)
    # ------------------------------------------------------------------

    def list_for_station(self, station_id: str) -> List[Dict[str, Any]]:
        cur = self.db.conn.execute("SELECT * FROM scenario_files WHERE LOWER(station_id) = LOWER(?)", (station_id,))
        results = []
        for row in cur.fetchall():
            results.append({
                "id": row["id"],
                "station_id": row["station_id"],
                "name": row["name"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })
        return sorted(results, key=lambda x: x["name"])

    def create(self, station_id: str, name: str, source: str = "") -> Dict[str, Any]:
        name = name.strip().replace("/", "").replace("\\", "").replace(":", "")
        if not name:
            raise ValueError("Scenario name cannot be empty")
            
        scenario_id = f"{station_id}:{name}"
        cur = self.db.conn.execute("SELECT id FROM scenario_files WHERE id = ?", (scenario_id,))
        if cur.fetchone():
            raise ValueError(f"Scenario '{name}' already exists for station '{station_id}'")
            
        now = time.time()
        self.db.conn.execute(
            "INSERT INTO scenario_files (id, station_id, name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (scenario_id, station_id, name, source, now, now)
        )
        self.db.conn.commit()
        return {
            "id": scenario_id,
            "station_id": station_id,
            "name": name
        }

    def get(self, scenario_id: str) -> Dict[str, Any]:
        cur = self.db.conn.execute("SELECT * FROM scenario_files WHERE id = ?", (scenario_id,))
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        return {
            "id": row["id"],
            "station_id": row["station_id"],
            "name": row["name"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }

    def get_source(self, scenario_id: str) -> str:
        cur = self.db.conn.execute("SELECT source FROM scenario_files WHERE id = ?", (scenario_id,))
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
        return row["source"]

    def update_source(self, scenario_id: str, source: str) -> Dict[str, Any]:
        cur = self.db.conn.execute("SELECT id FROM scenario_files WHERE id = ?", (scenario_id,))
        if not cur.fetchone():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        now = time.time()
        self.db.conn.execute("UPDATE scenario_files SET source = ?, updated_at = ? WHERE id = ?", (source, now, scenario_id))
        self.db.conn.commit()
        return self.get(scenario_id)

    def duplicate(self, scenario_id: str) -> Dict[str, Any]:
        cur = self.db.conn.execute("SELECT * FROM scenario_files WHERE id = ?", (scenario_id,))
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        station_id = row["station_id"]
        name = row["name"]
        source = row["source"]
        
        copy_name = f"{name}_copy"
        i = 1
        while True:
            cur = self.db.conn.execute("SELECT id FROM scenario_files WHERE id = ?", (f"{station_id}:{copy_name}",))
            if not cur.fetchone():
                break
            copy_name = f"{name}_copy_{i}"
            i += 1
            
        return self.create(station_id, copy_name, source)

    def delete(self, scenario_id: str) -> None:
        self.db.conn.execute("DELETE FROM scenario_files WHERE id = ?", (scenario_id,))
        self.db.conn.commit()

    def get_parsed_events(self, scenario_id: str) -> List[SceneEvent]:
        source = self.get_source(scenario_id)
        events = parse_scene_string(source)
        
        # Merge event definitions for inline events
        for ev in events:
            if not ev.payload:  # empty dict
                try:
                    event_def = self.get_event(f"{scenario_id.split(':')[0]}:{ev.event_ref}")
                    from twin_sim.dsl.event_parser import parse_event_file
                    import tempfile
                    import os
                    # A bit hacky, but parse_event_file needs a Path. We can parse string directly if we write a helper, or just use a temp file.
                    # Alternatively, write a parse_event_string function. Let's just create a temp file.
                    fd, path = tempfile.mkstemp(suffix=".event")
                    with os.fdopen(fd, "w") as f:
                        f.write(event_def["source"])
                    from pathlib import Path
                    parsed_def = parse_event_file(Path(path))
                    os.remove(path)
                    ev.payload = parsed_def.set_fixed
                    if not ev.selector:
                        ev.selector = f"@{parsed_def.target}"
                except FileNotFoundError:
                    pass
        return events

    def validate(self, scenario_id: str) -> Dict[str, Any]:
        try:
            source = self.get_source(scenario_id)
            events = parse_scene_string(source)
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

    def list_events(self, station_id: str) -> List[Dict[str, Any]]:
        cur = self.db.conn.execute("SELECT * FROM event_files WHERE LOWER(station_id) = LOWER(?)", (station_id,))
        results = []
        for row in cur.fetchall():
            results.append({
                "id": row["id"],
                "station_id": row["station_id"],
                "name": row["name"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })
        return sorted(results, key=lambda x: x["name"])

    def get_event(self, event_id: str) -> Dict[str, Any]:
        cur = self.db.conn.execute("SELECT * FROM event_files WHERE id = ?", (event_id,))
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Event definition '{event_id}' not found")
        
        return {
            "id": row["id"],
            "station_id": row["station_id"],
            "name": row["name"],
            "source": row["source"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }

    def create_event(self, station_id: str, name: str, source: str = "") -> Dict[str, Any]:
        name = name.strip().replace("/", "").replace("\\", "").replace(":", "")
        if not name:
            raise ValueError("Event name cannot be empty")
            
        event_id = f"{station_id}:{name}"
        cur = self.db.conn.execute("SELECT id FROM event_files WHERE id = ?", (event_id,))
        if cur.fetchone():
            raise ValueError(f"Event '{name}' already exists for station '{station_id}'")
            
        now = time.time()
        self.db.conn.execute(
            "INSERT INTO event_files (id, station_id, name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (event_id, station_id, name, source, now, now)
        )
        self.db.conn.commit()
        return self.get_event(event_id)
        
    def update_event(self, event_id: str, source: str) -> Dict[str, Any]:
        cur = self.db.conn.execute("SELECT id FROM event_files WHERE id = ?", (event_id,))
        if not cur.fetchone():
            raise FileNotFoundError(f"Event definition '{event_id}' not found")
            
        now = time.time()
        self.db.conn.execute("UPDATE event_files SET source = ?, updated_at = ? WHERE id = ?", (source, now, event_id))
        self.db.conn.commit()
        return self.get_event(event_id)

    def delete_event(self, event_id: str) -> None:
        cur = self.db.conn.execute("SELECT id FROM event_files WHERE id = ?", (event_id,))
        if not cur.fetchone():
            raise FileNotFoundError(f"Event definition '{event_id}' not found")
            
        self.db.conn.execute("DELETE FROM event_files WHERE id = ?", (event_id,))
        self.db.conn.commit()
