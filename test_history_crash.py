import sqlite3
import json
import ast

run_id = 'Maitrigen_fail_17907028491'
comp_id = 'MainGenerator'

db_path = '/Users/shivamsingh/PolarTwin/telemetry.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("""
    SELECT simulation_time, status, value 
    FROM telemetry_component_states 
    WHERE run_id = ? AND component_name = ?
    ORDER BY simulation_time ASC
""", (run_id, comp_id))
rows = cur.fetchall()

print(f"Found {len(rows)} rows.")
try:
    for row in rows[:5]:
        v = row[2]
        if isinstance(v, str):
            v = ast.literal_eval(v) if v.startswith("{") else v
        print(v)
except Exception as e:
    print("Crash:", e)

