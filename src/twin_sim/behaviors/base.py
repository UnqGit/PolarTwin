"""Behavior lifecycle contract used by the future simulation engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from twin_sim.model import Component


@dataclass
class BehaviorContext:
    values: dict[str, Any]


class Behavior:
    name = "generic"
    level = "generic"

    def initialize(self, component: Component, context: BehaviorContext) -> None:
        return None

    def step(self, component: Component, context: BehaviorContext, dt: float) -> None:
        return None

    def handle_event(self, component: Component, event: Any, context: BehaviorContext) -> None:
        return None

    def produce_telemetry(self, component: Component, context: BehaviorContext) -> dict[str, Any]:
        return {
            "component": component.name,
            "type": component.type,
            "behavior": self.name,
            "behavior_level": self.level,
            "state": dict(component.runtime_state.values),
            "health": component.runtime_state.health,
            "available": component.runtime_state.available,
        }


class GenericBehavior(Behavior):
    name = "generic"
    level = "generic"


class SpecializedBehavior(Behavior):
    level = "specialized"


class SensorBehavior(SpecializedBehavior):
    name = "sensor"


class ControllerBehavior(SpecializedBehavior):
    name = "controller"


class GeneratorBehavior(SpecializedBehavior):
    name = "generator"


class BatteryBehavior(SpecializedBehavior):
    name = "battery"


class InverterBehavior(SpecializedBehavior):
    name = "inverter"


class HeaterBehavior(SpecializedBehavior):
    name = "heater"


class FanBehavior(SpecializedBehavior):
    name = "fan"


class CoolerBehavior(SpecializedBehavior):
    name = "cooler"


class PumpBehavior(SpecializedBehavior):
    name = "pump"


class TankBehavior(SpecializedBehavior):
    name = "tank"


class StorageBehavior(SpecializedBehavior):
    name = "storage"


class ServerBehavior(SpecializedBehavior):
    name = "server"


class RouterBehavior(SpecializedBehavior):
    name = "router"


class VehicleBehavior(SpecializedBehavior):
    name = "vehicle"


class RobotBehavior(SpecializedBehavior):
    name = "robot"


class AlarmBehavior(SpecializedBehavior):
    name = "alarm"


class BeaconBehavior(SpecializedBehavior):
    name = "beacon"


class RadioBehavior(SpecializedBehavior):
    name = "radio"


class AntennaBehavior(SpecializedBehavior):
    name = "antenna"