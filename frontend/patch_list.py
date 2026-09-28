with open('src/components/ConnectionsList.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { Edit2 } from 'lucide-react';", "import { Edit2, Eye, EyeOff } from 'lucide-react';")

old_bg = "background: isSelected ? 'rgba(34, 211, 238, 0.15)' : 'transparent',"
new_bg = "background: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'transparent',"
content = content.replace(old_bg, new_bg)

old_border = "borderLeft: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'transparent'}`,Display"
# Wait, the original string is: borderLeft: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'transparent'}`,
content = content.replace("borderLeft: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'transparent'}`,", "borderLeft: `3px solid ${isSelected ? '#22c55e' : 'transparent'}`,")

old_icon = """<span
                              onClick={(e) => { e.stopPropagation(); toggleVisibility(c.id); }}
                              style={{
                                cursor: 'pointer', fontSize: 12, padding: '2px 4px',
                                color: hiddenSet.has(c.id) ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                opacity: hiddenSet.has(c.id) ? 0.5 : 1,
                              }}
                              title={hiddenSet.has(c.id) ? 'Show connection' : 'Hide connection'}
                            >
                              {hiddenSet.has(c.id) ? '👁‍🗨' : '👁'}
                            </span>"""

new_icon = """<span
                              onClick={(e) => { e.stopPropagation(); toggleVisibility(c.id); }}
                              style={{
                                cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
                                color: hiddenSet.has(c.id) ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                              }}
                              title={hiddenSet.has(c.id) ? 'Show connection' : 'Hide connection'}
                            >
                              {hiddenSet.has(c.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                            </span>"""

content = content.replace(old_icon, new_icon)

with open('src/components/ConnectionsList.tsx', 'w') as f:
    f.write(content)
