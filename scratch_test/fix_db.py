import sqlite3
db = sqlite3.connect('data/telemetry.db')
db.execute("UPDATE telemetry_records SET station_id = 'maitri' WHERE station_id = 'Maitri'")
db.commit()
print("Fixed DB casing")
