import sys
from pathlib import Path


INDENT = "    "


def format_spec(text: str) -> str:
    lines = text.splitlines()

    output = []
    inside_block = False
    block_just_closed = False

    for raw_line in lines:
        line = raw_line.strip()

        # Remove all existing blank lines.
        if not line:
            continue

        # Comment
        if line.startswith("#"):
            # A comment following a completed spec gets one
            # blank line before it.
            if block_just_closed and output and output[-1] != "":
                output.append("")

            output.append(line)
            block_just_closed = False
            continue

        # Closing a top-level block.
        if line == "}":
            if not inside_block:
                raise ValueError("Unexpected '}'")

            output.append("}")
            inside_block = False
            block_just_closed = True
            continue

        # Opening a top-level block.
        if line.endswith("{"):
            if inside_block:
                raise ValueError(
                    "Nested blocks are not allowed"
                )

            # A spec following a comment gets one blank line.
            if output and output[-1] != "":
                output.append("")

            output.append(line)
            inside_block = True
            block_just_closed = False
            continue

        # Property inside a block.
        if inside_block:
            output.append(INDENT + line)
            continue

        # Anything outside a block is an inline component/default.
        # Keep it as-is, but separate it from the previous section.
        if output and output[-1] != "":
            output.append("")

        output.append(line)
        block_just_closed = False

    if inside_block:
        raise ValueError("Unclosed specification block")

    # Remove blank lines at the beginning/end.
    while output and output[0] == "":
        output.pop(0)

    while output and output[-1] == "":
        output.pop()

    return "\n".join(output) + "\n"


def format_file(input_file: str | Path, output_file: str | Path | None = None):
    input_path = Path(input_file)

    if not input_path.exists():
        raise FileNotFoundError(f"File not found: {input_path}")

    text = input_path.read_text(encoding="utf-8")
    formatted = format_spec(text)

    if output_file is None:
        print(formatted, end="")
        return

    output_path = Path(output_file)
    output_path.write_text(formatted, encoding="utf-8")

    print(f"Formatted file: {output_path}")