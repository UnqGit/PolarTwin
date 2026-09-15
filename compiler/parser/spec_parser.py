import json
import re
from copy import deepcopy
from pathlib import Path

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

    if not value:
        return ""

    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]

    if value.lower() == "true":
        return True

    if value.lower() == "false":
        return False

    range_match = re.fullmatch(
        rf"({NUMBER_PATTERN})\s*:\s*({NUMBER_PATTERN})",
        value
    )

    if range_match:
        minimum = convert_number(range_match.group(1))
        maximum = convert_number(range_match.group(2))

        if minimum > maximum:
            raise ValueError(f"Invalid range '{value}': minimum cannot be greater than maximum")

        return {"min": minimum, "max": maximum}

    if re.fullmatch(NUMBER_PATTERN, value):
        return convert_number(value)

    if re.fullmatch(BARE_WORD_PATTERN, value):
        return value

    if re.fullmatch(UNIT_PATTERN, value):
        return value

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
        raw_value = match.group("value")
        value = convert(raw_value)

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
                raise ValueError(
                    f"Property '{key}' has a unit but its value is not numeric or a range"
                )

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


def parse_component_header(header, line_number):
    """
    Component syntax:

        Generator1:generator {
            ...
        }

    or:

        Generator1:generator power=300 unit=kW
    """

    match = re.match(
        r"^([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)"
        r"(?:\s+(.*))?$",
        header
    )

    if not match:
        raise ValueError(
            f"Line {line_number}: invalid component declaration '{header}'. "
            "Expected Name:type"
        )

    name, component_type, property_text = match.groups()
    props = build_properties(property_text or "")

    return name, component_type, props


def parse_default_header(header, line_number):
    """
    Default syntax:

        default:generator {
            ...
        }
    """

    match = re.fullmatch(r"default:([A-Za-z_]\w*)", header.strip())

    if not match:
        raise ValueError(
            f"Line {line_number}: invalid default declaration '{header}'. "
            "Expected default:<type>"
        )

    return match.group(1)


def deep_merge(base, override):
    """
    CSS-like inheritance.

    Values in override replace values from base.

    Nested dictionaries are merged so that future structured
    properties can be overridden without destroying unrelated
    nested fields.
    """

    result = deepcopy(base)

    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = deepcopy(value)

    return result


def parse_spec_file(filename):
    defaults = {}
    components = {}

    current_name = None
    current_type = None
    current_props = {}
    current_is_default = False

    with open(filename, encoding="utf-8") as f:
        for line_number, raw in enumerate(f, start=1):
            line = raw.split("#", 1)[0].strip()

            if not line:
                continue

            if line == "}":
                if current_name is None:
                    raise ValueError(f"Line {line_number}: unexpected '}}'")

                if current_is_default:
                    defaults[current_type] = deepcopy(current_props)
                else:
                    inherited = defaults.get(current_type, {})
                    spec = deep_merge(inherited, current_props)

                    components[current_name] = {
                        "type": current_type,
                        "spec": spec
                    }

                current_name = None
                current_type = None
                current_props = {}
                current_is_default = False
                continue

            if line.endswith("{"):
                header = line[:-1].strip()

                if current_name is not None:
                    raise ValueError(f"Line {line_number}: nested blocks are not allowed")

                if header.startswith("default"):
                    component_type = parse_default_header(header, line_number)

                    if component_type in defaults:
                        raise ValueError(
                            f"Line {line_number}: duplicate default:{component_type}"
                        )

                    current_name = f"default:{component_type}"
                    current_type = component_type
                    current_props = {}
                    current_is_default = True
                    continue

                name, component_type, props = parse_component_header(header, line_number)

                if name in components:
                    raise ValueError(
                        f"Line {line_number}: duplicate component '{name}'"
                    )

                current_name = name
                current_type = component_type
                current_props = props
                current_is_default = False
                continue

            if current_name is not None:
                props = build_properties(line)
                duplicates = set(current_props) & set(props)

                if duplicates:
                    raise ValueError(
                        f"Line {line_number}: duplicate property: "
                        f"{', '.join(sorted(duplicates))}"
                    )

                current_props.update(props)
                continue

            name, component_type, props = parse_component_header(line, line_number)

            if name in components:
                raise ValueError(f"Line {line_number}: duplicate component '{name}'")

            inherited = defaults.get(component_type, {})
            spec = deep_merge(inherited, props)

            components[name] = {
                "type": component_type,
                "spec": spec
            }

    if current_name is not None:
        raise ValueError(f"Unclosed specification block '{current_name}'")

    return {
        "components": components,
        "defaults": defaults
    }


def generate_spec_json(spec_file: Path, output_file: Path):
    data = parse_spec_file(spec_file)

    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Created {output_file}")