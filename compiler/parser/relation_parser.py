import re
import json
from pathlib import Path


# Types that are allowed to contain child nodes.
# Note: "subsystem" is NOT a valid container type (confirmed by spec).
CONTAINER_TYPES = {
    "campus",
    "station",
    "block",
    "floor",
    "system",
}


# A floor may only be directly nested inside one of these types.
FLOOR_PARENT_TYPES = {
    "station",
    "block",
}


class RelationParseError(Exception):
    """Raised when relation.twin contains invalid syntax or references."""

    def __init__(self, message, line_number=None, line=None):
        self.message = message
        self.line_number = line_number
        self.line = line

        if line_number is not None:
            error = f"Line {line_number}: {message}"

            if line is not None:
                error += f"\n    {line}"

            super().__init__(error)
        else:
            super().__init__(message)


def parse_modifiers(modifier_text, node_type, line_number, line):
    """
    Parse unordered node modifiers.

    Supported modifiers:

        %tag
        @level=<integer>

    Tags and @level may appear in any order.

    Examples:

        Floor1:floor @level=1 %public {
        Floor1:floor %public @level=1 {
        Floor1:floor %public %accessible @level=1 {
        Floor1:floor @level=1 %public %accessible {

    @level is only valid for floor nodes.
    A floor must have exactly one @level attribute.
    """

    tags = []
    levels = []

    if modifier_text:
        tokens = re.findall(
            r"%\w+|@level\s*=\s*-?\d+",
            modifier_text,
        )

        for token in tokens:
            token = token.strip()

            if token.startswith("%"):
                tags.append(token[1:])
                continue

            if token.startswith("@level"):
                match = re.fullmatch(
                    r"@level\s*=\s*(-?\d+)",
                    token,
                )

                if match:
                    levels.append(int(match.group(1)))

    # -------------------------------------------------------------
    # Validate @level
    # -------------------------------------------------------------

    if node_type == "floor":

        if not levels:
            raise RelationParseError(
                "Floor is missing required '@level' attribute. "
                "Expected syntax: Name:floor @level=<integer> {",
                line_number,
                line,
            )

        if len(levels) > 1:
            raise RelationParseError(
                "A floor may only have one '@level' attribute.",
                line_number,
                line,
            )

        level = levels[0]

    else:

        if levels:
            raise RelationParseError(
                f"Only a floor can use the '@level' attribute. "
                f"'{node_type}' does not support '@level'.",
                line_number,
                line,
            )

        level = None

    return tags, level


def parse_relation_file(filename):
    root = None
    stack = []

    # Every node is stored here by name.
    # Names MUST be globally unique.
    nodes = {}

    # Tracks floor levels within each immediate parent.
    #
    # Key:
    #     id(parent_node)
    #
    # Value:
    #     {level: floor_name}
    #
    # Floor names remain globally unique through `nodes`.
    #
    # Floor levels are only unique within their immediate
    # station/block parent.
    floor_levels = {}

    with open(filename, "r", encoding="utf-8") as f:

        for line_number, raw in enumerate(f, start=1):

            # Remove comments.
            line = raw.split("#", 1)[0].strip()

            if not line:
                continue

            # ---------------------------------------------------------
            # Close hierarchy block
            # ---------------------------------------------------------

            if line == "}":
                if not stack:
                    raise RelationParseError(
                        "Unexpected '}'. There is no open block to close.",
                        line_number,
                        line,
                    )

                stack.pop()
                continue

            # ---------------------------------------------------------
            # Container
            #
            # Normal:
            #
            # Name:type {
            # Name:type %tag %tag {
            #
            # Floor:
            #
            # Name:floor @level=1 {
            # Name:floor %tag @level=1 {
            # Name:floor @level=1 %tag {
            #
            # Tags and @level are intentionally unordered.
            # ---------------------------------------------------------

            m = re.match(
                r"^(\w+):(\w+)"
                r"((?:\s+(?:%\w+|@level\s*=\s*-?\d+))*)"
                r"\s*\{$",
                line,
            )

            if m:
                name, node_type, modifier_text = m.groups()

                # -----------------------------------------------------
                # Container type validation
                # -----------------------------------------------------

                if node_type not in CONTAINER_TYPES:
                    raise RelationParseError(
                        f"Type '{node_type}' cannot contain children. "
                        f"Only these types may use '{{...}}': "
                        f"{', '.join(sorted(CONTAINER_TYPES))}.",
                        line_number,
                        line,
                    )

                # -----------------------------------------------------
                # Floor-specific parent validation
                # -----------------------------------------------------

                if node_type == "floor":

                    # A floor cannot exist at the top level.
                    if not stack:
                        raise RelationParseError(
                            "A floor must be directly nested inside "
                            "a station or block.",
                            line_number,
                            line,
                        )

                    parent = stack[-1]

                    # A floor may only be directly inside a station/block.
                    if parent["type"] not in FLOOR_PARENT_TYPES:
                        raise RelationParseError(
                            f"A floor cannot be nested inside "
                            f"'{parent['type']}'. "
                            f"Floors may only be directly nested inside "
                            f"a station or block.",
                            line_number,
                            line,
                        )

                # -----------------------------------------------------
                # Parse tags and @level
                #
                # They may appear in any order.
                # -----------------------------------------------------

                tags, level = parse_modifiers(
                    modifier_text,
                    node_type,
                    line_number,
                    line,
                )

                # -----------------------------------------------------
                # Global identifier uniqueness
                #
                # This applies to floors as well.
                # -----------------------------------------------------

                if name in nodes:
                    previous = nodes[name]["line"]

                    raise RelationParseError(
                        f"Duplicate identifier '{name}'. "
                        f"Identifiers must be globally unique. "
                        f"It was already defined on line {previous}.",
                        line_number,
                        line,
                    )

                # -----------------------------------------------------
                # Create node
                # -----------------------------------------------------

                node = {
                    "name": name,
                    "type": node_type,
                    "tags": tags,
                    "children": [],
                    "line": line_number,
                }

                # Only floors receive a level property.
                if node_type == "floor":
                    node["level"] = level

                # -----------------------------------------------------
                # Add node to hierarchy
                # -----------------------------------------------------

                if stack:
                    stack[-1]["children"].append(node)

                else:
                    if root is not None:
                        raise RelationParseError(
                            "Multiple root nodes found. "
                            "A relation file must contain exactly one root node.",
                            line_number,
                            line,
                        )

                    root = node

                nodes[name] = node

                # -----------------------------------------------------
                # Validate/register floor level
                #
                # Level uniqueness is scoped to the immediate parent.
                #
                # Levels do NOT need to be consecutive.
                #
                # Example:
                #
                #   FloorA @level=1
                #   FloorB @level=4
                #
                # is valid.
                # -----------------------------------------------------

                if node_type == "floor":

                    parent = stack[-1]
                    parent_id = id(parent)

                    if parent_id not in floor_levels:
                        floor_levels[parent_id] = {}

                    if level in floor_levels[parent_id]:
                        previous_floor = floor_levels[parent_id][level]

                        raise RelationParseError(
                            f"Duplicate floor level '{level}' inside "
                            f"'{parent['name']}:{parent['type']}'. "
                            f"Floor '{previous_floor}' already uses "
                            f"this level.",
                            line_number,
                            line,
                        )

                    floor_levels[parent_id][level] = name

                stack.append(node)

                continue

            # ---------------------------------------------------------
            # Component
            #
            # Name:type
            # Name:type %tag
            # Name:type %tag %tag
            #
            # Components cannot use @level.
            # ---------------------------------------------------------

            m = re.match(
                r"^(\w+):(\w+)"
                r"((?:\s+%\w+)*)"
                r"\s*$",
                line,
            )

            if m:
                name, node_type, modifier_text = m.groups()

                if not stack:
                    raise RelationParseError(
                        "Node declared outside of a block. "
                        "Only the root node may exist at the top level.",
                        line_number,
                        line,
                    )

                # Give a clear error for @level on a component.
                if "@level" in line:
                    raise RelationParseError(
                        "The '@level' attribute is only valid for floors.",
                        line_number,
                        line,
                    )

                # -----------------------------------------------------
                # Global identifier uniqueness
                # -----------------------------------------------------

                if name in nodes:
                    previous = nodes[name]["line"]

                    raise RelationParseError(
                        f"Duplicate identifier '{name}'. "
                        f"Identifiers must be globally unique. "
                        f"It was already defined on line {previous}.",
                        line_number,
                        line,
                    )

                tags, _ = parse_modifiers(
                    modifier_text,
                    node_type,
                    line_number,
                    line,
                )

                node = {
                    "name": name,
                    "type": node_type,
                    "tags": tags,
                    "children": [],
                    "line": line_number,
                }

                stack[-1]["children"].append(node)
                nodes[name] = node

                continue

            # ---------------------------------------------------------
            # Better syntax errors
            # ---------------------------------------------------------

            if ":" in line:
                raise RelationParseError(
                    "Invalid node syntax. "
                    "Expected: Name:type, optionally followed by "
                    "%tags and/or @level=<integer>, then '{' for containers.",
                    line_number,
                    line,
                )

            raise RelationParseError(
                "Unrecognized syntax. Expected a node declaration, "
                "a block declaration, a connection, or '}'.",
                line_number,
                line,
            )

    # -------------------------------------------------------------
    # Check for unclosed blocks.
    # -------------------------------------------------------------

    if stack:
        unclosed = stack[-1]

        raise RelationParseError(
            f"Unclosed block for "
            f"'{unclosed['name']}:{unclosed['type']}'. "
            f"Expected '}}' before the end of the file.",
            unclosed["line"],
        )




    # -------------------------------------------------------------
    # Fallback root.
    # -------------------------------------------------------------

    if root is None:
        root = {
            "name": "Maitri",
            "type": "station",
            "tags": [],
            "children": [],
        }

    # -------------------------------------------------------------
    # Remove internal parser-only line information.
    # -------------------------------------------------------------

    def clean_node(node):
        node.pop("line", None)

        for child in node["children"]:
            clean_node(child)

    clean_node(root)

    return root


def generate_relation_json(relation_file: Path, output_file: Path):
    try:
        data = parse_relation_file(relation_file)

        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        print(f"Created {output_file}")

    except RelationParseError as e:
        print(f"Error parsing {relation_file}:")
        print(e)
        raise

    except FileNotFoundError as e:
        print(f"Error: File not found: {e.filename}")
        raise

    except OSError as e:
        print(f"File error: {e}")
        raise