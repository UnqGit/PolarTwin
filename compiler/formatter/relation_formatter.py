from __future__ import annotations

import sys
import re
from pathlib import Path


INDENT = "    "

# ---------------------------------------------------------------------------
# Regular expressions
# ---------------------------------------------------------------------------

# Component declaration:
#
#   Maitri:station
#   Maitri:station %critical %essential
#
COMPONENT_RE = re.compile(
    r"""
    ^
    (?P<name>[A-Za-z_]\w*)
    \s*:\s*
    (?P<type>[A-Za-z_]\w*)
    (?P<tags>(?:\s+%[A-Za-z_]\w*)*)
    \s*
    (?P<brace>\{)?
    $
    """,
    re.VERBOSE,
)

# Relationship:
#
#   A-->B@signal
#   A <--> B @ signal
#
RELATION_RE = re.compile(
    r"""
    ^
    (?P<source>[A-Za-z_]\w*)
    \s*
    (?P<operator><-->|-->)
    \s*
    (?P<target>[A-Za-z_]\w*)
    \s*
    @
    \s*
    (?P<signal>[A-Za-z_]\w*)
    \s*
    $
    """,
    re.VERBOSE,
)

# Tag:
#
#   %critical
TAG_RE = re.compile(r"%[A-Za-z_]\w*")


# ---------------------------------------------------------------------------
# Comment handling
# ---------------------------------------------------------------------------

def split_comment(line: str) -> tuple[str, str]:
    """
    Split a line into code and comment.

    '#' starts a comment only when outside a quoted string.
    """

    quote = None
    escaped = False

    for i, char in enumerate(line):

        if escaped:
            escaped = False
            continue

        if char == "\\" and quote is not None:
            escaped = True
            continue

        if char in ('"', "'"):

            if quote is None:
                quote = char

            elif quote == char:
                quote = None

            continue

        if char == "#" and quote is None:
            return line[:i], line[i:]

    return line, ""


def normalize_comment(comment: str) -> str:
    """
    Normalize ordinary comments while preserving decorative comments.
    """

    comment = comment.strip()

    if not comment:
        return ""

    if comment.startswith("#"):

        body = comment[1:].strip()

        if not body:
            return "#"

        return f"# {body}"

    return f"# {comment}"


def is_separator_comment(comment: str) -> bool:
    """
    Detect decorative separator comments such as:

        # ============================================================

        # -------------------- ENERGY -------------------------------
    """

    body = comment.lstrip("#").strip()

    if not body:
        return False

    # Mostly punctuation / separators.
    punctuation = re.sub(r"[A-Za-z0-9 ]", "", body)

    return (
        len(body) >= 10
        and len(punctuation) / max(len(body), 1) > 0.6
    )


# ---------------------------------------------------------------------------
# Code normalization
# ---------------------------------------------------------------------------

def normalize_component(line: str) -> str | None:
    """
    Normalize a component declaration.

    Examples:

        Maitri:station %critical %essential {
        Maitri : station   %critical   %essential{
        Maitri:station{
    """

    match = COMPONENT_RE.match(line.strip())

    if not match:
        return None

    name = match.group("name")
    component_type = match.group("type")
    tags = match.group("tags").strip()
    has_brace = bool(match.group("brace"))

    result = f"{name}:{component_type}"

    if tags:
        # Collapse all whitespace between tags.
        tags = " ".join(TAG_RE.findall(tags))
        result += f" {tags}"

    if has_brace:
        result += " {"

    return result


def normalize_relationship(line: str) -> str | None:
    """
    Normalize a relationship.

        A --> B @ signal
        A-->B@signal

    become:

        A-->B@signal
    """

    match = RELATION_RE.match(line.strip())

    if not match:
        return None

    source = match.group("source")
    operator = match.group("operator")
    target = match.group("target")
    signal = match.group("signal")

    return f"{source}{operator}{target}@{signal}"


def normalize_property(line: str) -> str:
    """
    Normalize whitespace around property syntax without modifying
    quoted values.

    Example:

        rating = 300 unit = kW

    becomes:

        rating=300 unit=kW

    This is deliberately conservative.
    """

    line = line.strip()

    if not line:
        return ""

    # Normalize whitespace around '=' outside quoted strings.
    result = []
    quote = None
    escaped = False
    i = 0

    while i < len(line):

        char = line[i]

        if escaped:
            result.append(char)
            escaped = False
            i += 1
            continue

        if char == "\\" and quote is not None:
            result.append(char)
            escaped = True
            i += 1
            continue

        if char in ('"', "'"):

            if quote is None:
                quote = char

            elif quote == char:
                quote = None

            result.append(char)
            i += 1
            continue

        if char == "=" and quote is None:

            # Remove whitespace before '='.
            while result and result[-1].isspace():
                result.pop()

            result.append("=")

            # Skip whitespace after '='.
            i += 1

            while i < len(line) and line[i].isspace():
                i += 1

            continue

        result.append(char)
        i += 1

    return "".join(result).strip()


def normalize_code(line: str) -> str:
    """
    Normalize one non-comment line.
    """

    stripped = line.strip()

    if not stripped:
        return ""

    # Closing brace.
    if stripped == "}":
        return "}"

    # Standalone opening brace.
    if stripped == "{":
        return "{"

    # Component declaration.
    component = normalize_component(stripped)

    if component is not None:
        return component

    # Relationship.
    relationship = normalize_relationship(stripped)

    if relationship is not None:
        return relationship

    # Property or unknown code.
    return normalize_property(stripped)


# ---------------------------------------------------------------------------
# Structural formatting
# ---------------------------------------------------------------------------

def classify_line(code: str, comment: str) -> str:
    """
    Classify a normalized line.
    """

    stripped = code.strip()

    if not stripped:
        return "blank"

    if stripped == "}":
        return "close"

    if stripped.endswith("{"):
        return "open"

    if RELATION_RE.match(stripped):
        return "relationship"

    if stripped.startswith("%"):
        return "tag"

    if ":" in stripped:
        return "declaration"

    if "=" in stripped:
        return "property"

    return "other"


def format_spec(text: str) -> str:
    """
    Format an entire specification file.
    """

    raw_lines = text.splitlines()

    # First pass:
    # separate code/comments and normalize code.
    logical_lines = []

    for raw in raw_lines:

        code, comment = split_comment(raw)

        code = normalize_code(code)
        comment = normalize_comment(comment)

        if not code and not comment:
            logical_lines.append(("blank", "", ""))
            continue

        # A pure comment line.
        if not code:
            logical_lines.append(
                (
                    "comment",
                    "",
                    comment,
                )
            )
            continue

        logical_lines.append(
            (
                classify_line(code, comment),
                code,
                comment,
            )
        )

    # Second pass:
    # calculate indentation from braces.
    output = []
    depth = 0

    previous_kind = None

    for index, (kind, code, comment) in enumerate(logical_lines):

        # ---------------------------------------------------------------
        # Blank lines
        # ---------------------------------------------------------------

        if kind == "blank":
            # Do not accumulate multiple blank lines.
            if output and output[-1] != "":
                output.append("")

            continue

        # ---------------------------------------------------------------
        # Comments
        # ---------------------------------------------------------------

        if kind == "comment":

            # Decorative section separators are kept at current depth.
            line = f"{INDENT * depth}{comment}"

            if output and output[-1] != "":
                output.append(line)

            else:
                output.append(line)

            previous_kind = kind
            continue

        # ---------------------------------------------------------------
        # Closing brace
        # ---------------------------------------------------------------

        if kind == "close":

            depth = max(depth - 1, 0)

            line = f"{INDENT * depth}}}"

            # Avoid blank lines immediately before a closing brace.
            while output and output[-1] == "":
                output.pop()

            output.append(line)

            previous_kind = kind
            continue

        # ---------------------------------------------------------------
        # Opening declaration
        # ---------------------------------------------------------------

        if kind == "open":

            # Add a blank line before major top-level declarations,
            # but not after comments or at the beginning.
            if depth == 0 and output:
                if output[-1] != "":
                    output.append("")

            line = f"{INDENT * depth}{code}"

            if comment:
                line += f" {comment}"

            output.append(line)

            depth += 1

            previous_kind = kind
            continue

        # ---------------------------------------------------------------
        # Relationships
        # ---------------------------------------------------------------

        if kind == "relationship":

            # Relationships are generally separated from declarations.
            if (
                previous_kind in {"declaration", "property", "open"}
                and output
                and output[-1] != ""
            ):
                output.append("")

            line = f"{INDENT * depth}{code}"

            if comment:
                line += f" {comment}"

            output.append(line)

            previous_kind = kind
            continue

        # ---------------------------------------------------------------
        # Normal declaration/property
        # ---------------------------------------------------------------

        line = f"{INDENT * depth}{code}"

        if comment:
            line += f" {comment}"

        output.append(line)

        previous_kind = kind

    # ---------------------------------------------------------------
    # Cleanup
    # ---------------------------------------------------------------

    # Remove trailing blank lines.
    while output and output[-1] == "":
        output.pop()

    # Ensure exactly one final newline.
    return "\n".join(output) + "\n"


# ---------------------------------------------------------------------------
# File interface
# ---------------------------------------------------------------------------

def format_file(
    input_file: Path,
    output_file: Path | None = None,
    in_place: bool = False,
) -> None:

    text = input_file.read_text(encoding="utf-8")

    formatted = format_spec(text)

    if in_place:
        input_file.write_text(
            formatted,
            encoding="utf-8",
        )

        print(f"Formatted: {input_file}")
        return

    if output_file is not None:
        output_file.write_text(
            formatted,
            encoding="utf-8",
        )

        print(f"Created: {output_file}")
        return

    print(formatted, end="")