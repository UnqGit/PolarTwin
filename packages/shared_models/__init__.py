# packages/shared_models — authoritative enums, constants, and models for PolarTwin
from .enums import (
    ComponentStatus,
    ConnectionStatus,
    ConnectionType,
    SimulationStatus,
    TelemetrySource,
    ContainerType,
    LeafComponentType,
)
from .constants import (
    SECONDS_PER_SIMULATION_TICK,
    TICKS_PER_SIMULATION_HOUR,
    SIMULATION_SECONDS_PER_HOUR,
    STANDARD_REAL_SECONDS_PER_TICK,
)
from .errors import (
    PolarTwinError,
    LexicalError,
    ParseError,
    SemanticValidationError,
    ReferenceResolutionError,
    UnitValidationError,
    ScenarioValidationError,
    SimulationError,
    PersistenceError,
    SourceLocation,
    Diagnostic,
    DiagnosticBag,
)
from .units import (
    to_canonical,
    validate_unit,
    canonical_unit,
    CONVERTERS,
    CANONICAL_UNITS,
    ACCEPTED_UNITS,
    UnitConversionError,
)
from .domain import (
    HierarchyComponent,
    CompiledConnection,
    RuntimeConnection,
    RatingValue,
    ComponentSpec,
    RuntimeComponent,
    CONTAINER_TYPES,
    LEAF_COMPONENT_TYPES,
    ALL_COMPONENT_TYPES,
    SUPPORTED_CONNECTION_TYPES,
)
from .formulas import (
    # Constants
    ALPHA_COMPONENT,
    BETA_THERMAL,
    ALPHA_INNER,
    ALPHA_SURR,
    ALPHA_AC,
    BETA_AC_OUTPUT,
    GENERATOR_THRESHOLD,
    PUMP_THRESHOLD,
    STATION_MIN_SURR_DELTA,
    # Tolerance
    compute_specific_tolerance,
    compute_spf,
    compute_max_tolerated_value,
    # Failure
    compute_a,
    compute_ac,
    compute_t_off,
    compute_failure_countdown,
    # Power
    compute_power,
    # Generator
    compute_generator_temperature,
    compute_generator_flow_requirement,
    compute_generator_allocation_ratio,
    # Pump
    compute_pump_total_demand,
    compute_pump_allocation_ratio,
    compute_pump_temperature,
    # Solar
    compute_solar_power,
    # Tank
    compute_tank_volume,
    # Antenna
    compute_antenna_current,
    # Server
    compute_server_temperature,
    # Alarm
    compute_alarm_current,
    # AC
    compute_ac_current,
    compute_ac_output_temperature,
    # Container
    compute_inner_temperature_average,
    compute_vent_ac_contribution,
    compute_container_temperature,
    # Station
    compute_station_surr_temperature,
)

__all__ = [
    # Enums
    "ComponentStatus", "ConnectionStatus", "ConnectionType",
    "SimulationStatus", "TelemetrySource", "ContainerType", "LeafComponentType",
    # Constants
    "SECONDS_PER_SIMULATION_TICK", "TICKS_PER_SIMULATION_HOUR",
    "SIMULATION_SECONDS_PER_HOUR", "STANDARD_REAL_SECONDS_PER_TICK",
    # Errors
    "PolarTwinError", "LexicalError", "ParseError", "SemanticValidationError",
    "ReferenceResolutionError", "UnitValidationError", "ScenarioValidationError",
    "SimulationError", "PersistenceError", "SourceLocation", "Diagnostic", "DiagnosticBag",
    # Units
    "to_canonical", "validate_unit", "canonical_unit",
    "CONVERTERS", "CANONICAL_UNITS", "ACCEPTED_UNITS", "UnitConversionError",
    # Domain
    "HierarchyComponent", "CompiledConnection", "RuntimeConnection",
    "RatingValue", "ComponentSpec", "RuntimeComponent",
    "CONTAINER_TYPES", "LEAF_COMPONENT_TYPES", "ALL_COMPONENT_TYPES", "SUPPORTED_CONNECTION_TYPES",
    # Formula constants
    "ALPHA_COMPONENT", "BETA_THERMAL", "ALPHA_INNER", "ALPHA_SURR",
    "ALPHA_AC", "BETA_AC_OUTPUT", "GENERATOR_THRESHOLD", "PUMP_THRESHOLD",
    "STATION_MIN_SURR_DELTA",
    # Formulas
    "compute_specific_tolerance", "compute_spf", "compute_max_tolerated_value",
    "compute_a", "compute_ac", "compute_t_off", "compute_failure_countdown",
    "compute_power",
    "compute_generator_temperature", "compute_generator_flow_requirement",
    "compute_generator_allocation_ratio",
    "compute_pump_total_demand", "compute_pump_allocation_ratio", "compute_pump_temperature",
    "compute_solar_power",
    "compute_tank_volume",
    "compute_antenna_current",
    "compute_server_temperature",
    "compute_alarm_current",
    "compute_ac_current", "compute_ac_output_temperature",
    "compute_inner_temperature_average", "compute_vent_ac_contribution",
    "compute_container_temperature",
    "compute_station_surr_temperature",
]
