import glob
import os
import re

for filepath in glob.glob("tests/test_*.py"):
    with open(filepath, 'r') as f:
        content = f.read()
        
    changed = False

    # Fix test_phase22_safety.py
    if "test_phase22_safety.py" in filepath:
        if 'connections.append({' in content:
            content = content.replace('connections.append({', 'connections = list(self.connections)\n        connections.append({')
            changed = True
        
        # fix compile_model calls with validation_config
        content = re.sub(r'compile_model\(self\.topology, spec, (\{[^}]+\})\)', r'compile_model(self.topology, connections=self.connections, specification=spec, validation_config=\1)', content)
        content = re.sub(r'compile_model\(self\.topology, self\.connections, self\.specification\)', r'compile_model(self.topology, connections=self.connections, specification=self.specification)', content)
        
        changed = True

    # Fix test_phase1_contracts.py
    if "test_phase1_contracts.py" in filepath:
        # Some similar connections issues maybe?
        if 'connections = list(self.connections)' not in content and 'connections.append({' in content:
            content = content.replace('connections.append({', 'connections = list(self.connections)\n        connections.append({')
            changed = True
        
        if 'connections[0]["direction"] = "invalid"' in content:
             content = content.replace('connections[0]["direction"] = "invalid"', 'connections = list(self.connections)\n        connections[0]["direction"] = "invalid"')
             changed = True

        if 'connections[0]["target"] = "DoesNotExist"' in content:
             content = content.replace('connections[0]["target"] = "DoesNotExist"', 'connections = list(self.connections)\n        connections[0]["target"] = "DoesNotExist"')
             changed = True
             
    # Fix test_phase20_quality.py
    if "test_phase20_quality.py" in filepath:
        if 'connections.append({' in content:
            content = content.replace('connections.append({', 'connections = list(self.connections)\n        connections.append({')
            changed = True
            
        content = re.sub(r'compile_model\(topology, connections, self\.specification\)', r'compile_model(topology, connections=connections, specification=self.specification)', content)
        content = re.sub(r'compile_model\(self\.topology, self\.connections, self\.specification\)', r'compile_model(self.topology, connections=self.connections, specification=self.specification)', content)

    if changed:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")
