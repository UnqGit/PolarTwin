"""
Authoritative enums for PolarTwin.
These match the specification exactly and must not be changed without
updating every consumer.
"""

from enum import Enum


class ComponentStatus(str, Enum):
    """Component operational status (spec §5.2, §0.3)."""

    INACTIVE = "inactive"
    ACTIVE = "active"
    FAILURE = "failure"


class ConnectionStatus(str, Enum):
    """Connection operational status (spec §6.1, §0.3)."""

    INACTIVE = "inactive"
    ACTIVE = "active"
    FAILURE = "failure"


class ConnectionType(str, Enum):
    """Supported connection types (spec §2.2, §0.3)."""

    POWER = "power"
    DATA = "data"
    SIGNAL = "signal"
    RESOURCE = "resource"


class SimulationStatus(str, Enum):
    """Simulation lifecycle status (spec §7.5.1, §0.3).
    
    Note: The implementation_plan adds Ready/Running/Paused/Completed/Error.
    The existing engine used STOPPED instead of COMPLETED; the spec defines
    Completed and Error explicitly, so those are authoritative.
    """

    READY = "ready"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class TelemetrySource(str, Enum):
    """Telemetry origin (spec §Telemetry Publishing, §0.3)."""

    SIMULATION = "SIMULATION"
    LIVE = "LIVE"


class ContainerType(str, Enum):
    """Supported container types (spec §1.2)."""

    CAMPUS = "campus"
    STATION = "station"
    FLOOR = "floor"
    BLOCK = "block"
    SYSTEM = "system"


class LeafComponentType(str, Enum):
    """Supported internal/leaf component types (spec §1.3)."""

    SENSOR = "sensor"
    ANTENNA = "antenna"
    GENERATOR = "generator"
    CONTROLLER = "controller"
    TANK = "tank"
    PUMP = "pump"
    STORAGE = "storage"
    VENT = "vent"
    ALARM = "alarm"
    SERVER = "server"
    VEHICLE = "vehicle"
    SOLAR_PANEL = "solar_panel"
    AIR_CONDITIONER = "air_conditioner"
