from pathlib import Path
from typing import Any

from packages.shared_models.errors import ParseError
from twin_sim.dsl.models import EventDefinition, derive_target_kind


class EventParseError(ParseError):
    def __init__(self, message, line_number=None, line=None, expected=None):
        raw_msg = message
        if line is not None:
            raw_msg += f"\n    {line}"
        if expected is not None:
            raw_msg += f"\nExpected: {expected}"
            
        error = raw_msg
        if line_number is not None:
            error = f"Line {line_number}: {error}"
                
        super().__init__(error)
        self.raw_message = raw_msg
        self.line_number = line_number


def parse_value(v: str) -> Any:
    # Quick utility to convert string to int, float, bool, or leave as string
    v = v.strip()
    if v.lower() == "true":
        return True
    if v.lower() == "false":
        return False
    if v.lower() == "inf":
        return float("inf")
    try:
        if "." in v:
            return float(v)
        return int(v)
    except ValueError:
        # maybe quoted
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            return v[1:-1]
        return v


def strip_comment(line: str) -> str:
    """Safely strip '#' comments, ignoring '#' inside strings."""
    in_double = False
    in_single = False
    for i, c in enumerate(line):
        if c == '"' and not in_single:
            in_double = not in_double
        elif c == "'" and not in_double:
            in_single = not in_single
        elif c == '#' and not in_double and not in_single:
            return line[:i]
    return line

# ---------------------------------------------------------------------------
# Target clause validation helpers (Spec §9)
# ---------------------------------------------------------------------------

_VALID_COMPONENT_TARGETS = {"@component.name", "@component.type"}
_VALID_CONNECTION_TARGETS = {
    "@connection",
    "@connection.source",
    "@connection.target",
    "@connection.type",
}
_VALID_EXTERNAL_TARGETS = {
    "@external",
    "@external.network",
    "@external.weather",
    "@external.supplies",
}


def _validate_target(target: str, line_number: int | None, line: str | None) -> None:
    """
    Validate the target clause per Spec §9.

    Supported forms (verbatim or combined with |):
      @component.name
      @component.type
      @component.type | @component.name   (combined)
      @connection
      @connection.source / .target / .type  (field-specific)
      @connection.(field1 & field2)          (multi-field)
      @external
      @external.network / .weather / .supplies

    A bare @component is invalid per §9.1.
    """
    # Combined component selector: "X | Y" where each side is a valid component ref
    if "|" in target:
        parts = [p.strip() for p in target.split("|")]
        for part in parts:
            if part not in _VALID_COMPONENT_TARGETS:
                raise EventParseError(
                    f"Invalid combined target part '{part}'. "
                    "Combined selectors must use @component.name or @component.type.",
                    line_number,
                    line,
                )
        return

    # Multi-field connection selector: @connection.(field1 & field2)
    if target.startswith("@connection.(") and target.endswith(")"):
        inner = target[len("@connection.("):-1]
        fields = [f.strip() for f in inner.split("&")]
        if len(fields) != 2:  # noqa: PLR2004
            raise EventParseError(
                f"Multi-field connection selector must specify exactly 2 fields: '{target}'",
                line_number,
                line,
            )
        valid_conn_fields = {"source", "target", "type"}
        for f in fields:
            if f not in valid_conn_fields:
                raise EventParseError(
                    f"Invalid connection field '{f}' in multi-field selector. "
                    "Must be one of: source, target, type.",
                    line_number,
                    line,
                )
        if fields[0] == fields[1]:
            raise EventParseError(
                "Multi-field connection selector fields must be different.",
                line_number,
                line,
            )
        return

    # Plain @component is invalid (must have .name or .type)
    if target == "@component":
        raise EventParseError(
            "Bare '@component' target is invalid. Use '@component.name' or '@component.type'.",
            line_number,
            line,
        )

    # Check against all known valid targets
    all_valid = (
        _VALID_COMPONENT_TARGETS
        | _VALID_CONNECTION_TARGETS
        | _VALID_EXTERNAL_TARGETS
    )
    if target not in all_valid:
        raise EventParseError(
            f"Unrecognised target '{target}'. "
            "Expected one of: @component.name, @component.type, "
            "@connection[.source|.target|.type|.(f1&f2)], "
            "@external[.network|.weather|.supplies].",
            line_number,
            line,
        )


# ---------------------------------------------------------------------------
# Core parser
# ---------------------------------------------------------------------------


def parse_event_string(source: str, name: str = "<anonymous>") -> EventDefinition:
    """
    Parse an .event file from a string.

    Supports all constructs defined in Spec §8-§11:
      target @component.type | @component.name
      where <condition>
      & <continuation>
      set status=failure
      set fields
      set fields { value }          ← Spec §11.2 inline block
      set { value }                 ← Spec §11.2 multi-line block
      set {
        values.temperature          ← allowed editable field
        values.voltage.output=120   ← fixed value
        status=failure              ← fixed value
        fields                      ← open-ended
      }
    """
    target = ""
    wheres: list[str] = []
    set_fields_allowed = False
    set_allowed: list[str] = []
    set_required: list[str] = []
    set_fixed: dict[str, Any] = {}

    lines = source.splitlines()

    i = 0
    in_set_block = False
    while i < len(lines):
        raw = lines[i]
        line = strip_comment(raw).strip()
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
                key = key.strip()
                if key.startswith("?"):
                    raise EventParseError("Initiated fields cannot be optional (cannot start with '?')", i, line)
                set_fixed[key] = parse_value(val)
            else:
                # Editable field name (e.g. "value", "values.temperature")
                field = line.strip()
                if field.startswith("?"):
                    set_allowed.append(field[1:])
                else:
                    set_allowed.append(field)
                    set_required.append(field)
            continue

        if line.startswith("target "):
            target = line[len("target "):].strip()
            _validate_target(target, i, line)

        elif line.startswith("where "):
            wheres.append(line[len("where "):].strip())

        elif line.startswith("& "):
            # Continuation of previous where clause
            wheres.append(line[len("& "):].strip())

        elif line.startswith("set "):
            remainder = line[len("set "):].strip()

            if remainder == "{":
                # set {  (Spec §11.4 multi-line block)
                in_set_block = True

            elif remainder.startswith("{") and remainder.endswith("}"):
                # set { value }  (Spec §11.2 single-line inline block)
                inner = remainder[1:-1].strip()
                if inner:
                    for field in inner.replace(",", " ").split():
                        field = field.strip()
                        if not field:
                            continue
                        if field == "fields":
                            set_fields_allowed = True
                        elif "=" in field:
                            key, val = field.split("=", 1)
                            key = key.strip()
                            if key.startswith("?"):
                                raise EventParseError("Initiated fields cannot be optional (cannot start with '?')", i, line)
                            set_fixed[key] = parse_value(val)
                        else:
                            if field.startswith("?"):
                                set_allowed.append(field[1:])
                            else:
                                set_allowed.append(field)
                                set_required.append(field)

            elif "=" in remainder:
                # set field=value  (Spec §11.3)
                key, val = remainder.split("=", 1)
                key = key.strip()
                if key.startswith("?"):
                    raise EventParseError("Initiated fields cannot be optional (cannot start with '?')", i, line)
                set_fixed[key] = parse_value(val)

            else:
                raise EventParseError(
                    "Invalid set clause.",
                    i,
                    line,
                    expected="'{', '{ ... }', or 'field=value'."
                )

        else:
            raise EventParseError(
                "Unrecognized line.", 
                i, 
                line,
                expected="a clause starting with 'target ', 'where ', '& ', or 'set '."
            )

    if not target:
        raise EventParseError("Missing 'target' clause", None, None)
    if in_set_block:
        raise EventParseError("Unclosed 'set' block", None, None)

    target_kind = derive_target_kind(target)

    # Extract multi-field connection fields for connection.multi kind
    conn_multi_fields: list[str] = []
    if target_kind == "connection.multi":
        inner = target[len("@connection.("):-1]
        conn_multi_fields = [f.strip() for f in inner.split("&")]

    return EventDefinition(
        name=name,
        target=target,
        target_kind=target_kind,
        connection_multi_fields=conn_multi_fields,
        where=wheres,
        set_fields_allowed=set_fields_allowed,
        set_allowed=set_allowed,
        set_required=set_required,
        set_fixed=set_fixed,
    )


def parse_event_file(filepath: Path) -> EventDefinition:
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()
    return parse_event_string(source, name=filepath.stem)
