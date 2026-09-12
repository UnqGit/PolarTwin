"""Phase 26 tests for Reproducible Experiment Runner."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
import pytest

from twin_sim.cli import main
from twin_sim.storage import SQLiteAdapter


@pytest.fixture
def sample_model_files(tmp_path: Path):
    topology_file = tmp_path / "topology.json"
    spec_file = tmp_path / "spec.json"
    scenario_file = tmp_path / "scenario.json"

    topology_file.write_text(json.dumps({
        "name": "base",
        "type": "system",
        "tags": ["root"],
        "children": [
            {"name": "pump1", "type": "pump", "tags": ["asset"], "children": []}
        ],
        "connections": []
    }))

    spec_file.write_text(json.dumps({
        "defaults": {
            "system": {},
            "pump": {"flow_rate": 10.0}
        },
        "components": {
            "base": {"type": "system", "spec": {}},
            "pump1": {"type": "pump", "spec": {"flow_rate": 15.0}}
        }
    }))

    scenario_file.write_text(json.dumps({
        "name": "test_scenario",
        "events": [
            {
                "id": "e1",
                "timestamp": 0.5,
                "event": "temperature_change",
                "parameters": {"temperature": -5.0}
            }
        ]
    }))

    return topology_file, spec_file, scenario_file


def test_sqlite_adapter_experiments_table(tmp_path: Path):
    db_path = tmp_path / "test.db"
    adapter = SQLiteAdapter(db_path)
    adapter.start()

    # Check tables exist
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}
    assert "telemetry" in tables
    assert "experiments" in tables

    adapter.record_experiment(
        run_id="run-001",
        seed=42,
        topology_hash="hash_top",
        specification_hash="hash_spec",
        scenario_hash="hash_scen",
        configuration='{"duration": 2.0}',
        start_timestamp="2026-09-12T00:00:00Z",
        end_timestamp="2026-09-12T00:00:01Z",
    )
    adapter.close()

    cursor.execute("SELECT run_id, seed, topology_hash, specification_hash, scenario_hash FROM experiments WHERE run_id='run-001'")
    row = cursor.fetchone()
    assert row == ("run-001", 42, "hash_top", "hash_spec", "hash_scen")
    conn.close()


def test_cli_experiment_command(sample_model_files, tmp_path: Path):
    topology_file, spec_file, scenario_file = sample_model_files
    db_path = tmp_path / "exp_results.db"

    argv = [
        "experiment",
        "--topology", str(topology_file),
        "--spec", str(spec_file),
        "--scenario", str(scenario_file),
        "--runs", "3",
        "--db-path", str(db_path),
        "--duration", "2.0",
        "--seed", "100"
    ]

    ret = main(argv)
    assert ret == 0

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Verify experiments table
    cursor.execute("SELECT run_id, seed, topology_hash, specification_hash, scenario_hash FROM experiments ORDER BY seed ASC")
    exp_rows = cursor.fetchall()
    assert len(exp_rows) == 3
    # Seeds should be 100, 101, 102
    assert [row[1] for row in exp_rows] == [100, 101, 102]
    # Hashes should be identical across runs
    assert exp_rows[0][2] == exp_rows[1][2] == exp_rows[2][2]
    assert exp_rows[0][3] == exp_rows[1][3] == exp_rows[2][3]
    assert exp_rows[0][4] == exp_rows[1][4] == exp_rows[2][4]

    # Verify telemetry table
    cursor.execute("SELECT DISTINCT run_id FROM telemetry")
    telemetry_runs = {row[0] for row in cursor.fetchall()}
    exp_run_ids = {row[0] for row in exp_rows}
    assert telemetry_runs == exp_run_ids

    conn.close()
