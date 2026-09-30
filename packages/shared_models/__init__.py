# packages/shared_models — authoritative enums, constants, and models for PolarTwin
from .constants import (
    SECONDS_PER_SIMULATION_TICK,
    SIMULATION_SECONDS_PER_HOUR,
    STANDARD_REAL_SECONDS_PER_TICK,
    TICKS_PER_SIMULATION_HOUR,
)
from .domain import (
    ALL_COMPONENT_TYPES,
    CONTAINER_TYPES,
    LEAF_COMPONENT_TYPES,
    SUPPORTED_CONNECTION_TYPES,
    CompiledConnection,
    ComponentSpec,
    HierarchyComponent,
    RatingValue,
    RuntimeComponent,
    RuntimeConnection,
)
from .enums import (
    ComponentStatus,
    ConnectionStatus,
    ConnectionType,
    ContainerType,
    LeafComponentType,
    SimulationStatus,
    TelemetrySource,
)
from .errors import (
    Diagnostic,
    DiagnosticBag,
    LexicalError,
    ParseError,
    PersistenceError,
    PolarTwinError,
    ReferenceResolutionError,
    ScenarioValidationError,
    SemanticValidationError,
    SimulationError,
    SourceLocation,
    UnitValidationError,
)
from .formulas import (
    ALPHA_AC,
    # Constants
    ALPHA_COMPONENT,
    ALPHA_INNER,
    ALPHA_SURR,
    BETA_AC_OUTPUT,
    BETA_THERMAL,
    GENERATOR_THRESHOLD,
    PUMP_THRESHOLD,
    STATION_MIN_SURR_DELTA,
    # Failure
    compute_a,
    compute_ac,
    # AC
    compute_ac_current,
    compute_ac_output_temperature,
    # Alarm
    compute_alarm_current,
    # Antenna
    compute_antenna_current,
    compute_container_temperature,
    compute_failure_countdown,
    compute_generator_allocation_ratio,
    compute_generator_flow_requirement,
    # Generator
    compute_generator_temperature,
    # Container
    compute_inner_temperature_average,
    compute_max_tolerated_value,
    # Power
    compute_power,
    compute_pump_allocation_ratio,
    compute_pump_temperature,
    # Pump
    compute_pump_total_demand,
    # Server
    compute_server_temperature,
    # Solar
    compute_solar_power,
    # Tolerance
    compute_specific_tolerance,
    compute_spf,
    # Station
    compute_station_surr_temperature,
    compute_t_off,
    # Tank
    compute_tank_volume,
    compute_vent_ac_contribution,
)
from .units import (
    ACCEPTED_UNITS,
    CANONICAL_UNITS,
    CONVERTERS,
    UnitConversionError,
    canonical_unit,
    to_canonical,
    validate_unit,
)

__all__ = [  # noqa: RUF022
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
