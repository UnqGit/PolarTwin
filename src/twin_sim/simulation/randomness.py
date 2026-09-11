"""Seeded randomness owned by a simulation run."""

from __future__ import annotations

import random
from typing import Any


class RandomSource:
    def __init__(self, seed: int | None = None) -> None:
        self.seed = seed
        self._random = random.Random(seed)

    def random(self) -> float:
        return self._random.random()

    def uniform(self, low: float, high: float) -> float:
        return self._random.uniform(low, high)

    def gaussian(self, mean: float = 0.0, standard_deviation: float = 1.0) -> float:
        return self._random.gauss(mean, standard_deviation)

    def choice(self, values: list[Any]) -> Any:
        return self._random.choice(values)
