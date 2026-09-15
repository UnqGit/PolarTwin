import os

filepath = "tests/test_phase21_causal.py"
with open(filepath, 'r') as f:
    content = f.read()

# Fix compile_model
content = content.replace(
    'self.maitri_graph = compile_model(\n            read_json(self.maitri_root / "relation.json"),\n            read_json(self.maitri_root / "spec.json"),\n        )',
    'self.maitri_graph = compile_model(\n            read_json(self.maitri_root / "relation.json"),\n            raw_connections=read_json(self.maitri_root / "connection.json"),\n            specification=read_json(self.maitri_root / "spec.json"),\n        )'
)

# Fix cli commands
content = content.replace(
    '"--spec", str(self.maitri_root / "spec.json"),',
    '"--spec", str(self.maitri_root / "spec.json"),\n                "--connection", str(self.maitri_root / "connection.json"),'
)

with open(filepath, 'w') as f:
    f.write(content)

filepath = "tests/test_phase17_cli.py"
with open(filepath, 'r') as f:
    content = f.read()

content = content.replace(
    'graph_output = self.run_cli("graph", "--topology", str(self.root / "topology.json"), "--spec", str(self.root / "specification.json"))',
    'graph_output = self.run_cli("graph", "--topology", str(self.root / "topology.json"), "--connection", str(self.root / "connections.json"), "--spec", str(self.root / "specification.json"))'
)

with open(filepath, 'w') as f:
    f.write(content)

