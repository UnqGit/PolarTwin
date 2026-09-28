import sys

with open('frontend/src/lib/api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

target = '  // Simulations\n  createSimulation:'
replacement = '''  // Simulations
  listSimulations: async () => {
    const res = await fetch(${API_BASE}/simulations);
    if (!res.ok) throw new Error("Failed to list simulations");
    return res.json();
  },
  createSimulation:'''

if target in content:
    content = content.replace(target, replacement)
    with open('frontend/src/lib/api.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")
