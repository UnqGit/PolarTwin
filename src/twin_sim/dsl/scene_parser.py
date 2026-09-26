from pathlib import Path
import re
from typing import List, Dict, Any

from packages.shared_models.errors import ParseError
from twin_sim.dsl.models import SceneEvent
from twin_sim.dsl.event_parser import parse_value

class SceneParseError(ParseError):
    def __init__(self, message, line_number=None, line=None):
        error = message
        if line_number is not None:
            error = f"Line {line_number}: {message}"
            if line is not None:
                error += f"\n    {line}"
        super().__init__(error)
        self.line_number = line_number

def parse_scene_string(source: str) -> List[SceneEvent]:
    events = []
    lines = source.splitlines()
        
    i = 0
    current_event = None
    # block stack tracks dictionaries for nested blocks: [root_dict, inner_dict1, ...]
    block_stack = [] 
    
    while i < len(lines):
        line = lines[i].split("#", 1)[0].strip()
        i += 1
        
        if not line:
            continue
            
        if line == "}":
            if not block_stack:
                raise SceneParseError("Unexpected '}'", i, line)
            
            # Pop the current dict
            completed_dict = block_stack.pop()
            
            if not block_stack:
                # We finished the outermost block (which should be the scene payload)
                assert current_event is not None
                current_event.payload = completed_dict.get("set", {})
                events.append(current_event)
                current_event = None
            continue
            
        if line.endswith("{"):
            block_name = line[:-1].strip()
            
            if current_event is None:
                # This must be an event line that ends with {
                # e.g. event:set_component @Generator1 at=1.2 for=inf {
                m = re.match(r"^event:([A-Za-z_]\w*)(?:\s+(@\S+))?\s+at=([\d\.]+)\s+for=(inf|[\d\.]+)\s*\{$", line)
                if not m:
                    raise SceneParseError("Invalid scene event declaration with block", i, line)
                    
                e_ref, sel, at_str, for_str = m.groups()
                current_event = SceneEvent(
                    event_ref=e_ref,
                    selector=sel,
                    at=float(at_str),
                    duration=float('inf') if for_str == "inf" else float(for_str),
                    payload={},
                    source_location=i,
                    source_order=len(events)
                )
                block_stack.append({})
            else:
                # Nested dict
                new_dict = {}
                block_stack[-1][block_name] = new_dict
                block_stack.append(new_dict)
            continue
            
        if current_event is not None and block_stack:
            # We are inside a block, this should be key=value
            if "=" in line:
                key, val = line.split("=", 1)
                block_stack[-1][key.strip()] = parse_value(val)
            else:
                raise SceneParseError("Expected key=value assignment in block", i, line)
            continue
            
        # Single line event
        # e.g. event:failure @Generator1 at=1.0 for=2.0
        m = re.match(r"^event:([A-Za-z_]\w*)(?:\s+(@\S+))?\s+at=([\d\.]+)\s+for=(inf|[\d\.]+)$", line)
        if m:
            e_ref, sel, at_str, for_str = m.groups()
            events.append(SceneEvent(
                event_ref=e_ref,
                selector=sel,
                at=float(at_str),
                duration=float('inf') if for_str == "inf" else float(for_str),
                payload={},
                source_location=i,
                source_order=len(events)
            ))
            continue
            
        raise SceneParseError("Unrecognized scene line format", i, line)
        
    if current_event is not None or block_stack:
        raise SceneParseError("Unclosed event block at end of file", None, None)
        
    # Sort events by 'at' time (stable sort based on source_order)
    return sorted(events, key=lambda e: (e.at, e.source_order))

def parse_scene_file(filepath: Path) -> List[SceneEvent]:
    with open(filepath, "r", encoding="utf-8") as f:
        return parse_scene_string(f.read())

