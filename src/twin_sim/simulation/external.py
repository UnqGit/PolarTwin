"""Deterministic evolution of external environmental configuration."""

from __future__ import annotations

from typing import Any
import datetime

class ExternalDataEvolver:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        
        # Track which supply ETAs we have already processed
        # To avoid firing the same event multiple times
        self._processed_supplies: set[int] = set()

    def evolve(self, timestamp: float) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        """
        Evaluate external configuration at the given simulation timestamp.
        Returns (current_state, external_events).
        """
        state: dict[str, Any] = {
            "weather": {},
            "network": {},
            "supplies": []
        }
        events: list[dict[str, Any]] = []

        # Weather
        if "weather" in self.config:
            for k, v in self.config["weather"].items():
                if isinstance(v, list):
                    state["weather"][k] = self._interpolate_time_series(v, timestamp)
                else:
                    state["weather"][k] = v

        # Network
        if "network" in self.config:
            for k, v in self.config["network"].items():
                if isinstance(v, list):
                    state["network"][k] = self._step_time_series(v, timestamp)
                else:
                    state["network"][k] = v

        # Supplies
        if "supplies" in self.config:
            unarrived = []
            for i, supply in enumerate(self.config["supplies"]):
                eta_ts = self._parse_iso8601_to_timestamp(supply["eta"])
                if timestamp >= eta_ts:
                    if i not in self._processed_supplies:
                        events.append({
                            "type": "SupplyArrived",
                            "supply": supply
                        })
                        self._processed_supplies.add(i)
                else:
                    unarrived.append((eta_ts, supply))

            unarrived.sort(key=lambda x: x[0])
            state["supplies"] = [u[1] for u in unarrived]
            if unarrived:
                state["next_supply"] = unarrived[0][1]

        return state, events

    def _interpolate_time_series(self, series: list[dict[str, Any]], timestamp: float) -> float:
        if not series:
            return 0.0
        if len(series) == 1:
            return float(series[0]["value"])
            
        # Find bracketing points
        # Assuming series is sorted by time
        if timestamp <= series[0]["time"]:
            return float(series[0]["value"])
        if timestamp >= series[-1]["time"]:
            return float(series[-1]["value"])
            
        for i in range(len(series) - 1):
            p1, p2 = series[i], series[i + 1]
            if p1["time"] <= timestamp <= p2["time"]:
                dt = p2["time"] - p1["time"]
                if dt == 0:
                    return float(p1["value"])
                frac = (timestamp - p1["time"]) / dt
                return float(p1["value"] + frac * (p2["value"] - p1["value"]))
        return 0.0
        
    def _step_time_series(self, series: list[dict[str, Any]], timestamp: float) -> Any:
        if not series:
            return None
        # Step function: use the value of the most recent point
        current_val = series[0]["value"]
        for p in series:
            if timestamp >= p["time"]:
                current_val = p["value"]
            else:
                break
        return current_val

    def _parse_iso8601_to_timestamp(self, iso_str: str) -> float:
        try:
            dt = datetime.datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
            return dt.timestamp()
        except ValueError:
            return 0.0
