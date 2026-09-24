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


# Supported connection types per specification §2.2
SUPPORTED_CONNECTION_TYPES = frozenset({"power", "data", "signal", "resource"})

# Connection syntax:
#   Source-->Target[type]@relation
#   Source<-->Target[type]@relation
#   Source-.->Target[type]@relation
#
# The [type] field specifies the connection type (power, data, signal, resource).
# Old syntax without [type] is rejected.
_CONNECTION_PATTERN = re.compile(
    r"^(\w+)\s*(-->|<-->|-\.->)\s*(\w+)\s*\[(\w+)\]\s*@\s*(\w+)\s*$"
)


def parse_connection_file(connection_file, topology_data):
    """
    Parse a connection.twin file and validate it against the topology data.

    Connection syntax (spec §2.4):
        Source-->Target[type]@relation
        Source<-->Target[type]@relation
        Source-.->Target[type]@relation

    The [type] field must be one of: power, data, signal, resource.
    Old syntax (Source-->Target@relation) without [type] is rejected.
    """

    # Extract all node names and their types from topology_data.
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

            m = _CONNECTION_PATTERN.match(line)

            if m:
                source, direction, target, conn_type, relation = m.groups()

                connections.append({
                    "source": source,
                    "target": target,
                    "type": conn_type,
                    "relation": relation,
                    "direction": direction,
                    "line": line_number,
                })
                continue

            raise ConnectionParseError(
                "Invalid connection syntax. "
                "Expected: Source-->Target[type]@relation "
                "where type is one of: power, data, signal, resource",
                line_number,
                line,
            )

    # ------------------------------------------------------------------
    # Validate connection references and type.
    # Connections may NOT have a floor node as either endpoint.
    # ------------------------------------------------------------------

    for connection in connections:
        source = connection["source"]
        target = connection["target"]
        conn_type = connection["type"]
        line_number = connection["line"]

        if source not in nodes:
            raise ConnectionParseError(
                f"Unknown source identifier '{source}' in connection. "
                f"Every connection endpoint must reference a defined node.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}[{conn_type}]@{connection['relation']}",
            )

        if target not in nodes:
            raise ConnectionParseError(
                f"Unknown target identifier '{target}' in connection. "
                f"Every connection endpoint must reference a defined node.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}[{conn_type}]@{connection['relation']}",
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
                f"{target}[{conn_type}]@{connection['relation']}",
            )

        if target_node["type"] == "floor":
            raise ConnectionParseError(
                f"Invalid connection: floor node '{target}' cannot be "
                f"used as a connection endpoint. "
                f"Connections cannot have a floor as either source or target.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}[{conn_type}]@{connection['relation']}",
            )

        if conn_type not in SUPPORTED_CONNECTION_TYPES:
            raise ConnectionParseError(
                f"Unsupported connection type '{conn_type}'. "
                f"Supported types: {sorted(SUPPORTED_CONNECTION_TYPES)}.",
                line_number,
                f"{source}{connection['direction']}"
                f"{target}[{conn_type}]@{connection['relation']}",
            )

        # Remove internal parser-only line number before returning.
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
