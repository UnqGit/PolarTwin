"""Behavior contracts and registry-based inference."""

from .base import Behavior, BehaviorContext, GenericBehavior
from .inference import BehaviorResolution, infer_behaviors
from .registry import BehaviorRegistry, default_registry

__all__ = [
    "Behavior",
    "BehaviorContext",
    "GenericBehavior",
    "BehaviorResolution",
    "BehaviorRegistry",
    "default_registry",
    "infer_behaviors",
]