import glob
import os

for filepath in glob.glob("tests/test_*.py"):
    with open(filepath, 'r') as f:
        content = f.read()
        
    if "connections=self.connections" in content or "connections=connections" in content:
        content = content.replace("connections=self.connections", "raw_connections=self.connections")
        content = content.replace("connections=connections", "raw_connections=connections")
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")
