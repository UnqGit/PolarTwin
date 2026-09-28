import re

with open("data/source/Maitri/connection.twin", "r") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if line.strip() == "":
        new_lines.append(line)
        continue
        
    parts = line.strip().split("[")
    if len(parts) != 2:
        new_lines.append(line)
        continue
        
    left = parts[0]
    right = "[" + parts[1]
    
    src, dest = left.split(":")
    
    conn_type = right.split("]")[0][1:]
    
    if conn_type == "data":
        if "Controller" in src and "meter" in dest:
            # Drop data from Controller to Sensor
            continue
            
    if conn_type == "power":
        if dest.endswith("Controller"):
            dest = dest.replace("Controller", "Block")
            # For water, it is WaterAndWasteBlock
            if dest == "WaterBlock":
                dest = "WaterAndWasteBlock"
            # For Main, there is no MainBlock, maybe ControlBlock
            if dest == "MainBlock":
                dest = "ControlBlock"
                
    new_line = f"{src}:{dest}{right}\n"
    new_lines.append(new_line)

with open("data/source/Maitri/connection.twin", "w") as f:
    f.writelines(new_lines)
