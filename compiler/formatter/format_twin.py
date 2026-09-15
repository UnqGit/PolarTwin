import argparse
import sys
from pathlib import Path

try:
    # When run as a module (e.g., python -m compiler.formatter.format_twin)
    from .relation_formatter import format_file as format_relation_file
    from .connection_formatter import format_file as format_connection_file
    from .spec_formatter import format_file as format_spec_file
except ImportError:
    # When run directly as a script (e.g., python format_twin.py)
    from relation_formatter import format_file as format_relation_file
    from connection_formatter import format_file as format_connection_file
    from spec_formatter import format_file as format_spec_file


# -----------------------------------------------------------------
# Paths
# -----------------------------------------------------------------

COMPILER_DIR = Path(__file__).resolve().parent.parent
DESCRIPTION_DIR = COMPILER_DIR.parent / "data" / "source"


# -----------------------------------------------------------------
# Main
# -----------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Format relation.twin, connection.twin, and spec.twin for a digital twin."
    )

    parser.add_argument(
        "twin",
        help="Name of the twin directory inside config/description/twins"
    )

    args = parser.parse_args()

    twin_name = args.twin
    twin_dir = DESCRIPTION_DIR / twin_name

    relation_file = twin_dir / "relation.twin"
    connection_file = twin_dir / "connection.twin"
    spec_file = twin_dir / "spec.twin"

    # -----------------------------------------------------------------
    # Validate twin directory
    # -----------------------------------------------------------------

    if not twin_dir.is_dir():
        print(
            f"Error: Twin directory not found: {twin_dir}",
            file=sys.stderr
        )
        sys.exit(1)

    # -----------------------------------------------------------------
    # Format relation.twin
    # -----------------------------------------------------------------

    if not relation_file.is_file():
        print(
            f"Error: relation.twin not found: {relation_file}",
            file=sys.stderr
        )
        sys.exit(1)

    print(f"Formatting file: {relation_file}")

    try:
        format_relation_file(relation_file, relation_file, in_place=True)
    except Exception as e:
        print(
            f"Error formatting {relation_file}: {e}",
            file=sys.stderr
        )
        sys.exit(1)

    # -----------------------------------------------------------------
    # Format connection.twin
    # -----------------------------------------------------------------

    if not connection_file.is_file():
        print(
            f"Error: connection.twin not found: {connection_file}",
            file=sys.stderr
        )
        sys.exit(1)

    print(f"Formatting file: {connection_file}")

    try:
        format_connection_file(connection_file, connection_file, in_place=True)
    except Exception as e:
        print(
            f"Error formatting {connection_file}: {e}",
            file=sys.stderr
        )
        sys.exit(1)

    # -----------------------------------------------------------------
    # Format spec.twin
    # -----------------------------------------------------------------

    if not spec_file.is_file():
        print(
            f"Error: spec.twin not found: {spec_file}",
            file=sys.stderr
        )
        sys.exit(1)

    print(f"Formatting file: {spec_file}")

    try:
        format_spec_file(spec_file, spec_file)
    except Exception as e:
        print(
            f"Error formatting {spec_file}: {e}",
            file=sys.stderr
        )
        sys.exit(1)

    print(f"\nSuccessfully formatted twin: {twin_name}")


if __name__ == "__main__":
    main()