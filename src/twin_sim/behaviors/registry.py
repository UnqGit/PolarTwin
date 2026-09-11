"""Extensible behavior registry independent of component names."""

from __future__ import annotations

from collections.abc import Callable

from .base import (
    AlarmBehavior,
    AntennaBehavior,
    BatteryBehavior,
    BeaconBehavior,
    Behavior,
    ControllerBehavior,
    CoolerBehavior,
    FanBehavior,
    GeneratorBehavior,
    GenericBehavior,
    HeaterBehavior,
    InverterBehavior,
    PumpBehavior,
    RadioBehavior,
    RobotBehavior,
    RouterBehavior,
    SensorBehavior,
    ServerBehavior,
    StorageBehavior,
    TankBehavior,
    VehicleBehavior,
)
from .physical import (
    BatteryPhysicalBehavior,
    FanPhysicalBehavior,
    GeneratorPhysicalBehavior,
    HeaterPhysicalBehavior,
    InverterPhysicalBehavior,
    PumpPhysicalBehavior,
    SensorPhysicalBehavior,
    StoragePhysicalBehavior,
    TankPhysicalBehavior,
)

BehaviorFactory = Callable[[], Behavior]


class BehaviorRegistry:
    def __init__(self) -> None:
        self._factories: dict[str, BehaviorFactory] = {}
        self.register("generic", GenericBehavior)

    def register(self, name: str, factory: BehaviorFactory) -> None:
        if not name:
            raise ValueError("behavior name must not be empty")
        if name in self._factories:
            raise ValueError(f"behavior '{name}' is already registered")
        self._factories[name] = factory

    def contains(self, name: str) -> bool:
        return name in self._factories

    def create(self, name: str) -> Behavior:
        try:
            return self._factories[name]()
        except KeyError as exc:
            raise KeyError(f"unknown behavior '{name}'") from exc


def default_registry() -> BehaviorRegistry:
    registry = BehaviorRegistry()
    for behavior_class in (
        SensorPhysicalBehavior,
        ControllerBehavior,
        GeneratorPhysicalBehavior,
        BatteryPhysicalBehavior,
        InverterPhysicalBehavior,
        HeaterPhysicalBehavior,
        FanPhysicalBehavior,
        CoolerBehavior,
        PumpPhysicalBehavior,
        TankPhysicalBehavior,
        StoragePhysicalBehavior,
        ServerBehavior,
        RouterBehavior,
        VehicleBehavior,
        RobotBehavior,
        AlarmBehavior,
        BeaconBehavior,
        RadioBehavior,
        AntennaBehavior,
    ):
        registry.register(behavior_class.name, behavior_class)
    return registry