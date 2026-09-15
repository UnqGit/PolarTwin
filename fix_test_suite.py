import glob
import os
import re

for filepath in glob.glob("tests/test_*.py"):
    with open(filepath, 'r') as f:
        content = f.read()
        
    changed = False

    # 1. Fix compile_model(topology, connections, specification) missing definition
    # This was mostly fixed by fix_tests.py, but some might still have "connections" NameError
    # We will just replace `compile_model(topology, connections, specification)` with `compile_model(topology, raw_connections=connections, specification=specification)`? 
    # Actually, we can just replace `connections` with `self.connections` if in a class with `self.connections`.
    
    # Let's fix test_maitri_compiles_without_station_specific_code in test_phase2_graph.py
    if 'compile_model(topology, connections, specification)' in content:
        content = re.sub(r'graph = compile_model\(topology, connections, specification\)',
                         r'graph = compile_model(topology, specification=specification)', content)
        changed = True
        
    # Fix topology["connections"] to self.connections
    if 'topology["connections"]' in content:
        content = content.replace('topology["connections"]', 'self.connections')
        changed = True
        
    if changed:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")
