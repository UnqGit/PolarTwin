import sys
import os
from pathlib import Path
sys.path.append(os.getcwd())
from compiler.parser.hierarchy_parser import parse_hierarchy_file

hierarchy_file = Path("data/source/NewStation/hierarchy.twin")
components = parse_hierarchy_file(hierarchy_file)

sensors = [c for c in components if c.type == "sensor"]
alarms = [c for c in components if c.type == "alarm"]
controllers = [c for c in components if c.type == "controller"]
antennas = [c for c in components if c.type == "antenna"]

fallback_antenna = antennas[0].name if antennas else components[0].name
fallback_controller = controllers[0].name if controllers else components[0].name
fallback_source = components[0].name # 'Maitri', not a floor

connections = []
for sensor in sensors:
    # Provide exactly 1 incoming data connection
    # It must not be from a floor node.
    connections.append(f"{fallback_source}:{sensor.name}[data]@reading")
    # Provide exactly 1 outgoing data connection to an antenna
    connections.append(f"{sensor.name}:{fallback_antenna}[data]@telemetry")

for alarm in alarms:
    # Exactly 1 incoming signal connection
    connections.append(f"{fallback_controller}:{alarm.name}[signal]@trigger")

with open("data/source/NewStation/connection.twin", "w") as f:
    f.write("\n".join(connections) + "\n")

specs = [
    "default:sensor {",
    "    measures=generic",
    "}"
]

with open("data/source/NewStation/spec.twin", "w") as f:
    f.write("\n".join(specs) + "\n")

print("Generated connection.twin and spec.twin")
