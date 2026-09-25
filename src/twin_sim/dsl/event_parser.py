from pathlib import Path
import re
from typing import List, Dict, Any

from packages.shared_models.errors import ParseError
from twin_sim.dsl.models import EventDefinition

class EventParseError(ParseError):
    def __init__(self, message, line_number=None, line=None):
        error = message
        if line_number is not None:
            error = f"Line {line_number}: {message}"
            if line is not None:
                error += f"\n    {line}"
        super().__init__(error)

def parse_value(v: str) -> Any:
    # Quick utility to convert string to int, float, bool, or leave as string
    v = v.strip()
    if v.lower() == "true": return True
    if v.lower() == "false": return False
    if v.lower() == "inf": return float('inf')
    try:
        if "." in v: return float(v)
        return int(v)
    except ValueError:
        # maybe quoted
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            return v[1:-1]
        return v

def parse_event_file(filepath: Path) -> EventDefinition:
    name = filepath.stem
    target = ""
    wheres = []
    set_fields_allowed = False
    set_allowed = []
    set_fixed = {}
    
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    i = 0
    in_set_block = False
    while i < len(lines):
        line = lines[i].split("#", 1)[0].strip()
        i += 1
        
        if not line:
            continue
            
        if line == "}":
            if not in_set_block:
                raise EventParseError("Unexpected '}'", i, line)
            in_set_block = False
            continue
            
        if in_set_block:
            if line == "fields":
                set_fields_allowed = True
            elif "=" in line:
                key, val = line.split("=", 1)
                set_fixed[key.strip()] = parse_value(val)
            else:
                set_allowed.append(line)
            continue
            
        if line.startswith("target "):
            target = line[len("target "):].strip()
        elif line.startswith("where "):
            wheres.append(line[len("where "):].strip())
        elif line.startswith("& "):
            wheres.append(line[len("& "):].strip())
        elif line.startswith("set "):
            remainder = line[len("set "):].strip()
            if remainder == "fields":
                set_fields_allowed = True
            elif remainder == "{":
                in_set_block = True
            elif "=" in remainder:
                key, val = remainder.split("=", 1)
                set_fixed[key.strip()] = parse_value(val)
            else:
                raise EventParseError("Invalid set clause without block or assignment", i, line)
        else:
            raise EventParseError("Unrecognized line", i, line)
            
    if not target:
        raise EventParseError("Missing 'target' clause", None, None)
    if in_set_block:
        raise EventParseError("Unclosed 'set' block", None, None)
        
    return EventDefinition(
        name=name,
        target=target,
        where=wheres,
        set_fields_allowed=set_fields_allowed,
        set_allowed=set_allowed,
        set_fixed=set_fixed
    )
