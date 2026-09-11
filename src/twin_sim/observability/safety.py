"""Safety Rails and Invariant Monitoring."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from twin_sim.model import ComponentGraph


def _numeric_value(spec: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = spec.get(key, default)
    if isinstance(value, dict):
        value = value.get("value", value.get("max", default))
    return float(value) if isinstance(value, (int, float)) else default


@dataclass(frozen=True)
class SafetyViolation:
    rule: str
    severity: str
    component: str | None
    message: str


class SafetyError(Exception):
    """Raised when a SafetyMonitor detects a violation with 'error' severity."""


class SafetyMonitor:
    def __init__(self, rules: dict[str, str] | None = None) -> None:
        self.rules = rules or {}

    def _severity(self, rule: str, default: str = "error") -> str:
        return self.rules.get(rule, default)

    def evaluate(self, graph: ComponentGraph, environment: dict[str, Any] | None = None) -> list[SafetyViolation]:
        violations: list[SafetyViolation] = []
        
        # Check environment
        if environment and "temperature" in environment:
            temp = float(environment["temperature"])
            if temp < -100 or temp > 100:
                self._record(violations, "temperature_out_of_range", None, f"Environment temperature {temp} is out of physical model bounds (-100 to 100)")

        # Check components
        for name, component in graph.components.items():
            if component.type == "generator":
                fuel = component.runtime_state.values.get("fuel_level", 0.0)
                if fuel < 0:
                    self._record(violations, "negative_fuel", name, f"fuel level {fuel} is less than 0")
                
                # Check rating overload
                rating = _numeric_value(component.specification, "rating", 0.0)
                output = float(component.runtime_state.values.get("power_output", 0.0))
                if rating > 0 and output > rating:
                    self._record(violations, "generator_overload", name, f"output {output} exceeds rating {rating}")

            elif component.type == "battery":
                soc = component.runtime_state.values.get("soc", 0.0)
                if soc < 0:
                    self._record(violations, "battery_underflow", name, f"SOC {soc}% is less than 0%")
                elif soc > 100:
                    self._record(violations, "battery_overflow", name, f"SOC {soc}% exceeds 100%")

            elif component.type == "tank":
                volume = component.runtime_state.values.get("volume", 0.0)
                if volume < 0:
                    self._record(violations, "negative_volume", name, f"volume {volume} is less than 0")

        return violations

    def _record(self, violations: list[SafetyViolation], rule_id: str, component: str | None, msg: str) -> None:
        severity = self._severity(rule_id, "error")
        if severity != "ignore":
            violations.append(SafetyViolation(rule_id, severity, component, msg))

    def evaluate_and_enforce(self, graph: ComponentGraph, environment: dict[str, Any] | None = None) -> list[SafetyViolation]:
        violations = self.evaluate(graph, environment)
        for v in violations:
            if v.severity == "error":
                comp_prefix = f"[{v.component}] " if v.component else ""
                raise SafetyError(f"Safety violation ({v.rule}): {comp_prefix}{v.message}")
        return violations
