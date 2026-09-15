"""
Cross-validate generated relation.json and spec.json for a digital twin.

This validator is intentionally independent from relation_parser.py and
spec_parser.py. It operates on their generated JSON output.

Expected files:

    config/
    └── twins/
        └── <twin>/
            ├── relation.json
            ├── connection.json
            └── spec.json

Usage:

    python validate_twin.py <twin>

Example:

    python validate_twin.py refinery
"""

import argparse
import json
from pathlib import Path
from collections import Counter


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

CONFIG_DIR = Path(__file__).resolve().parent.parent
TWINS_DIR = CONFIG_DIR / "twins"


# ---------------------------------------------------------------------------
# Validation result
# ---------------------------------------------------------------------------

class ValidationResult:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, message):
        self.errors.append(message)

    def warning(self, message):
        self.warnings.append(message)

    @property
    def valid(self):
        return not self.errors

    def print_report(self):
        print()
        print("=" * 72)
        print("DIGITAL TWIN VALIDATION REPORT")
        print("=" * 72)

        if self.errors:
            print()
            print(f"ERRORS ({len(self.errors)})")
            print("-" * 72)

            for index, error in enumerate(self.errors, start=1):
                print(f"[ERROR {index}] {error}")

        if self.warnings:
            print()
            print(f"WARNINGS ({len(self.warnings)})")
            print("-" * 72)

            for index, warning in enumerate(self.warnings, start=1):
                print(f"[WARNING {index}] {warning}")

        print()
        print("-" * 72)

        if self.valid:
            print("RESULT: VALID")
        else:
            print("RESULT: INVALID")

        print("=" * 72)


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

def load_json(filename):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return json.load(f)

    except FileNotFoundError:
        raise ValueError(f"File not found: {filename}")

    except json.JSONDecodeError as e:
        raise ValueError(
            f"Invalid JSON in {filename}: "
            f"line {e.lineno}, column {e.colno}: {e.msg}"
        )

    except OSError as e:
        raise ValueError(f"Unable to read {filename}: {e}")


# ---------------------------------------------------------------------------
# Relation validation
# ---------------------------------------------------------------------------

def validate_relation_structure(relation, result):
    """
    Validate the general structure of relation.json.

    Returns:
        flattened node list
    """

    if not isinstance(relation, dict):
        result.error("relation.json root must be a JSON object.")
        return []

    required_root_fields = {
        "name",
        "type",
        "tags",
        "children",
    }

    missing = required_root_fields - relation.keys()

    for field in sorted(missing):
        result.error(
            f"relation.json root is missing required field '{field}'."
        )

    if "name" not in relation or not isinstance(relation["name"], str):
        result.error("relation.json root 'name' must be a string.")

    if "type" not in relation or not isinstance(relation["type"], str):
        result.error("relation.json root 'type' must be a string.")

    if "tags" in relation and not isinstance(relation["tags"], list):
        result.error("relation.json root 'tags' must be a list.")

    if "children" in relation and not isinstance(relation["children"], list):
        result.error("relation.json root 'children' must be a list.")

    nodes = []

    def visit(node, parent=None):
        if not isinstance(node, dict):
            result.error(
                "Every relation node must be a JSON object."
            )
            return

        required_fields = {
            "name",
            "type",
            "tags",
            "children",
        }

        missing_fields = required_fields - node.keys()

        for field in sorted(missing_fields):
            result.error(
                f"Relation node is missing required field '{field}'."
            )

        name = node.get("name")
        node_type = node.get("type")
        tags = node.get("tags")
        children = node.get("children")

        if not isinstance(name, str):
            result.error(
                f"Relation node has invalid name: {name!r}."
            )

        if not isinstance(node_type, str):
            result.error(
                f"Relation node '{name}' has invalid type: {node_type!r}."
            )

        if not isinstance(tags, list):
            result.error(
                f"Relation node '{name}' has non-list 'tags'."
            )

        if not isinstance(children, list):
            result.error(
                f"Relation node '{name}' has non-list 'children'."
            )

        nodes.append(node)

        if isinstance(children, list):
            for child in children:
                visit(child, node)

    if isinstance(relation.get("children"), list):
        for child in relation["children"]:
            visit(child, relation)

    # Root itself is a node.
    nodes.insert(0, relation)

    return nodes


def validate_connections(connections, node_map, result):
    if not isinstance(connections, list):
        result.error("connection.json root must be a list.")
        return

    required_fields = {
        "source",
        "target",
        "type",
        "direction",
    }

    seen = set()

    for index, connection in enumerate(connections, start=1):

        if not isinstance(connection, dict):
            result.error(
                f"Connection #{index} must be a JSON object."
            )
            continue

        missing = required_fields - connection.keys()

        for field in sorted(missing):
            result.error(
                f"Connection #{index} is missing '{field}'."
            )

        source = connection.get("source")
        target = connection.get("target")
        relation_type = connection.get("type")
        direction = connection.get("direction")

        if source not in node_map:
            result.error(
                f"Connection #{index} references unknown source "
                f"'{source}'."
            )

        if target not in node_map:
            result.error(
                f"Connection #{index} references unknown target "
                f"'{target}'."
            )

        if not isinstance(relation_type, str) or not relation_type:
            result.error(
                f"Connection #{index} has invalid relation type "
                f"{relation_type!r}."
            )

        allowed_directions = {
            "-->",
            "<-->",
            "-.->",
        }

        if direction not in allowed_directions:
            result.error(
                f"Connection #{index} has invalid direction "
                f"{direction!r}."
            )

        connection_key = (
            source,
            direction,
            target,
            relation_type,
        )

        if connection_key in seen:
            result.warning(
                f"Duplicate connection detected: "
                f"{source}{direction}{target}@{relation_type}"
            )

        seen.add(connection_key)


# ---------------------------------------------------------------------------
# Spec validation
# ---------------------------------------------------------------------------

def validate_spec_structure(spec, result):
    if not isinstance(spec, dict):
        result.error("spec.json root must be a JSON object.")
        return

    if "components" not in spec:
        result.error("spec.json is missing 'components'.")

    if "defaults" not in spec:
        result.error("spec.json is missing 'defaults'.")

    components = spec.get("components")
    defaults = spec.get("defaults")

    if not isinstance(components, dict):
        result.error("spec.json 'components' must be an object.")

    if not isinstance(defaults, dict):
        result.error("spec.json 'defaults' must be an object.")

    if isinstance(components, dict):
        for name, component in components.items():

            if not isinstance(component, dict):
                result.error(
                    f"Component '{name}' must be a JSON object."
                )
                continue

            if "type" not in component:
                result.error(
                    f"Component '{name}' is missing 'type'."
                )

            if "spec" not in component:
                result.error(
                    f"Component '{name}' is missing 'spec'."
                )

            if "type" in component and not isinstance(
                component["type"], str
            ):
                result.error(
                    f"Component '{name}' has non-string type."
                )

            if "spec" in component and not isinstance(
                component["spec"], dict
            ):
                result.error(
                    f"Component '{name}' has non-object spec."
                )

    if isinstance(defaults, dict):
        for component_type, default_spec in defaults.items():

            if not isinstance(component_type, str):
                result.error(
                    f"Invalid default type: {component_type!r}."
                )

            if not isinstance(default_spec, dict):
                result.error(
                    f"default:{component_type} must contain an object."
                )


# ---------------------------------------------------------------------------
# Cross validation
# ---------------------------------------------------------------------------

def validate_cross_reference(relation, spec, nodes, result):
    components = spec.get("components", {})
    defaults = spec.get("defaults", {})

    node_map = {}

    # ------------------------------------------------------------------
    # Check node uniqueness.
    # ------------------------------------------------------------------

    for node in nodes:

        name = node.get("name")
        node_type = node.get("type")

        if name in node_map:
            result.error(
                f"Duplicate relation identifier '{name}'."
            )
            continue

        node_map[name] = node

        # --------------------------------------------------------------
        # Every relation node should have a spec component.
        # --------------------------------------------------------------

        if name not in components:
            result.error(
                f"Relation node '{name}' has no matching component "
                f"in spec.json."
            )
            continue

        component = components[name]

        spec_type = component.get("type")

        # --------------------------------------------------------------
        # Type consistency.
        # --------------------------------------------------------------

        if node_type != spec_type:
            result.error(
                f"Type mismatch for '{name}': "
                f"relation.json says '{node_type}', "
                f"but spec.json says '{spec_type}'."
            )

    # ------------------------------------------------------------------
    # Check every spec component against relation graph.
    # ------------------------------------------------------------------

    relation_names = set(node_map)

    for component_name, component in components.items():

        if component_name not in relation_names:
            result.warning(
                f"Spec component '{component_name}' is not present "
                f"in the relation graph."
            )

    # ------------------------------------------------------------------
    # Check type/default consistency.
    # ------------------------------------------------------------------

    relation_types = {
        node.get("type")
        for node in nodes
        if isinstance(node.get("type"), str)
    }

    spec_types = {
        component.get("type")
        for component in components.values()
        if isinstance(component, dict)
        and isinstance(component.get("type"), str)
    }

    all_types = relation_types | spec_types

    for component_type in sorted(all_types):

        if component_type not in defaults:
            result.warning(
                f"No default specification exists for type "
                f"'{component_type}'."
            )

    # ------------------------------------------------------------------
    # Check defaults against actual component types.
    # ------------------------------------------------------------------

    for default_type in defaults:

        if default_type not in all_types:
            result.warning(
                f"Default specification 'default:{default_type}' "
                f"is never used by any relation/spec component."
            )

    return node_map


# ---------------------------------------------------------------------------
# Semantic property validation
# ---------------------------------------------------------------------------

def validate_measurements(spec, result):
    """
    Validate measurement dictionaries produced by spec_parser.py.

    Supported shapes:

        {"value": 300, "unit": "kW"}

        {"min": 0, "max": 100, "unit": "%"}
    """

    components = spec.get("components", {})

    def inspect_value(path, value):

        if not isinstance(value, dict):
            return

        # Measurement object.
        if "unit" in value:

            unit = value["unit"]

            if not isinstance(unit, str):
                result.error(
                    f"{path}.unit must be a string."
                )

            has_value = "value" in value
            has_min = "min" in value
            has_max = "max" in value

            if has_value and (has_min or has_max):
                result.error(
                    f"{path} cannot contain both 'value' and "
                    "'min'/'max'."
                )

            if has_min != has_max:
                result.error(
                    f"{path} range must contain both 'min' and 'max'."
                )

            if has_min and has_max:
                minimum = value["min"]
                maximum = value["max"]

                if not isinstance(minimum, (int, float)):
                    result.error(
                        f"{path}.min must be numeric."
                    )

                if not isinstance(maximum, (int, float)):
                    result.error(
                        f"{path}.max must be numeric."
                    )

                if (
                    isinstance(minimum, (int, float))
                    and isinstance(maximum, (int, float))
                    and minimum > maximum
                ):
                    result.error(
                        f"{path} has min > max."
                    )

            if not has_value and not has_min and not has_max:
                result.error(
                    f"{path} contains 'unit' but no numeric value "
                    "or range."
                )

        # Recursively inspect nested structures.
        for key, child in value.items():
            if isinstance(child, dict):
                inspect_value(f"{path}.{key}", child)

    for name, component in components.items():

        component_spec = component.get("spec", {})

        if isinstance(component_spec, dict):
            for property_name, value in component_spec.items():
                inspect_value(
                    f"component '{name}'.spec.{property_name}",
                    value,
                )


# ---------------------------------------------------------------------------
# Graph validation
# ---------------------------------------------------------------------------

def validate_graph(connections, node_map, result):
    """
    Perform graph-level consistency checks.
    """

    incoming = Counter()
    outgoing = Counter()

    for connection in connections:
        source = connection.get("source")
        target = connection.get("target")

        if source in node_map:
            outgoing[source] += 1

        if target in node_map:
            incoming[target] += 1

    # Warn about isolated nodes.
    for name in node_map:
        if incoming[name] == 0 and outgoing[name] == 0:
            result.warning(
                f"Node '{name}' has no connections."
            )

    # Warn about connections to self.
    for connection in connections:
        source = connection.get("source")
        target = connection.get("target")

        if source == target:
            result.warning(
                f"Self-connection detected: "
                f"{source}{connection.get('direction')}{target}"
                f"@{connection.get('type')}"
            )


# ---------------------------------------------------------------------------
# Full validation
# ---------------------------------------------------------------------------

def validate_twin(relation_file, connection_file, spec_file):
    result = ValidationResult()

    # ------------------------------------------------------------------
    # Load generated files.
    # ------------------------------------------------------------------

    try:
        relation = load_json(relation_file)
    except ValueError as e:
        result.error(str(e))
        return result

    try:
        connections = load_json(connection_file)
    except ValueError as e:
        result.error(str(e))
        return result

    try:
        spec = load_json(spec_file)
    except ValueError as e:
        result.error(str(e))
        return result

    # ------------------------------------------------------------------
    # Structural validation.
    # ------------------------------------------------------------------

    nodes = validate_relation_structure(
        relation,
        result,
    )

    validate_spec_structure(
        spec,
        result,
    )

    # ------------------------------------------------------------------
    # Build node map.
    # ------------------------------------------------------------------

    node_map = {}

    for node in nodes:
        name = node.get("name")

        if isinstance(name, str):
            if name in node_map:
                result.error(
                    f"Duplicate relation identifier '{name}'."
                )
            else:
                node_map[name] = node

    # ------------------------------------------------------------------
    # Connection validation.
    # ------------------------------------------------------------------

    validate_connections(
        connections,
        node_map,
        result,
    )

    # ------------------------------------------------------------------
    # Cross-file validation.
    # ------------------------------------------------------------------

    validate_cross_reference(
        relation,
        spec,
        nodes,
        result,
    )

    # ------------------------------------------------------------------
    # Semantic validation.
    # ------------------------------------------------------------------

    validate_measurements(
        spec,
        result,
    )

    validate_graph(
        connections,
        node_map,
        result,
    )

    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Cross-validate generated relation.json and spec.json "
            "for a digital twin."
        )
    )

    parser.add_argument(
        "twin",
        help="Name of the twin inside config/twins/"
    )

    args = parser.parse_args()

    twin_name = args.twin

    twin_dir = TWINS_DIR / twin_name

    relation_file = twin_dir / "relation.json"
    connection_file = twin_dir / "connection.json"
    spec_file = twin_dir / "spec.json"

    if not twin_dir.is_dir():
        print(f"Error: Twin output directory not found: {twin_dir}")
        raise SystemExit(1)

    print(f"Validating twin: {twin_name}")
    print(f"Relation JSON:   {relation_file}")
    print(f"Connection JSON: {connection_file}")
    print(f"Spec JSON:       {spec_file}")

    result = validate_twin(
        relation_file,
        connection_file,
        spec_file,
    )

    result.print_report()

    if result.valid:
        raise SystemExit(0)

    raise SystemExit(1)


if __name__ == "__main__":
    main()