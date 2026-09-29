import sys
import os
sys.path.append(os.path.join(os.getcwd(), "src"))
from twin_sim.dsl.event_stack import _set_nested_field
from twin_sim.models import ExternalWeather
weather = ExternalWeather()
print("Before:", weather.temperature)
_set_nested_field(weather, "temperature", -50)
print("After:", weather.temperature)
