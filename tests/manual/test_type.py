import sys
import os
sys.path.append(os.path.join(os.getcwd(), "src"))
from twin_sim.simulation.engine_core import ExternalModel
ext = ExternalModel()
print(type(ext.weather).__name__)
