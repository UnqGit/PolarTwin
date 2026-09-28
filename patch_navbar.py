import sys

with open('frontend/src/components/Navbar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_stmt = "import { SimulationManager } from './SimulationManager';\n"
if "import { SimulationManager }" not in content:
    # insert after import { useTheme }
    content = content.replace("import { useTheme } from './ThemeContext';", "import { useTheme } from './ThemeContext';\n" + import_stmt)

button_injection = '''
        <SimulationManager />
        <button 
          onClick={toggleTheme}'''

if "<SimulationManager />" not in content:
    content = content.replace('''
        <button 
          onClick={toggleTheme}''', button_injection)

with open('frontend/src/components/Navbar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Navbar updated")
