import unittest
from packages.shared_models.domain import HierarchyComponent, CompiledConnection, ComponentSpec
from packages.shared_models.enums import ConnectionType
from compiler.cross_validator import validate_asts, CrossValidationError

class TestCrossValidator(unittest.TestCase):
    def setUp(self):
        def hc(name, type):
            return HierarchyComponent(
                name=name, type=type, parent=None, priority=0, 
                floor=0, is_backup=False, backup=[], 
                external_field=None, children=[], tags=[]
            )
        self.hierarchy = [
            hc("Pump1", "pump"),
            hc("PumpSensorFlow", "sensor"),
            hc("PumpSensorTemp", "sensor"),
            hc("Antenna1", "antenna"),
        ]
        
        self.specs = [
            ComponentSpec(
                name="Pump1",
                type="pump",
                rating={
                    "output": {"flowrate": {"min": 0, "max": 100}},
                    "state": {"temperature": {"value": 50}}
                }
            ),
            ComponentSpec(name="PumpSensorFlow", type="sensor", measures="flowrate"),
            ComponentSpec(name="PumpSensorTemp", type="sensor", measures="temperature"),
            ComponentSpec(name="Antenna1", type="antenna"),
        ]
        
        self.connections = [
            CompiledConnection(source="Pump1", target="PumpSensorFlow", type=ConnectionType.DATA, relation="measure"),
            CompiledConnection(source="Pump1", target="PumpSensorTemp", type=ConnectionType.DATA, relation="measure"),
            CompiledConnection(source="PumpSensorFlow", target="Antenna1", type=ConnectionType.DATA, relation="transmit"),
            CompiledConnection(source="PumpSensorTemp", target="Antenna1", type=ConnectionType.DATA, relation="transmit"),
        ]

    def test_valid_cross_validation(self):
        # Should not raise an error
        validate_asts(self.hierarchy, self.connections, self.specs)

    def test_missing_sensor_for_rating_field(self):
        # Remove the temperature sensor connection
        self.connections.pop(1)
        
        with self.assertRaisesRegex(CrossValidationError, "missing sensors for rating fields: temperature"):
            validate_asts(self.hierarchy, self.connections, self.specs)

    def test_sensor_coverage_exemptions(self):
        # If we add an alarm with a rating, it shouldn't require a sensor
        hc_alarm = HierarchyComponent(
            name="Alarm1", type="alarm", parent=None, priority=0, 
            floor=0, is_backup=False, backup=[], external_field=None, children=[], tags=[]
        )
        spec_alarm = ComponentSpec(
            name="Alarm1", type="alarm",
            rating={"input": {"voltage": {"value": 12}}}
        )
        self.hierarchy.append(hc_alarm)
        self.specs.append(spec_alarm)
        
        # Validates fine without sensors for the alarm
        validate_asts(self.hierarchy, self.connections, self.specs)

if __name__ == "__main__":
    unittest.main()
