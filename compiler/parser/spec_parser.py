import json
import re
from copy import deepcopy
from pathlib import Path

from packages.shared_models.domain import ComponentSpec, HierarchyComponent
from packages.shared_models.errors import ParseError

class SpecParseError(ParseError):
    def __init__(self, message, line_number=None, line=None):
        error = message
        if line_number is not None:
            error = f"Line {line_number}: {message}"
            if line is not None:
                error += f"\n    {line}"
        super().__init__(error)
        self.line_number = line_number
        self.line = line

NUMBER_PATTERN = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)"
BARE_WORD_PATTERN = r"[A-Za-z_][A-Za-z0-9_]*"
UNIT_PATTERN = r"(?:[A-Za-z_][A-Za-z0-9_]*(?:/[A-Za-z0-9_]+)*|%)"

PROPERTY_PATTERN = re.compile(
    rf"""
    (?P<key>[A-Za-z_]\w*)
    \s*=\s*
    (?P<value>
        "(?:\\.|[^"])*"
        |
        '(?:\\.|[^'])*'
        |
        {NUMBER_PATTERN}\s*:\s*{NUMBER_PATTERN}
        |
        {NUMBER_PATTERN}
        |
        {UNIT_PATTERN}
    )
    """,
    re.VERBOSE
)

def convert_number(value):
    number = float(value)
    return int(number) if number.is_integer() else number

def convert(value):
    value = value.strip()
    if not value: return ""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    if value.lower() == "true": return True
    if value.lower() == "false": return False

    range_match = re.fullmatch(rf"({NUMBER_PATTERN})\s*:\s*({NUMBER_PATTERN})", value)
    if range_match:
        minimum = convert_number(range_match.group(1))
        maximum = convert_number(range_match.group(2))
        if minimum > maximum:
            raise ValueError(f"Invalid range '{value}': minimum cannot be greater than maximum")
        return {"min": minimum, "max": maximum}

    if re.fullmatch(NUMBER_PATTERN, value): return convert_number(value)
    if re.fullmatch(BARE_WORD_PATTERN, value): return value
    if re.fullmatch(UNIT_PATTERN, value): return value

    raise ValueError(
        f"Invalid unquoted value '{value}'. Values containing spaces "
        "or unsupported special characters must be quoted."
    )

def tokenize_properties(text):
    tokens = []
    position = 0
    for match in PROPERTY_PATTERN.finditer(text):
        garbage = text[position:match.start()].strip()
        if garbage:
            raise ValueError(f"Invalid property syntax near '{garbage}'")
        key = match.group("key")
        value = convert(match.group("value"))
        tokens.append((key, value))
        position = match.end()

    garbage = text[position:].strip()
    if garbage:
        raise ValueError(f"Invalid property syntax near '{garbage}'")
    return tokens

def build_properties(text):
    tokens = tokenize_properties(text)
    result = {}
    i = 0
    while i < len(tokens):
        key, value = tokens[i]
        if key == "unit":
            raise ValueError("unit= must immediately follow a numeric or range property")

        if i + 1 < len(tokens) and tokens[i + 1][0] == "unit":
            unit = tokens[i + 1][1]
            if not isinstance(unit, str):
                raise ValueError(f"unit for '{key}' must be a string")
            if isinstance(value, dict):
                measurement = {**value, "unit": unit}
            elif isinstance(value, (int, float)):
                measurement = {"value": value, "unit": unit}
            else:
                raise ValueError(f"Property '{key}' has a unit but its value is not numeric or a range")
            if key in result:
                raise ValueError(f"Duplicate property '{key}'")
            result[key] = measurement
            i += 2
            continue

        if key in result:
            raise ValueError(f"Duplicate property '{key}'")
        result[key] = value
        i += 1

    return result

def deep_merge(base: dict, override: dict) -> dict:
    result = deepcopy(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result

def parse_spec_file(spec_file: Path, hierarchy_components: list[HierarchyComponent]) -> list[ComponentSpec]:
    defaults = {}
    components = {}

    current_name = None
    current_type = None
    current_props = {}
    current_is_default = False
    
    current_scope = None # None, "rating@input", "rating@output", "rating@state", "dimension"

    # State machine
    with open(spec_file, "r", encoding="utf-8") as f:
        for line_number, raw in enumerate(f, start=1):
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
                
            try:
                # Block end
                if line == "}":
                    if current_name is None:
                        raise ValueError("unexpected '}' outside of component block")
                        
                    if current_scope is not None:
                        current_scope = None
                        continue
                        
                    if current_is_default:
                        defaults[current_type] = deepcopy(current_props)
                    else:
                        components[current_name] = {
                            "type": current_type,
                            "props": deepcopy(current_props)
                        }

                    current_name = None
                    current_type = None
                    current_props = {}
                    current_is_default = False
                    continue

                # Inner block start
                if line.endswith("{") and current_name is not None:
                    if current_scope is not None:
                        raise ValueError("nested blocks are not allowed")
                    
                    scope_name = line[:-1].strip()
                    if scope_name not in {"rating@input", "rating@output", "rating@state", "dimension"}:
                        raise ValueError(f"unsupported inner scope '{scope_name}'. Supported: rating@input, rating@output, rating@state, dimension")
                    
                    current_scope = scope_name
                    continue
                    
                # Component block start
                if line.endswith("{"):
                    header = line[:-1].strip()
                    
                    # check default
                    m_default = re.fullmatch(r"default:([A-Za-z_]\w*)", header)
                    if m_default:
                        c_type = m_default.group(1)
                        if c_type in defaults:
                            raise ValueError(f"duplicate default:{c_type}")
                        current_name = header
                        current_type = c_type
                        current_is_default = True
                        current_props = {"rating": {}, "dimension": {}, "extra": {}}
                        continue
                        
                    # check explicit component
                    m_comp = re.match(r"^([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)(?:\s+(.*))?$", header)
                    if m_comp:
                        name, c_type, prop_text = m_comp.groups()
                        if name in components:
                            raise ValueError(f"duplicate component '{name}'")
                        current_name = name
                        current_type = c_type
                        current_is_default = False
                        current_props = {"rating": {}, "dimension": {}, "extra": {}}
                        if prop_text:
                            # Apply inline properties (like measures=voltage)
                            inline_props = build_properties(prop_text)
                            current_props["extra"].update(inline_props)
                        continue
                        
                    raise ValueError(f"invalid component declaration '{header}'")
                    
                # Single line component properties
                if current_name is None:
                    m_comp = re.match(r"^([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)(?:\s+(.*))?$", line)
                    if m_comp:
                        name, c_type, prop_text = m_comp.groups()
                        if name in components:
                            raise ValueError(f"duplicate component '{name}'")
                        
                        props = {"rating": {}, "dimension": {}, "extra": {}}
                        if prop_text:
                            props["extra"].update(build_properties(prop_text))
                            
                        components[name] = {
                            "type": c_type,
                            "props": props
                        }
                        continue
                    raise ValueError(f"invalid syntax '{line}' outside of block")

                # Properties inside block
                props = build_properties(line)
                if current_scope is None:
                    current_props["extra"].update(props)
                elif current_scope.startswith("rating@"):
                    sub_scope = current_scope.split("@")[1] # input, output, state
                    if sub_scope not in current_props["rating"]:
                        current_props["rating"][sub_scope] = {}
                    current_props["rating"][sub_scope].update(props)
                elif current_scope == "dimension":
                    for k in props:
                        if k not in {"length", "width", "height"}:
                            raise ValueError(f"unsupported dimension property '{k}'. Only length, width, height allowed.")
                    current_props["dimension"].update(props)
                
            except ValueError as e:
                raise SpecParseError(str(e), line_number, line)
                
    if current_name is not None:
        raise SpecParseError(f"unclosed block for '{current_name}'", None, None)

    # Resolve CSS-like inheritance and convert to ComponentSpec models
    hierarchy_nodes = {comp.name: comp for comp in hierarchy_components}
    
    # Validation: all explicit components in spec.twin must exist in hierarchy
    for comp_name in components:
        if comp_name not in hierarchy_nodes:
            raise SpecParseError(f"component '{comp_name}' is defined in spec.twin but missing from hierarchy.twin")

    result = []
    
    for comp in hierarchy_components:
        comp_type = comp.type
        
        # 1. Start with empty base
        base_props = {"rating": {}, "dimension": {}, "extra": {}}
        
        # 2. Merge defaults
        if comp_type in defaults:
            base_props = deep_merge(base_props, defaults[comp_type])
            
        # 3. Merge explicit component overrides
        if comp.name in components:
            base_props = deep_merge(base_props, components[comp.name]["props"])
            
        # Construct ComponentSpec
        extra = base_props.get("extra", {})
        desc = extra.pop("description", "")
        rep = extra.pop("representation", "")
        measures = extra.pop("measures", None)
        
        # Sensor specific rule
        if comp_type == "sensor" and not measures:
            raise SpecParseError(f"sensor '{comp.name}' must define a 'measures' property")
            
        spec = ComponentSpec(
            name=comp.name,
            type=comp_type,
            rating=base_props.get("rating", {}),
            dimension=base_props.get("dimension", {}),
            description=desc,
            representation=rep,
            measures=measures,
            extra=extra
        )
        result.append(spec)

    return result

def generate_spec_json(spec_file: Path, hierarchy_components: list[HierarchyComponent], output_file: Path):
    try:
        data = parse_spec_file(spec_file, hierarchy_components)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        json_data = [spec.to_dict() for spec in data]
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2)

        print(f"Created {output_file}")
    except SpecParseError as e:
        print(f"Error parsing {spec_file}:")
        print(e)
        raise