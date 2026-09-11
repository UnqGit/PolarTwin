import argparse
import sys
from pathlib import Path

from relation_formatter import format_file as format_relation_file
from spec_formatter import format_file as format_spec_file


# -----------------------------------------------------------------
# Paths
# -----------------------------------------------------------------

CONFIG_DIR = Path(__file__).resolve().parent.parent
DESCRIPTION_DIR = CONFIG_DIR / "twins"


# -----------------------------------------------------------------
# Main
# -----------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Format relation.txt and spec.txt for a digital twin."
    )

    parser.add_argument(
        "twin",
        help="Name of the twin directory inside config/description/"
    )

    args = parser.parse_args()

    twin_name = args.twin
    twin_dir = DESCRIPTION_DIR / twin_name

    relation_file = twin_dir / "relation.txt"
    spec_file = twin_dir / "spec.txt"

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
    # Format relation.txt
    # -----------------------------------------------------------------

    if not relation_file.is_file():
        print(
            f"Error: relation.txt not found: {relation_file}",
            file=sys.stderr
        )
        sys.exit(1)

    print(f"Formatting file: {relation_file}")

    try:
        format_relation_file(relation_file, relation_file)
    except Exception as e:
        print(
            f"Error formatting {relation_file}: {e}",
            file=sys.stderr
        )
        sys.exit(1)

    # -----------------------------------------------------------------
    # Format spec.txt
    # -----------------------------------------------------------------

    if not spec_file.is_file():
        print(
            f"Error: spec.txt not found: {spec_file}",
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