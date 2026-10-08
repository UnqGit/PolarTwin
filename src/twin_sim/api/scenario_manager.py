"""
scenario_manager.py — Phase 17 (Scenario & Event API Manager)

Manages CRUD operations for simulation scenarios (.scene) and event definitions (.event).

Storage Layout:
- Scenarios are stored in DB.
- Event Definitions are stored in DB.
"""

from __future__ import annotations

import time
from typing import Any

from twin_sim.dsl.event_parser import parse_event_string
from twin_sim.dsl.models import SceneEvent
from twin_sim.dsl.scene_parser import SceneParseError, parse_scene_string
from twin_sim.telemetry.database import TelemetryDatabase


class ScenarioManager:
    def __init__(self, db: TelemetryDatabase):
        self.db = db

    # ------------------------------------------------------------------
    # ID Helpers
    # ------------------------------------------------------------------

    def _validate_name(self, name: str) -> None:
        import re
        if not re.match(r"^[A-Za-z][A-Za-z0-9_]*$", name):
            raise ValueError(
                f"Invalid name '{name}'. Names must start with a letter and contain only letters, numbers, and underscores."
            )

    def _parse_id(self, scenario_id: str) -> tuple[str, str]:
        """Split 'station:name' into (station_id, name)."""
        if ":" not in scenario_id:
            raise ValueError("Invalid scenario ID format. Expected 'station:name'")
        parts = scenario_id.split(":", 1)
        return parts[0], parts[1]

    # ------------------------------------------------------------------
    # Scenarios (CRUD)
    # ------------------------------------------------------------------

    def list_for_station(self, station_id: str) -> list[dict[str, Any]]:
        cur = self.db.conn.execute(
            "SELECT * FROM scenario_files WHERE LOWER(station_id) = LOWER(?)",
            (station_id,),
        )
        results = []
        for row in cur.fetchall():
            results.append(
                {
                    "id": row["id"],
                    "station_id": row["station_id"],
                    "name": row["name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
            )
        return sorted(results, key=lambda x: x["name"])

    def create(self, station_id: str, name: str, source: str = "") -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ValueError("Scenario name cannot be empty")
        self._validate_name(name)

        scenario_id = f"{station_id}:{name}"
        cur = self.db.conn.execute(
            "SELECT id FROM scenario_files WHERE id = ?", (scenario_id,)
        )
        if cur.fetchone():
            raise ValueError(
                f"Scenario '{name}' already exists for station '{station_id}'"
            )

        now = time.time()
        self.db.conn.execute(
            "INSERT INTO scenario_files (id, station_id, name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (scenario_id, station_id, name, source, now, now),
        )
        self.db.conn.commit()
        return {"id": scenario_id, "station_id": station_id, "name": name}

    def get(self, scenario_id: str) -> dict[str, Any]:
        cur = self.db.conn.execute(
            "SELECT * FROM scenario_files WHERE id = ?", (scenario_id,)
        )
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")

        return {
            "id": row["id"],
            "station_id": row["station_id"],
            "name": row["name"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def get_source(self, scenario_id: str) -> str:
        cur = self.db.conn.execute(
            "SELECT source FROM scenario_files WHERE id = ?", (scenario_id,)
        )
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
        return row["source"]

    def update_source(self, scenario_id: str, source: str) -> dict[str, Any]:
        cur = self.db.conn.execute(
            "SELECT id FROM scenario_files WHERE id = ?", (scenario_id,)
        )
        if not cur.fetchone():
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")

        now = time.time()
        self.db.conn.execute(
            "UPDATE scenario_files SET source = ?, updated_at = ? WHERE id = ?",
            (source, now, scenario_id),
        )
        self.db.conn.commit()
        return self.get(scenario_id)

    def duplicate(self, scenario_id: str) -> dict[str, Any]:
        cur = self.db.conn.execute(
            "SELECT * FROM scenario_files WHERE id = ?", (scenario_id,)
        )
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")

        station_id = row["station_id"]
        name = row["name"]
        source = row["source"]

        copy_name = f"{name}_copy"
        i = 1
        while True:
            cur = self.db.conn.execute(
                "SELECT id FROM scenario_files WHERE id = ?",
                (f"{station_id}:{copy_name}",),
            )
            if not cur.fetchone():
                break
            copy_name = f"{name}_copy_{i}"
            i += 1

        return self.create(station_id, copy_name, source)

    def delete(self, scenario_id: str) -> None:
        self.db.conn.execute("DELETE FROM scenario_files WHERE id = ?", (scenario_id,))
        self.db.conn.commit()

    def rename_scenario(self, scenario_id: str, new_name: str) -> dict[str, Any]:
        cur = self.db.conn.execute("SELECT station_id FROM scenario_files WHERE id = ?", (scenario_id,))
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Scenario '{scenario_id}' not found")
            
        station_id = row["station_id"]
        old_name = scenario_id.split(":", 1)[1]
        
        new_name = new_name.strip()
        if not new_name:
            raise ValueError("Scenario name cannot be empty")
        self._validate_name(new_name)
            
        new_id = f"{station_id}:{new_name}"
        if new_id == scenario_id:
            return self.get(scenario_id)
            
        cur = self.db.conn.execute("SELECT id FROM scenario_files WHERE id = ?", (new_id,))
        if cur.fetchone():
            raise ValueError(f"Scenario '{new_name}' already exists for station '{station_id}'")
            
        now = time.time()
        self.db.conn.execute(
            "UPDATE scenario_files SET id = ?, name = ?, updated_at = ? WHERE id = ?",
            (new_id, new_name, now, scenario_id),
        )
        
        cur = self.db.conn.execute("SELECT id FROM simulation_runs WHERE scenario_id = ?", (scenario_id,))
        run_rows = cur.fetchall()
        for run_row in run_rows:
            old_run_id = run_row["id"]
            prefix = f"{station_id}{old_name}"
            if old_run_id.startswith(prefix):
                suffix = old_run_id[len(prefix):]
                new_run_id = f"{station_id}{new_name}{suffix}"
                
                self.db.conn.execute("UPDATE telemetry_records SET run_id = ? WHERE run_id = ?", (new_run_id, old_run_id))
                self.db.conn.execute("UPDATE simulation_logs SET run_id = ? WHERE run_id = ?", (new_run_id, old_run_id))
                self.db.conn.execute("UPDATE simulation_runs SET id = ?, scenario_id = ? WHERE id = ?", (new_run_id, new_id, old_run_id))
                
        self.db.conn.execute(
            "UPDATE simulation_runs SET scenario_id = ? WHERE scenario_id = ?",
            (new_id, scenario_id),
        )
        self.db.conn.commit()
        return self.get(new_id)

    def get_parsed_events(self, scenario_id: str) -> list[SceneEvent]:
        source = self.get_source(scenario_id)
        events = parse_scene_string(source)

        # Merge event definitions into scene events.
        # The event definition governs what the engine actually does; the scene's
        # payload only provides the dynamic values allowed by the definition.
        station_id = scenario_id.split(":")[0]
        for ev in events:
            try:
                event_def_row = self.get_event(f"{station_id}:{ev.event_ref}")
                parsed_def = parse_event_string(
                    event_def_row["source"], name=ev.event_ref
                )
                # Attach the parsed definition to the scene event so the engine
                # can use target_kind, where clauses, set_fixed, set_allowed, etc.
                ev.event_definition = parsed_def  # type: ignore[attr-defined]

                # For events that target specific externals (e.g. @external.network),
                # the scene file does not need to provide a selector – synthesise one.
                if ev.selector is None:
                    specific_external_targets = {
                        "external.network": "@network",
                        "external.weather": "@weather",
                        "external.supplies": "@supplies",
                    }
                    synthetic = specific_external_targets.get(parsed_def.target_kind)
                    if synthetic:
                        ev.selector = synthetic
                        
                # Merge fixed fields from the definition into the payload
                for k, v in parsed_def.set_fixed.items():
                    if k not in ev.payload:
                        ev.payload[k] = v

            except (FileNotFoundError, Exception):  # noqa: BLE001
                # Event definition not found or invalid – leave as-is so the
                # scene can still be previewed even with missing definitions.
                pass
        return events

    def validate(self, scenario_id: str) -> dict[str, Any]:
        try:
            source = self.get_source(scenario_id)
            events = parse_scene_string(source)
            return {"valid": True, "errors": [], "parsed_event_count": len(events)}
        except SceneParseError as e:
            return {"valid": False, "errors": [str(e)], "parsed_event_count": 0}
        except Exception as e:  # noqa: BLE001
            return {
                "valid": False,
                "errors": [f"Unexpected error: {e!s}"],
                "parsed_event_count": 0,
            }

    # ------------------------------------------------------------------
    # Event Definitions
    # ------------------------------------------------------------------

    def list_events(self, station_id: str) -> list[dict[str, Any]]:
        cur = self.db.conn.execute(
            "SELECT * FROM event_files WHERE LOWER(station_id) = LOWER(?)",
            (station_id,),
        )
        results = []
        for row in cur.fetchall():
            results.append(
                {
                    "id": row["id"],
                    "station_id": row["station_id"],
                    "name": row["name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
            )
        return sorted(results, key=lambda x: x["name"])

    def get_event(self, event_id: str) -> dict[str, Any]:
        cur = self.db.conn.execute(
            "SELECT * FROM event_files WHERE id = ?", (event_id,)
        )
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Event definition '{event_id}' not found")

        return {
            "id": row["id"],
            "station_id": row["station_id"],
            "name": row["name"],
            "source": row["source"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def create_event(
        self, station_id: str, name: str, source: str = ""
    ) -> dict[str, Any]:
        name = name.strip()
        if not name:
            raise ValueError("Event name cannot be empty")
        self._validate_name(name)

        event_id = f"{station_id}:{name}"
        cur = self.db.conn.execute(
            "SELECT id FROM event_files WHERE id = ?", (event_id,)
        )
        if cur.fetchone():
            raise ValueError(
                f"Event '{name}' already exists for station '{station_id}'"
            )

        now = time.time()
        self.db.conn.execute(
            "INSERT INTO event_files (id, station_id, name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (event_id, station_id, name, source, now, now),
        )
        self.db.conn.commit()
        return self.get_event(event_id)

    def update_event(self, event_id: str, source: str) -> dict[str, Any]:
        cur = self.db.conn.execute(
            "SELECT id FROM event_files WHERE id = ?", (event_id,)
        )
        if not cur.fetchone():
            raise FileNotFoundError(f"Event definition '{event_id}' not found")

        now = time.time()
        self.db.conn.execute(
            "UPDATE event_files SET source = ?, updated_at = ? WHERE id = ?",
            (source, now, event_id),
        )
        self.db.conn.commit()
        return self.get_event(event_id)

    def delete_event(self, event_id: str) -> None:
        cur = self.db.conn.execute(
            "SELECT id FROM event_files WHERE id = ?", (event_id,)
        )
        if not cur.fetchone():
            raise FileNotFoundError(f"Event definition '{event_id}' not found")

        self.db.conn.execute("DELETE FROM event_files WHERE id = ?", (event_id,))
        self.db.conn.commit()

    def rename_event(self, event_id: str, new_name: str) -> dict[str, Any]:
        cur = self.db.conn.execute("SELECT station_id FROM event_files WHERE id = ?", (event_id,))
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Event definition '{event_id}' not found")
            
        station_id = row["station_id"]
        new_name = new_name.strip()
        if not new_name:
            raise ValueError("Event name cannot be empty")
        self._validate_name(new_name)
            
        new_id = f"{station_id}:{new_name}"
        if new_id == event_id:
            return self.get_event(event_id)
            
        cur = self.db.conn.execute("SELECT id FROM event_files WHERE id = ?", (new_id,))
        if cur.fetchone():
            raise ValueError(f"Event '{new_name}' already exists for station '{station_id}'")
            
        now = time.time()
        self.db.conn.execute(
            "UPDATE event_files SET id = ?, name = ?, updated_at = ? WHERE id = ?",
            (new_id, new_name, now, event_id),
        )
        self.db.conn.commit()
        return self.get_event(new_id)
