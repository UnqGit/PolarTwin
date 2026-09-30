import os
import glob
from pathlib import Path


def migrate_old_files_to_db(db, data_dir: Path):
    # Migrate scenarios
    source_dir = data_dir / "source"
    if source_dir.exists():
        for station_dir in source_dir.iterdir():
            if station_dir.is_dir():
                station_id = station_dir.name
                scenarios_dir = station_dir / "scenarios"
                if scenarios_dir.exists():
                    for scene_file in scenarios_dir.glob("*.scene"):
                        name = scene_file.stem
                        try:
                            with open(scene_file, "r", encoding="utf-8") as f:
                                source = f.read()

                            scenario_id = f"{station_id}:{name}"
                            cur = db.conn.execute(
                                "SELECT id FROM scenario_files WHERE id = ?",
                                (scenario_id,),
                            )
                            if not cur.fetchone():
                                import time

                                now = time.time()
                                db.conn.execute(
                                    "INSERT INTO scenario_files (id, station_id, name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                                    (scenario_id, station_id, name, source, now, now),
                                )
                                print(f"[migrate] Migrated scenario {scenario_id}")
                        except Exception as e:
                            print(f"[migrate] Error migrating {scene_file}: {e}")

    # Migrate events
    events_dir = data_dir / "events"
    if events_dir.exists():
        for event_file in events_dir.glob("*.event"):
            name = event_file.stem
            # We don't know which station this belongs to easily, so let's attach it to all known stations or just 'HalleyVI' by default
            # Actually, existing events were global. Let's just migrate them for each station directory we found above
            try:
                with open(event_file, "r", encoding="utf-8") as f:
                    source = f.read()
                import time

                now = time.time()

                # Attach to all loaded stations
                if source_dir.exists():
                    for station_dir in source_dir.iterdir():
                        if station_dir.is_dir():
                            station_id = station_dir.name
                            event_id = f"{station_id}:{name}"
                            cur = db.conn.execute(
                                "SELECT id FROM event_files WHERE id = ?", (event_id,)
                            )
                            if not cur.fetchone():
                                db.conn.execute(
                                    "INSERT INTO event_files (id, station_id, name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                                    (event_id, station_id, name, source, now, now),
                                )
                                print(f"[migrate] Migrated event {event_id}")
            except Exception as e:
                print(f"[migrate] Error migrating {event_file}: {e}")

    db.conn.commit()
