from __future__ import annotations

import re
from pathlib import Path

# ---------------------------------------------------------------------------
# Regular expressions
# ---------------------------------------------------------------------------

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
    (?P<operator><-->|-->|-\.\->)
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


def split_comment(line: str) -> tuple[str, str]:
    if "#" in line:
        parts = line.split("#", 1)
        return parts[0], "#" + parts[1]
    return line, ""


def normalize_relationship(line: str) -> str | None:
    match = RELATION_RE.match(line.strip())
    if not match:
        return None

    source = match.group("source")
    operator = match.group("operator")
    target = match.group("target")
    signal = match.group("signal")

    return f"{source}{operator}{target}@{signal}"


def format_connections(text: str) -> str:
    raw_lines = text.splitlines()
    output = []

    for raw in raw_lines:
        code, comment = split_comment(raw)
        
        stripped_code = code.strip()
        stripped_comment = comment.strip()
        
        if not stripped_code and not stripped_comment:
            if output and output[-1] != "":
                output.append("")
            continue
            
        if not stripped_code:
            output.append(stripped_comment)
            continue
            
        relationship = normalize_relationship(stripped_code)
        if relationship:
            line = relationship
            if stripped_comment:
                line += f" {stripped_comment}"
            output.append(line)
        else:
            # Leave unrecognized lines as is, but strip trailing whitespace
            line = stripped_code
            if stripped_comment:
                line += f" {stripped_comment}"
            output.append(line)

    # Cleanup trailing blanks
    while output and output[-1] == "":
        output.pop()
        
    return "\n".join(output) + "\n"


def format_file(
    input_file: Path,
    output_file: Path | None = None,
    in_place: bool = False,
) -> None:

    text = input_file.read_text(encoding="utf-8")
    formatted = format_connections(text)

    if in_place:
        input_file.write_text(formatted, encoding="utf-8")
        print(f"Formatted: {input_file}")
        return

    if output_file is not None:
        output_file.write_text(formatted, encoding="utf-8")
        print(f"Created: {output_file}")
        return

    print(formatted, end="")
