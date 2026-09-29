import re

with open('src/twin_sim/simulation/engine_core.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "def _set_v(" in line:
        new_lines.append(line)
        new_lines.append("""def _update_field(c, field: str, new_val: float):
    obj = c.value.get(field)
    if isinstance(obj, dict):
        obj["value"] = new_val
    else:
        c.value[field] = new_val
""")
        continue
        
    # Manual replaces
    if '_set_v(p_obj, "value", 0.0)' in line:
        line = line.replace('_set_v(p_obj, "value", 0.0)', '_update_field(base_comps[gen.name], "power", 0.0)')
    if '_set_v(p_obj, "value", total_demanded)' in line:
        line = line.replace('_set_v(p_obj, "value", total_demanded)', '_update_field(base_comps[gen.name], "power", total_demanded)')
    if '_set_v(p_obj, "value", p_max)' in line:
        line = line.replace('_set_v(p_obj, "value", p_max)', '_update_field(base_comps[gen.name], "power", p_max)')
    if '_set_v(c_p_obj, "value", ratio * c_demand)' in line:
        line = line.replace('_set_v(c_p_obj, "value", ratio * c_demand)', '_update_field(base_comps[n], "power", ratio * c_demand)')
    if '_set_v(p_obj, "value", p_curr)' in line:
        line = line.replace('_set_v(p_obj, "value", p_curr)', '_update_field(c, "power", p_curr)')
        
    if '_set_v(fr_obj if isinstance(fr_obj, dict) else c.value.setdefault("frequency", {}),' in line:
        line = line.replace('_set_v(fr_obj if isinstance(fr_obj, dict) else c.value.setdefault("frequency", {}),', '_update_field(c, "frequency",')
        
    if '_set_v(' in line and 'tt_obj' in line:
        # this is the multiline _set_v at the end
        pass # I will fix this manually
        
    new_lines.append(line)

with open('src/twin_sim/simulation/engine_core.py', 'w') as f:
    f.writelines(new_lines)
