import unittest
from twin_sim.simulation.engine_core import SimulationEngineCore
from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.dsl.models import SceneEvent
from twin_sim.ingestion.models import RuntimeComponent, ExternalModel, WeatherModel, NetworkModel

class TestEngineCore(unittest.TestCase):
    def setUp(self):
        comp = RuntimeComponent(name="Gen1", type="generator", is_backup=False, status="active", value={"temperature": 20.0, "power": 500.0})
        ext = ExternalModel(
            weather=WeatherModel(temperature=-10.0, wind_speed=5.0, humidity=50, o2_level=21, co2_level=0, wind_direction=180, visibility=1000, pressure=1000, dew_frost_point=-15),
            network=NetworkModel(bandwidth=100, mainland_connectivity=True, upload_window=False, upload_speed=10, download_speed=10),
            supplies=[]
        )
        self.state = TimelineStateManager(components=[comp], connections=[], external=ext)
        
    def test_simulation_advance_time(self):
        engine = SimulationEngineCore(self.state, [])
        self.assertEqual(engine.time, 0.0)
        
        # 1 tick = 15 seconds = 15/3600 hours = 0.004166... hours
        engine.run_tick()
        self.assertAlmostEqual(engine.time, 15.0 / 3600.0)
        
    def test_run_duration(self):
        engine = SimulationEngineCore(self.state, [])
        # Run for 1 simulation hour (which is 240 ticks of 15 seconds each)
        engine.run_duration(1.0)
        self.assertAlmostEqual(engine.time, 1.0)
        self.assertEqual(len(engine.telemetry), 240)
        
    def test_event_instantiation(self):
        scene1 = SceneEvent(event_ref="temp_spike", selector="@Gen1", at=0.5, duration=0.5, payload={"temperature": 150.0})
        engine = SimulationEngineCore(self.state, [scene1])
        
        # Run up to 0.4 hours, event should NOT fire
        engine.run_duration(0.4)
        eff = engine.state.get_effective_state_dict()["components"][0]
        self.assertLess(eff.value["temperature"], 100.0) # Normal physics applied
        self.assertEqual(len(engine.state.active_layers), 0)
        
        # Run up to 0.6 hours, event SHOULD fire and be active
        engine.run_duration(0.2)
        self.assertEqual(len(engine.state.active_layers), 1)
        eff = engine.state.get_effective_state_dict()["components"][0]
        # Our naive payload applier in the core mockup applies value as direct replacement for test purposes.
        # However we set `value.temperature=150.0`.
        self.assertEqual(eff.value["temperature"], 150.0)
        
        # Run past 1.0 hours, event SHOULD expire
        engine.run_duration(0.5)
        self.assertEqual(len(engine.state.active_layers), 0)

if __name__ == "__main__":
    unittest.main()
