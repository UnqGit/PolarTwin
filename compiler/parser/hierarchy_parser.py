import re
import json
from pathlib import Path
from packages.shared_models.domain import CONTAINER_TYPES, HierarchyComponent
from packages.shared_models.errors import ParseError

class HierarchyParseError(ParseError):
    """Raised when hierarchy.twin contains invalid syntax or references."""
    def __init__(self, message, line_number=None, line=None):
        error = message
        if line_number is not None:
            error = f"Line {line_number}: {message}"
            if line is not None:
                error += f"\n    {line}"
        super().__init__(error)
        self.line_number = line_number
        self.line = line


FLOOR_PARENT_TYPES = {"station", "block"}


def parse_modifiers(text: str, node_type: str, line_number: int, original_line: str):
    tags = []
    priority = None
    level = None
    backup_targets = []
    is_backup = False
    external_field = None
    
    text = text.strip()
    
    # We will repeatedly match the beginning of `text` and consume it.
    while text:
        text = text.lstrip()
        if not text:
            break
            
        m = re.match(r"@level\s*=\s*(-?\d+)", text)
        if m:
            level = int(m.group(1))
            text = text[m.end():]
            continue
            
        m = re.match(r"@(-?\d+)", text)
        if m:
            if priority is not None:
                raise HierarchyParseError("Multiple priority modifiers found.", line_number, original_line)
            priority = int(m.group(1))
            text = text[m.end():]
            continue
            
        m = re.match(r"%(\w+)", text)
        if m:
            tags.append(m.group(1))
            text = text[m.end():]
            continue
            
        m = re.match(r"backup\((.*?)\)", text)
        if m:
            if is_backup:
                raise HierarchyParseError("Multiple backup modifiers found.", line_number, original_line)
            is_backup = True
            targets = [t.strip() for t in m.group(1).split(",") if t.strip()]
            backup_targets.extend(targets)
            text = text[m.end():]
            continue
            
        m = re.match(r"external@([\w\.]+)", text)
        if m:
            if external_field is not None:
                raise HierarchyParseError("Multiple external references found.", line_number, original_line)
            external_field = m.group(1)
            text = text[m.end():]
            continue
            
        raise HierarchyParseError(
            f"Invalid or unrecognized modifier starting at: '{text[:15]}...'",
            line_number, original_line
        )

    # Validation
    if priority is None:
        raise HierarchyParseError("Priority '@<integer>' is required.", line_number, original_line)
    
    if node_type == "floor" and level is None:
        raise HierarchyParseError("Floor is missing required '@level=<integer>' attribute.", line_number, original_line)
        
    if node_type != "floor" and level is not None:
        raise HierarchyParseError("Only floors can use the '@level' attribute.", line_number, original_line)
        
    return tags, priority, level, is_backup, backup_targets, external_field


def parse_hierarchy_file(filename: Path) -> list[HierarchyComponent]:
    """Parse hierarchy.twin into a list of HierarchyComponent domain models."""
    stack = []
    components_by_name = {}
    components_output = []
    
    # Track which floors are in which parent to enforce uniqueness per parent
    floor_levels = {}

    with open(filename, "r", encoding="utf-8") as f:
        for line_number, raw in enumerate(f, start=1):
            line = raw.split("#", 1)[0].strip()

            if not line:
                continue

            if line == "}":
                if not stack:
                    raise HierarchyParseError(
                        "Unexpected '}'. There is no open block to close.",
                        line_number,
                        line,
                    )
                stack.pop()
                continue

            # Match component declaration: Name:type modifiers [ { ]
            # The regex splits Name:type, modifiers, and optional '{'
            m = re.match(r"^([A-Za-z_]\w*):([A-Za-z_]\w*)((?:\s+[^\{]+)?)\s*(\{)?$", line)
            
            if not m:
                # Better syntax errors
                if ":" not in line:
                    raise HierarchyParseError(
                        "Invalid node syntax. Expected: Name:type ...",
                        line_number,
                        line,
                    )
                raise HierarchyParseError(
                    "Invalid component declaration syntax.",
                    line_number,
                    line,
                )

            name, node_type, modifier_text, has_block = m.groups()
            
            # Uniqueness check
            if name in components_by_name:
                raise HierarchyParseError(
                    f"Duplicate identifier '{name}'. Identifiers must be globally unique.",
                    line_number,
                    line,
                )

            # Container block check
            if has_block and node_type not in CONTAINER_TYPES:
                raise HierarchyParseError(
                    f"Type '{node_type}' cannot contain children. Only these types may use '{{...}}': {', '.join(sorted(CONTAINER_TYPES))}.",
                    line_number,
                    line,
                )
                
            if not has_block and node_type in CONTAINER_TYPES:
                # Strictly speaking, a container without children might just be closed immediately `{}` or have no brackets. 
                # We'll allow it if no brackets, but normally they use `{}`. Let's not enforce `{}`.
                pass

            # Floor parent check
            if node_type == "floor":
                if not stack:
                    raise HierarchyParseError(
                        "A floor must be directly nested inside a station or block.",
                        line_number, line
                    )
                parent_type = stack[-1].type
                if parent_type not in FLOOR_PARENT_TYPES:
                    raise HierarchyParseError(
                        f"A floor cannot be nested inside '{parent_type}'. Floors may only be directly nested inside a station or block.",
                        line_number, line
                    )

            tags, priority, level, is_backup, backup_targets, external_field = parse_modifiers(
                modifier_text or "", node_type, line_number, line
            )
            
            parent_name = stack[-1].name if stack else None
            
            # Floor level uniqueness per parent
            if node_type == "floor":
                parent_id = parent_name
                if parent_id not in floor_levels:
                    floor_levels[parent_id] = {}
                if level in floor_levels[parent_id]:
                    raise HierarchyParseError(
                        f"Duplicate floor level '{level}' inside '{parent_name}'. Floor '{floor_levels[parent_id][level]}' already uses this level.",
                        line_number, line
                    )
                floor_levels[parent_id][level] = name

            # Build domain model
            component = HierarchyComponent(
                name=name,
                type=node_type,
                parent=parent_name,
                priority=priority,
                floor=level if level is not None else 0,
                is_backup=is_backup,
                backup=backup_targets,
                external_field=external_field,
                children=[],
                tags=tags,
            )
            
            # Link to parent
            if stack:
                stack[-1].children.append(name)
                
            components_by_name[name] = component
            components_output.append(component)

            if has_block:
                stack.append(component)

    if stack:
        unclosed = stack[-1]
        raise HierarchyParseError(
            f"Unclosed block for '{unclosed.name}:{unclosed.type}'. Expected '}}'.",
            None, None
        )

    return components_output


def generate_hierarchy_json(hierarchy_file: Path, output_file: Path):
    try:
        data = parse_hierarchy_file(hierarchy_file)
        
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Serialize list of HierarchyComponent
        json_data = [comp.to_dict() for comp in data]

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2)

        print(f"Created {output_file}")

    except HierarchyParseError as e:
        print(f"Error parsing {hierarchy_file}:")
        print(e)
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise
