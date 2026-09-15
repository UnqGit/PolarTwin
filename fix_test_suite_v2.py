import glob
import os
import re

for filepath in glob.glob("tests/test_*.py"):
    with open(filepath, 'r') as f:
        content = f.read()
        
    changed = False

    # Fix test_phase5_propagation.py
    if "test_phase5_propagation.py" in filepath:
        if 'topology = read_json(root / "topology.json")\n        specification = read_json(root / "specification.json")' in content:
            content = content.replace('topology = read_json(root / "topology.json")\n        specification = read_json(root / "specification.json")',
                                      'topology = read_json(root / "topology.json")\n        connections = read_json(root / "connections.json")\n        specification = read_json(root / "specification.json")')
            changed = True
        if 'topology["connections"][0]["direction"] = "<-->"' in content:
            content = content.replace('topology["connections"][0]["direction"] = "<-->"', 'connections[0]["direction"] = "<-->"')
            changed = True

    # Fix test_phase2_graph.py
    if "test_phase2_graph.py" in filepath:
        if 'test_maitri_compiles_without_station_specific_code' in content:
            content = content.replace('topology = read_json(ROOT / "data/compiled/maitri/relation.json")\n        specification = read_json(ROOT / "data/compiled/maitri/spec.json")\n        graph = compile_model(topology, connections, specification)',
                                      'topology = read_json(ROOT / "data/compiled/maitri/relation.json")\n        connections = read_json(ROOT / "data/compiled/maitri/connection.json")\n        specification = read_json(ROOT / "data/compiled/maitri/spec.json")\n        graph = compile_model(topology, connections, specification)')
            changed = True
            
    # Fix test_phase3_behaviors.py
    if "test_phase3_behaviors.py" in filepath:
        if 'test_specification_behavior_hint_is_used_after_type_lookup' in content:
            if 'graph = compile_model(topology, connections, specification)' in content:
                content = content.replace('graph = compile_model(topology, connections, specification)', 'graph = compile_model(topology, self.connections, specification)')
                changed = True
        if 'test_unknown_type_uses_generic_behavior_and_diagnostic' in content:
            if 'graph = compile_model(topology, connections, specification)' in content:
                content = content.replace('graph = compile_model(topology, connections, specification)', 'graph = compile_model(topology, self.connections, specification)')
                changed = True

    if changed:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")
