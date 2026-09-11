"""Transparent first-order physical behavior models for the MVP."""

from __future__ import annotations

from typing import Any

from .base import Behavior, BehaviorContext, SpecializedBehavior


def _value(spec: dict[str, Any], key: str, default: float) -> float:
    item = spec.get(key, default)
    if isinstance(item, dict):
        if isinstance(item.get("value"), (int, float)):
            return float(item["value"])
        if isinstance(item.get("max"), (int, float)):
            return float(item["max"])
    return float(item) if isinstance(item, (int, float)) else default


def _range(spec: dict[str, Any], key: str) -> tuple[float | None, float | None]:
    item = spec.get(key)
    if not isinstance(item, dict):
        return None, None
    minimum = item.get("min") if isinstance(item.get("min"), (int, float)) else None
    maximum = item.get("max") if isinstance(item.get("max"), (int, float)) else None
    return minimum, maximum


def _flatten(values: Any) -> dict[str, Any]:
    if not isinstance(values, dict):
        return {}
    result = dict(values)
    for item in values.values():
        if isinstance(item, dict):
            result.update(_flatten(item))
    return result


def _inputs(context: BehaviorContext) -> dict[str, Any]:
    return _flatten(context.values.get("inputs", {}))


class GeneratorPhysicalBehavior(SpecializedBehavior):
    name = "generator"

    def initialize(self, component, context):
        capacity = _value(component.specification, "fuel_capacity", 0.0)
        component.runtime_state.values.setdefault("fuel_level", capacity)
        component.runtime_state.values.setdefault("power_output", 0.0)
        component.runtime_state.values.setdefault("running", True)

    def evaluate(self, component, context, dt):
        spec = component.specification
        rating = _value(spec, "rating", _value(spec, "continuous_power", 0.0))
        current = component.runtime_state.values
        inputs = _inputs(context)
        command = inputs.get("power_command", inputs.get("command", current.get("power_command")))
        if not isinstance(command, (int, float)):
            command = None
        if command is None:
            command = rating if spec.get("role") != "backup" else 0.0
        multiplier = context.values.get("environment", {}).get("heating_demand_multiplier") or 1.0
        command *= float(multiplier)
        command = max(0.0, min(float(command), rating))
        fuel = max(0.0, float(current.get("fuel_level", _value(spec, "fuel_capacity", 0.0))))
        running = bool(current.get("running", True)) and component.runtime_state.available and fuel > 0
        output = command if running else 0.0
        consumption_l_per_hour = output * _value(spec, "fuel_rate", 0.25)
        fuel_next = max(0.0, fuel - consumption_l_per_hour * dt / 3600.0)
        return {
            "power_output": output,
            "fuel_consumption": consumption_l_per_hour,
            "fuel_level": fuel_next,
            "running": running and fuel_next > 0,
        }


class BatteryPhysicalBehavior(SpecializedBehavior):
    name = "battery"

    def initialize(self, component, context):
        component.runtime_state.values.setdefault("state_of_charge", 1.0)

    def evaluate(self, component, context, dt):
        spec = component.specification
        capacity = _value(spec, "capacity", 0.0)
        maximum_power = _value(spec, "maximum_power", float("inf"))
        state = component.runtime_state.values
        inputs = _inputs(context)
        charge_power = max(0.0, min(float(inputs.get("charge_power", 0.0)), maximum_power))
        discharge_power = max(0.0, min(float(inputs.get("discharge_power", 0.0)), maximum_power))
        soc = max(0.0, min(float(state.get("state_of_charge", 1.0)), 1.0))
        if capacity > 0:
            soc += (charge_power - discharge_power) * dt / 3600.0 / capacity
        soc = max(0.0, min(soc, 1.0))
        return {"state_of_charge": soc, "charge_power": charge_power, "discharge_power": discharge_power}


class SensorPhysicalBehavior(SpecializedBehavior):
    name = "sensor"

    def evaluate(self, component, context, dt):
        spec = component.specification
        inputs = _inputs(context)
        quantity = str(spec.get("quantity", "value"))
        environment = context.values.get("environment", {})
        true_value = inputs.get(
            quantity,
            inputs.get(
                "value",
                component.runtime_state.values.get(quantity, environment.get(quantity, 0.0)),
            ),
        )
        true_value = float(true_value) if isinstance(true_value, (int, float)) else 0.0
        accuracy = _value(spec, "accuracy", 0.0)
        noise = context.values["random"].gaussian(0.0, accuracy) if accuracy else 0.0
        observed = true_value + noise
        minimum, maximum = _range(spec, "rating")
        if minimum is not None:
            observed = max(minimum, observed)
        if maximum is not None:
            observed = min(maximum, observed)
        resolution = _value(spec, "resolution", 0.0)
        if resolution > 0:
            observed = round(observed / resolution) * resolution
        return {"measurement": observed, "quantity": quantity}


class InverterPhysicalBehavior(SpecializedBehavior):
    name = "inverter"

    def evaluate(self, component, context, dt):
        spec = component.specification
        inputs = _inputs(context)
        rating = _value(spec, "rating", float("inf"))
        efficiency_min, efficiency_max = _range(spec, "efficiency")
        efficiency = ((efficiency_min or 0.0) + (efficiency_max or 100.0)) / 200.0
        input_power = max(0.0, min(float(inputs.get("input_power", inputs.get("power", 0.0))), rating))
        return {"input_power": input_power, "output_power": input_power * efficiency, "efficiency": efficiency}


class BoundedActuatorBehavior(SpecializedBehavior):
    output_key = "output"

    def evaluate(self, component, context, dt):
        inputs = _inputs(context)
        minimum, maximum = _range(component.specification, self.output_key)
        command = float(inputs.get("command", inputs.get(self.output_key, 0.0)))
        command = max(minimum if minimum is not None else 0.0, command)
        if maximum is not None:
            command = min(command, maximum)
        if not component.runtime_state.available:
            command = 0.0
        return {self.output_key: command}


class HeaterPhysicalBehavior(BoundedActuatorBehavior):
    name = "heater"
    output_key = "thermal_output"


class FanPhysicalBehavior(BoundedActuatorBehavior):
    name = "fan"
    output_key = "airflow"


class PumpPhysicalBehavior(BoundedActuatorBehavior):
    name = "pump"
    output_key = "flow"


class TankPhysicalBehavior(SpecializedBehavior):
    name = "tank"

    def initialize(self, component, context):
        component.runtime_state.values.setdefault("level", _value(component.specification, "capacity", 0.0))

    def evaluate(self, component, context, dt):
        capacity = _value(component.specification, "capacity", float("inf"))
        inputs = _inputs(context)
        level = float(component.runtime_state.values.get("level", capacity))
        level += (float(inputs.get("inflow", 0.0)) - float(inputs.get("outflow", 0.0))) * dt
        return {"level": max(0.0, min(level, capacity))}


class StoragePhysicalBehavior(TankPhysicalBehavior):
    name = "storage"