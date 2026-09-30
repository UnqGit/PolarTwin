import sys
import os
sys.path.append(os.path.join(os.getcwd(), "src"))
from twin_sim.api.scenario_manager import ScenarioManager
from twin_sim.telemetry.database import TelemetryDatabase

db = TelemetryDatabase('./data/telemetry.db')
sm = ScenarioManager(db)
events = sm.get_parsed_events('Maitri:e2e_test_1790691340')
for e in events:
    print(e)
