import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    changed = False
    new_lines = []
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        if 'topology = read_json(' in line or 'topology = json.loads(' in line or 'topology_data = read_json(' in line:
            # Check if connections is defined nearby
            next_lines = "".join(lines[i:i+3])
            if 'connections = ' not in next_lines and 'connections' in "".join(lines[i:i+5]):
                # Add connections = read_json(...)
                indent = line[:len(line) - len(line.lstrip())]
                
                # Extract path logic
                if 'root / "topology.json"' in line:
                    new_lines.append(indent + 'connections = read_json(root / "connections.json")\n')
                    changed = True
                elif 'ROOT / "examples/minimal/topology.json"' in line:
                    new_lines.append(indent + 'connections = read_json(ROOT / "examples/minimal/connections.json")\n')
                    changed = True
                elif 'ROOT / "examples/maitri/topology.json"' in line:
                    new_lines.append(indent + 'connections = read_json(ROOT / "examples/maitri/connections.json")\n')
                    changed = True

    if changed:
        with open(filepath, 'w') as f:
            f.writelines(new_lines)
        print(f"Fixed {filepath}")

for filepath in glob.glob("tests/test_*.py"):
    fix_file(filepath)
