from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class EventDefinition(BaseModel):
    """Represents a parsed .event file."""
    name: str
    target: str
    where: List[str] = Field(default_factory=list)
    
    # If the set block contains `fields`
    set_fields_allowed: bool = False
    
    # e.g., ["value", "values.temperature"]
    set_allowed: List[str] = Field(default_factory=list)
    
    # e.g., {"status": "failure", "values.voltage.output": 120}
    set_fixed: Dict[str, Any] = Field(default_factory=dict)

class SceneEvent(BaseModel):
    """Represents a single parsed event from a .scene file."""
    event_ref: str
    selector: Optional[str] = None
    at: float
    duration: float  # can be float('inf')
    
    # The payload built from the `set { ... }` block inside the scene
    payload: Dict[str, Any] = Field(default_factory=dict)
