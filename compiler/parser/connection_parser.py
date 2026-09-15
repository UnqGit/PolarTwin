import re
import json
from pathlib import Path


class ConnectionParseError(Exception):
    """Raised when connection.twin contains invalid syntax or references."""
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


def parse_connection_file(connection_file, topology_data):
    """
    Parse a connection.twin file and validate it against the topology data.
    """
    
    # Extract all node names and their types from topology_data
    nodes = {}
    
    def extract_nodes(node):
        nodes[node["name"]] = node
        for child in node.get("children", []):
            extract_nodes(child)
            
    extract_nodes(topology_data)
    
    connections = []

    with open(connection_file, "r", encoding="utf-8") as f:
        for line_number, raw in enumerate(f, start=1):
            line = raw.split("#", 1)[0].strip()

            if not line:
                continue

            # Connection Syntax:
            # Source-->Target@relation
            # Source<-->Target@relation
            # Source-.->Target@relation
            
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
                
            raise ConnectionParseError(
                "Invalid connection syntax. "
                "Expected: Source-->Target@relation",
                line_number,
                line,
            )

    # -------------------------------------------------------------
    # Validate connection references.
    # Connections may NOT have a floor node as either endpoint.
    # -------------------------------------------------------------
    
    for connection in connections:
        source = connection["source"]
        target = connection["target"]
        line_number = connection["line"]

        if source not in nodes:
            raise ConnectionParseError(
                f"Unknown source identifier '{source}' in connection. "
                f"Every connection endpoint must reference a defined node.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}@{connection['type']}",
            )

        if target not in nodes:
            raise ConnectionParseError(
                f"Unknown target identifier '{target}' in connection. "
                f"Every connection endpoint must reference a defined node.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}@{connection['type']}",
            )

        source_node = nodes[source]
        target_node = nodes[target]

        if source_node["type"] == "floor":
            raise ConnectionParseError(
                f"Invalid connection: floor node '{source}' cannot be "
                f"used as a connection endpoint. "
                f"Connections cannot have a floor as either source or target.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}@{connection['type']}",
            )

        if target_node["type"] == "floor":
            raise ConnectionParseError(
                f"Invalid connection: floor node '{target}' cannot be "
                f"used as a connection endpoint. "
                f"Connections cannot have a floor as either source or target.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}@{connection['type']}",
            )

        # Clean up line number before returning
        connection.pop("line", None)

    return connections


def generate_connection_json(connection_file: Path, topology_data: dict, output_file: Path):
    try:
        data = parse_connection_file(connection_file, topology_data)

        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        print(f"Created {output_file}")

    except ConnectionParseError as e:
        print(f"Error parsing {connection_file}:")
        print(e)
        raise

    except FileNotFoundError as e:
        print(f"Error: File not found: {e.filename}")
        raise

    except OSError as e:
        print(f"File error: {e}")
        raise
