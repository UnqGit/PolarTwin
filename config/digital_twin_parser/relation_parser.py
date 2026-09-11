import re
import json
from pathlib import Path


# Types that are allowed to contain child nodes.
CONTAINER_TYPES = {
    "station",
    "block",
    "system",
    "subsystem",
}


class RelationParseError(Exception):
    """Raised when relation.txt contains invalid syntax or references."""

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


def parse_relation_file(filename):
    root = None
    stack = []

    # Every node is stored here by name.
    # Names MUST be globally unique.
    nodes = {}

    # Connections are parsed first and validated after all nodes
    # have been discovered.
    connections = []

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
            # Name:type %tag %tag {
            #
            # Example:
            # MainGrid:system %critical {
            # ---------------------------------------------------------

            m = re.match(
                r"^(\w+):(\w+)(?:\s+((?:%\w+\s*)+))?\s*\{$",
                line,
            )

            if m:
                name, node_type, tag_text = m.groups()

                # A block declaration must use a container type.
                if node_type not in CONTAINER_TYPES:
                    raise RelationParseError(
                        f"Type '{node_type}' cannot contain children. "
                        f"Only these types may use '{{...}}': "
                        f"{', '.join(sorted(CONTAINER_TYPES))}.",
                        line_number,
                        line,
                    )

                # Global identifier uniqueness.
                if name in nodes:
                    previous = nodes[name]["line"]

                    raise RelationParseError(
                        f"Duplicate identifier '{name}'. "
                        f"Identifiers must be globally unique. "
                        f"It was already defined on line {previous}.",
                        line_number,
                        line,
                    )

                tags = re.findall(r"%(\w+)", tag_text or "")

                node = {
                    "name": name,
                    "type": node_type,
                    "tags": tags,
                    "children": [],
                    "line": line_number,
                }

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
                stack.append(node)

                continue

            # ---------------------------------------------------------
            # Component
            #
            # Name:type %tag %tag
            #
            # Example:
            # VoltageSensor:sensor %monitoring
            # ---------------------------------------------------------

            m = re.match(
                r"^(\w+):(\w+)(?:\s+((?:%\w+\s*)+))?$",
                line,
            )

            if m:
                name, node_type, tag_text = m.groups()

                if not stack:
                    raise RelationParseError(
                        "Node declared outside of a block. "
                        "Only the root node may exist at the top level.",
                        line_number,
                        line,
                    )

                # Global identifier uniqueness.
                if name in nodes:
                    previous = nodes[name]["line"]

                    raise RelationParseError(
                        f"Duplicate identifier '{name}'. "
                        f"Identifiers must be globally unique. "
                        f"It was already defined on line {previous}.",
                        line_number,
                        line,
                    )

                tags = re.findall(r"%(\w+)", tag_text or "")

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
            # Connection
            #
            # Source-->Target@relation
            # Source<-->Target@relation
            # Source-.->Target@relation
            #
            # Whitespace around the arrow and @ is allowed.
            #
            # Examples:
            # A-->B@controls
            # A --> B @ controls
            # A<-->B@communicates
            # ---------------------------------------------------------

            m = re.match(
                r"^(\w+)\s*(-->|<-->|-\.\->)\s*(\w+)\s*@\s*(\w+)\s*$",
                line,
            )

            if m:
                source, direction, target, relation = m.groups()

                connections.append({
                    "source": source,
                    "target": target,
                    "type": relation,
                    "direction": direction,
                    "line": line_number,
                })

                continue

            # ---------------------------------------------------------
            # Better syntax errors
            # ---------------------------------------------------------

            if ":" not in line and any(
                arrow in line for arrow in ("-->", "<-->", "-.->", "<-->")
            ):
                raise RelationParseError(
                    "Invalid connection syntax. "
                    "Expected: Source-->Target@relation",
                    line_number,
                    line,
                )

            if ":" in line:
                raise RelationParseError(
                    "Invalid node syntax. "
                    "Expected: Name:type or Name:type {",
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
            f"Unclosed block for '{unclosed['name']}:{unclosed['type']}'. "
            f"Expected '}}' before the end of the file.",
            unclosed["line"],
        )

    # -------------------------------------------------------------
    # Validate connection references.
    # -------------------------------------------------------------

    for connection in connections:
        source = connection["source"]
        target = connection["target"]
        line_number = connection["line"]

        if source not in nodes:
            raise RelationParseError(
                f"Unknown source identifier '{source}' in connection. "
                f"Every connection endpoint must reference a defined node.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}@{connection['type']}",
            )

        if target not in nodes:
            raise RelationParseError(
                f"Unknown target identifier '{target}' in connection. "
                f"Every connection endpoint must reference a defined node.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}@{connection['type']}",
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

    # Remove internal parser-only line information before writing JSON.
    def clean_node(node):
        node.pop("line", None)

        for child in node["children"]:
            clean_node(child)

    clean_node(root)

    # Remove parser-only line information from connections.
    for connection in connections:
        connection.pop("line", None)

    root["connections"] = connections

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