import re
import json
from pathlib import Path
from packages.shared_models.domain import HierarchyComponent, CompiledConnection
from packages.shared_models.enums import ConnectionType
from packages.shared_models.errors import ParseError

class ConnectionParseError(ParseError):
    """Raised when connection.twin contains invalid syntax or references."""
    def __init__(self, message, line_number=None, line=None):
        error = message
        if line_number is not None:
            error = f"Line {line_number}: {message}"
            if line is not None:
                error += f"\n    {line}"
        super().__init__(error)
        self.line_number = line_number
        self.line = line

# Supported connection types per specification §2.2
SUPPORTED_CONNECTION_TYPES = frozenset({"power", "data", "signal", "resource"})

# Connection syntax: source:target[type]@relation
_CONNECTION_PATTERN = re.compile(
    r"^([A-Za-z_]\w*):([A-Za-z_]\w*)\[(\w+)\]@(\w+)$"
)

def parse_connection_file(connection_file: Path, hierarchy_components: list[HierarchyComponent]) -> list[CompiledConnection]:
    """
    Parse a connection.twin file and validate it against the topology data.

    Connection syntax (spec §2.1):
        source_node:target_node[connection_type]@relation

    The [type] field must be one of: power, data, signal, resource.
    """
    nodes = {comp.name: comp for comp in hierarchy_components}

    connections = []
    
    # Adjacency lists for topological validations
    incoming_counts = {name: 0 for name in nodes}
    outgoing_counts = {name: 0 for name in nodes}
    incoming_connections = {name: [] for name in nodes}
    outgoing_connections = {name: [] for name in nodes}

    with open(connection_file, "r", encoding="utf-8") as f:
        for line_number, raw in enumerate(f, start=1):
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue

            m = _CONNECTION_PATTERN.match(line)
            if not m:
                raise ConnectionParseError(
                    "Invalid connection syntax. Expected: source:target[type]@relation",
                    line_number, line
                )

            source, target, conn_type_str, relation = m.groups()

            # 1. Existence Validation
            if source not in nodes:
                raise ConnectionParseError(
                    f"Unknown source identifier '{source}'.", line_number, line
                )
            if target not in nodes:
                raise ConnectionParseError(
                    f"Unknown target identifier '{target}'.", line_number, line
                )

            # 2. Type Validation
            if conn_type_str not in SUPPORTED_CONNECTION_TYPES:
                raise ConnectionParseError(
                    f"Unsupported connection type '{conn_type_str}'. Supported: {sorted(SUPPORTED_CONNECTION_TYPES)}",
                    line_number, line
                )
                
            conn_type = ConnectionType(conn_type_str)

            # 3. No Self-Connections
            if source == target:
                raise ConnectionParseError(
                    f"Self-connections are prohibited. '{source}' connects to itself.",
                    line_number, line
                )

            conn = CompiledConnection(
                source=source,
                target=target,
                type=conn_type,
                relation=relation
            )
            
            connections.append(conn)
            
            incoming_counts[target] += 1
            outgoing_counts[source] += 1
            incoming_connections[target].append(conn)
            outgoing_connections[source].append(conn)

    # Topological validations
    for node_name, node in nodes.items():
        in_count = incoming_counts[node_name]
        out_count = outgoing_counts[node_name]
        in_conns = incoming_connections[node_name]
        out_conns = outgoing_connections[node_name]

        # Floor rules
        if node.type == "floor" and (in_count > 0 or out_count > 0):
            raise ConnectionParseError(
                f"Floor node '{node_name}' cannot participate in connections."
            )

        # Controller rules
        if node.type == "controller":
            for c in in_conns + out_conns:
                if c.type != ConnectionType.SIGNAL:
                    raise ConnectionParseError(
                        f"Controller '{node_name}' may only participate in signal connections."
                    )

        # Alarm rules
        if node.type == "alarm":
            if out_count > 0:
                raise ConnectionParseError(
                    f"Alarm '{node_name}' must not have any outgoing connections."
                )
            if in_count != 1:
                raise ConnectionParseError(
                    f"Alarm '{node_name}' must have exactly one incoming connection, found {in_count}."
                )
            if in_conns[0].type != ConnectionType.SIGNAL:
                raise ConnectionParseError(
                    f"Alarm '{node_name}' must have exactly one incoming SIGNAL connection."
                )

        # Sensor rules
        if node.type == "sensor":
            if in_count != 1:
                raise ConnectionParseError(
                    f"Sensor '{node_name}' must have exactly one incoming connection, found {in_count}."
                )
            if out_count != 1:
                raise ConnectionParseError(
                    f"Sensor '{node_name}' must have exactly one outgoing connection, found {out_count}."
                )
                
            for c in in_conns + out_conns:
                if c.type != ConnectionType.DATA:
                    raise ConnectionParseError(
                        f"Sensor '{node_name}' must only participate in data connections."
                    )
            
            target_node = nodes[out_conns[0].target]
            if target_node.type != "antenna":
                raise ConnectionParseError(
                    f"Sensor '{node_name}' outgoing connection must terminate at an antenna, but goes to '{target_node.name}' ({target_node.type})."
                )

    return connections

def generate_connection_json(connection_file: Path, hierarchy_components: list[HierarchyComponent], output_file: Path):
    try:
        data = parse_connection_file(connection_file, hierarchy_components)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        json_data = [conn.to_dict() for conn in data]

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2)

        print(f"Created {output_file}")
    except ConnectionParseError as e:
        print(f"Error parsing {connection_file}:")
        print(e)
        raise
