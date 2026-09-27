from packages.shared_models.domain import HierarchyComponent, CompiledConnection, ComponentSpec
from packages.shared_models.errors import ParseError

class CrossValidationError(ParseError):
    pass

def validate_asts(
    hierarchy: list[HierarchyComponent],
    connections: list[CompiledConnection],
    specs: list[ComponentSpec]
):
    """
    Perform cross-file validations spanning hierarchy, connection, and spec data.
    
    Rules (Phase 7 / Phase 3):
    1. Sensor Coverage: For every rating value type defined for a component (except structural/networking nodes),
       there must be a sensor measuring that value, connected via a 'data' connection.
    """
    
    spec_map = {s.name: s for s in specs}
    
    # Map component -> sensors connected to it
    sensors_for_component = {h.name: [] for h in hierarchy}
    
    for conn in connections:
        # if target is a sensor, add it
        target_spec = spec_map.get(conn.target)
        if target_spec and target_spec.type == "sensor":
            sensors_for_component[conn.source].append(target_spec)
            
    # Check sensor coverage
    # Exempt components that don't need full sensor suites (or maybe they do? "For every rating value type...")
    # Actually, sensors themselves have ratings (their operating limits), but they don't have sensors measuring their ratings.
    # Antennas, alarms, controllers also typically don't have sensors measuring them unless specified.
    exempt_types = {"sensor", "antenna", "alarm", "controller", "station", "campus", "block", "floor"}
    
    for comp in hierarchy:
        if comp.type in exempt_types:
            continue
            
        c_spec = spec_map[comp.name]
        
        # Collect all fully qualified rating fields across input, output, state
        # e.g., "input.temperature", "state.pressure"
        required_measurements = set()
        for scope, scope_data in c_spec.rating.items():
            if isinstance(scope_data, dict):
                for field in scope_data.keys():
                    required_measurements.add(f"{scope}.{field}")
                
        if not required_measurements:
            continue
            
        # Collect all measurements from connected sensors
        connected_sensors = sensors_for_component[comp.name]
        
        provided_measurements = set()
        for s in connected_sensors:
            m = s.measures
            if not m:
                continue
            if "." in m:
                # Fully qualified (e.g., input.temperature)
                if m not in required_measurements:
                    raise CrossValidationError(
                        f"Sensor '{s.name}' measures '{m}' which does not exist on component '{comp.name}'."
                    )
                provided_measurements.add(m)
            else:
                # Unscoped (e.g., temperature)
                matches = [req for req in required_measurements if req.endswith(f".{m}")]
                if len(matches) == 0:
                    raise CrossValidationError(
                        f"Sensor '{s.name}' measures '{m}' which is not found in any rating scope of '{comp.name}'."
                    )
                elif len(matches) > 1:
                    raise CrossValidationError(
                        f"Sensor '{s.name}' measures '{m}', but '{comp.name}' has multiple matching fields: "
                        f"{', '.join(sorted(matches))}. Please use a scoped name like '{matches[0]}' in measures."
                    )
                provided_measurements.add(matches[0])
        
        missing = required_measurements - provided_measurements
        
        if missing:
            raise CrossValidationError(
                f"Component '{comp.name}' is missing sensors for rating fields: {', '.join(sorted(missing))}. "
                f"Every rating field must have a connected sensor measuring it."
            )
