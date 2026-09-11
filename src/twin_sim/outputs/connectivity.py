"""Simulated network conditions for output delivery."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable


@dataclass
class ConnectivityPolicy:
    random_value: Callable[[], float] = random.random
    sleeper: Callable[[float], None] | None = None

    def allow(self, environment: dict) -> bool:
        connectivity = float(environment.get("connectivity", 1.0))
        packet_loss = float(environment.get("packet_loss", 0.0))
        probability = max(0.0, min(1.0, (1.0 - connectivity) + packet_loss))
        return self.random_value() >= probability

    def delay(self, environment: dict) -> float:
        latency_ms = float(environment.get("latency_ms", 0.0))
        delay = max(0.0, latency_ms / 1000.0)
        if delay and self.sleeper is not None:
            self.sleeper(delay)
        return delay