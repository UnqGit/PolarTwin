import re

with open('src/twin_sim/simulation/engine_core.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Match: _set_v(obj if isinstance(obj, dict) else comp.value.setdefault("field", {}), "value", new_val)
    m = re.search(r'_set_v\([^ ]+ if isinstance\([^,]+, dict\) else ([^.]+)\.value\.setdefault\("([^"]+)", {}\), "value", (.*)\)', line)
    if m:
        comp = m.group(1)
        field = m.group(2)
        val = m.group(3)
        indent = line[:line.find('_set_v')]
        new_lines.append(f'{indent}_update_field({comp}, "{field}", {val})\n')
        continue
        
    # Match: _set_v(p_obj, "value", 0.0) -> requires manual fixing if not caught
    new_lines.append(line)

with open('src/twin_sim/simulation/engine_core.py', 'w') as f:
    f.writelines(new_lines)

