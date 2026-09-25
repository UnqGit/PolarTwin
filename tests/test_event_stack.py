import unittest
from twin_sim.dsl.event_stack import TimelineStateManager
from twin_sim.ingestion.models import RuntimeComponent, ExternalModel, WeatherModel, NetworkModel

class TestEventStack(unittest.TestCase):
    def setUp(self):
        comp = RuntimeComponent(name="Gen1", type="generator", is_backup=False, status="active", value={"voltage": 100})
        ext = ExternalModel(
            weather=WeatherModel(temperature=0, wind_speed=0, humidity=0, o2_level=0, co2_level=0, wind_direction=0, visibility=0, pressure=0, dew_frost_point=0),
            network=NetworkModel(bandwidth=100, mainland_connectivity=True, upload_window=False, upload_speed=10, download_speed=10),
            supplies=[]
        )
        self.manager = TimelineStateManager(components=[comp], connections=[], external=ext)
        self.comp = comp

    def test_infinite_event(self):
        # Base voltage is 100
        eff = self.manager.get_effective_state_dict()["components"][0]
        self.assertEqual(eff.value["voltage"], 100)
        
        # Apply inf event
        self.manager.apply_infinite_event(self.comp, "value.voltage", 150)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        self.assertEqual(eff.value["voltage"], 150)
        self.assertEqual(len(self.manager.active_layers), 0)

    def test_finite_event_expiration(self):
        # Add finite event for 2 hours
        self.manager.add_finite_event("e1", 1, 1.0, 3.0, self.comp, "value.voltage", 200)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        self.assertEqual(eff.value["voltage"], 200)
        
        # Expire at time 3.0 (end_time is 3.0, so it expires when current_time >= end_time)
        self.manager.expire_events(3.0)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        self.assertEqual(eff.value["voltage"], 100)
        
    def test_stack_unwinding_behavior(self):
        """
        X = R (100)
        A -> S (200) for N=2
        B -> T (300) for M=4
        Both start at time 1.0. 
        A appears first (source order 1). B appears second (source order 2).
        If M > N (4 > 2), A expires first and X remains T.
        """
        self.manager.add_finite_event("A", 1, 1.0, 3.0, self.comp, "value.voltage", 200)
        self.manager.add_finite_event("B", 2, 1.0, 5.0, self.comp, "value.voltage", 300)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        # B overwrites A because it has higher source order for the same start time
        self.assertEqual(eff.value["voltage"], 300)
        
        # At time 3.0, A expires.
        self.manager.expire_events(3.0)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        # B is still active, so voltage is still 300
        self.assertEqual(eff.value["voltage"], 300)
        
        # At time 5.0, B expires.
        self.manager.expire_events(5.0)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        # Both expired, back to 100
        self.assertEqual(eff.value["voltage"], 100)

    def test_stack_unwinding_behavior_inverted(self):
        """
        X = R (100)
        A -> S (200) for N=4
        B -> T (300) for M=2
        If N > M (4 > 2), B expires first and X becomes S (200). 
        When A later expires, X becomes R (100).
        """
        self.manager.add_finite_event("A", 1, 1.0, 5.0, self.comp, "value.voltage", 200)
        self.manager.add_finite_event("B", 2, 1.0, 3.0, self.comp, "value.voltage", 300)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        # B overwrites A
        self.assertEqual(eff.value["voltage"], 300)
        
        # At time 3.0, B expires.
        self.manager.expire_events(3.0)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        # B expired, but A is still active, so it should be S (200)!
        self.assertEqual(eff.value["voltage"], 200)
        
        # At time 5.0, A expires.
        self.manager.expire_events(5.0)
        
        eff = self.manager.get_effective_state_dict()["components"][0]
        self.assertEqual(eff.value["voltage"], 100)

if __name__ == "__main__":
    unittest.main()
