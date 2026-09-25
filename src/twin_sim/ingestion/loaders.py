"""Load canonical simulator input documents and generate runtime models."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List, Dict, Optional

from .models import (
    RuntimeComponent,
    RuntimeConnection,
    ExternalModel,
    canonicalize_measurement
)

def load_json(path: str | Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_external(path: str | Path) -> ExternalModel:
    data = load_json(path)
    return ExternalModel.model_validate(data)

def generate_runtime_components(hierarchy: List[Dict[str, Any]], specs: List[Dict[str, Any]]) -> List[RuntimeComponent]:
    """
    Generate component.json structure from hierarchy and spec artifacts.
    Merges input, output, and state ratings into the 'value' dict, applying canonical unit conversions.
    """
    spec_map = {s["name"]: s for s in specs}
    runtime_components = []
    
    for comp in hierarchy:
        name = comp["name"]
        c_type = comp["type"]
        is_backup = comp.get("is_backup", False)
        
        value_dict = {}
        c_spec = spec_map.get(name, {})
        
        # Pull flat variables from spec extra if any
        for k, v in c_spec.items():
            if k not in ("name", "type", "rating", "dimension", "description", "representation", "measures", "extra"):
                value_dict[k] = canonicalize_measurement(v)
                
        # Pull dimensions
        if "dimension" in c_spec:
            for k, v in c_spec["dimension"].items():
                value_dict[k] = canonicalize_measurement(v)
                
        # Pull ratings
        if "rating" in c_spec:
            rating_block = c_spec["rating"]
            
            # We must group by field name if it appears in multiple scopes, e.g.
            # "temperature": { "state": 10, "output": 20 }
            
            # Pass 1: gather all fields
            field_origins = {}
            for scope in ["input", "output", "state"]:
                if scope in rating_block:
                    for f_name, f_val in rating_block[scope].items():
                        if f_name not in field_origins:
                            field_origins[f_name] = {}
                        field_origins[f_name][scope] = canonicalize_measurement(f_val)
                        
            # Pass 2: populate value_dict
            for f_name, origins in field_origins.items():
                if len(origins) == 1:
                    # Occurs in only one scope, flatten it
                    scope = list(origins.keys())[0]
                    value_dict[f_name] = origins[scope]
                else:
                    # Occurs in multiple scopes, nest it
                    value_dict[f_name] = origins
                    
        # Apply measures for sensors
        if "measures" in c_spec:
            value_dict["measures"] = c_spec["measures"]
            
        runtime_components.append(
            RuntimeComponent(
                name=name,
                type=c_type,
                is_backup=is_backup,
                status="active",
                value=value_dict
            )
        )
        
    return runtime_components

def generate_runtime_connections(compiled_connections: List[Dict[str, Any]]) -> List[RuntimeConnection]:
    """
    Generate runtime connection.json structure from compiled connections.
    """
    runtime_conns = []
    for c in compiled_connections:
        runtime_conns.append(
            RuntimeConnection(
                source=c["source"],
                target=c["target"],
                type=c["type"],
                status="active"
            )
        )
    return runtime_conns

def initialize_simulation_state(hierarchy_path: Path, connections_path: Path, specs_path: Path, external_path: Optional[Path] = None):
    hierarchy = load_json(hierarchy_path)
    connections = load_json(connections_path)
    specs = load_json(specs_path)
    
    runtime_components = generate_runtime_components(hierarchy, specs)
    runtime_connections = generate_runtime_connections(connections)
    
    external_state = load_external(external_path) if external_path and external_path.exists() else None
    
    return runtime_components, runtime_connections, external_state