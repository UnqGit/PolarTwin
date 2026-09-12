import json
import pytest
import os
from pathlib import Path
from twin_sim.scenarios.loader import load_scenario_events
from twin_sim.ingestion.validator import ValidationError

def test_load_multiple_scenarios(tmp_path):
    scen1 = {
        "events": [
            {"id": "ev1", "timestamp": 10.0, "event": "blizzard", "duration": 30.0}
        ]
    }
    scen2 = {
        "events": [
            {"id": "ev2", "timestamp": 5.0, "event": "failure", "target": "gen1"}
        ]
    }
    
    p1 = tmp_path / "s1.json"
    p2 = tmp_path / "s2.json"
    p1.write_text(json.dumps(scen1))
    p2.write_text(json.dumps(scen2))
    
    events = load_scenario_events([str(p1), str(p2)])
    assert len(events) == 2
    
    # Should be sorted by timestamp
    assert events[0].id == "ev2"
    assert events[0].timestamp == 5.0
    
    assert events[1].id == "ev1"
    assert events[1].timestamp == 10.0

def test_load_duplicate_ids_across_files(tmp_path):
    scen1 = {
        "events": [
            {"id": "ev1", "timestamp": 10.0, "event": "blizzard"}
        ]
    }
    scen2 = {
        "events": [
            {"id": "ev1", "timestamp": 20.0, "event": "failure"}
        ]
    }
    
    p1 = tmp_path / "s1.json"
    p2 = tmp_path / "s2.json"
    p1.write_text(json.dumps(scen1))
    p2.write_text(json.dumps(scen2))
    
    with pytest.raises(ValidationError, match="duplicate scenario event id 'ev1'"):
        load_scenario_events([str(p1), str(p2)])
