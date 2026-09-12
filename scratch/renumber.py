import re

with open('IMPLEMENTATION_PLAN.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_phase_list = False
inserted = False

for line in lines:
    # Handle the summary list at the bottom
    if line.startswith('Phase 26 -> experiments'):
        new_lines.append(line)
        new_lines.append('Phase 27 -> telemetry ingress/egress\n')
        continue
        
    m_list = re.match(r'^Phase (\d+) -> (.*)', line)
    if m_list:
        p_num = int(m_list.group(1))
        if p_num > 26:
            new_lines.append(f'Phase {p_num + 1} -> {m_list.group(2)}\n')
            continue

    # Handle headers
    m_header = re.match(r'^# (\d+)\. (.*)', line)
    if m_header:
        sec_num = int(m_header.group(1))
        title = m_header.group(2)
        
        if sec_num == 29 and not inserted:
            # We are at the start of the old section 29. Insert our new section 29 here.
            new_lines.append('# 29. Phase 27 — Telemetry Ingress & Egress Middleware\n\n')
            new_lines.append('Implement an Ingress (Modulation) and Egress (Demodulation) pipeline to securely and robustly handle external data.\n\n')
            new_lines.append('1. **Ingress (Modulation)**: Validate incoming data via Pydantic and normalize units (e.g. F to K, pounds to kg).\n')
            new_lines.append('2. **Egress (Demodulation)**: Expand compressed delta telemetry into discrete time points using linear interpolation right before the sink.\n\n')
            new_lines.append('---\n\n')
            inserted = True
            
        if sec_num >= 29:
            sec_num += 1
            
        # Check if the title has a Phase number
        m_phase = re.match(r'^Phase (\d+) (.*)', title)
        if m_phase:
            p_num = int(m_phase.group(1))
            if p_num > 26:
                title = f'Phase {p_num + 1} {m_phase.group(2)}'
                
        new_lines.append(f'# {sec_num}. {title}\n')
    else:
        new_lines.append(line)

with open('IMPLEMENTATION_PLAN.md', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Renumbering complete.")
