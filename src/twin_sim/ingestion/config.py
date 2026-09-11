"""Runtime configuration loader and validator."""

import json
from pathlib import Path
from typing import Any

from .validator import ValidationError, _object, _string


def validate_runtime_config(config: Any) -> dict[str, Any]:
    root = _object(config, "runtime config")
    
    for field in ("mode", "tick_interval", "time_scale", "outputs"):
        if field not in root:
            raise ValidationError(f"runtime config is missing required field '{field}'")
            
    mode = _string(root["mode"], "runtime_config.mode")
    if mode not in ("simulator", "generator"):
        raise ValidationError(f"runtime config mode must be 'simulator' or 'generator', got {mode}")
        
    if not isinstance(root["tick_interval"], (int, float)) or root["tick_interval"] <= 0:
        raise ValidationError("runtime config tick_interval must be a number > 0")
        
    if not isinstance(root["time_scale"], (int, float)) or root["time_scale"] <= 0:
        raise ValidationError("runtime config time_scale must be a number > 0")
        
    if not isinstance(root["outputs"], list):
        raise ValidationError("runtime config outputs must be an array")
        
    for idx, output in enumerate(root["outputs"]):
        item = _object(output, f"runtime_config.outputs[{idx}]")
        if "type" not in item:
            raise ValidationError(f"runtime config outputs[{idx}] is missing required field 'type'")
            
    return root


def load_runtime_config(path: Path | str) -> dict[str, Any]:
    """Load and validate a runtime configuration JSON file."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Runtime configuration file not found: {path}")

    try:
        with path.open("r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        raise ValidationError(f"Invalid JSON in {path}: {e}")

    return validate_runtime_config(config)
