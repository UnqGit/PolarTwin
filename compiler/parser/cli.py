import argparse
from pathlib import Path
try:
    from .validate_twin import validate_twin
    from .relation_parser import generate_relation_json
    from .connection_parser import generate_connection_json
    from .spec_parser import generate_spec_json
except ImportError:
    from validate_twin import validate_twin
    from relation_parser import generate_relation_json
    from connection_parser import generate_connection_json
    from spec_parser import generate_spec_json


import json

# -----------------------------------------------------------------
# Paths
# -----------------------------------------------------------------

COMPILER_DIR = Path(__file__).resolve().parent.parent

DESCRIPTION_DIR = COMPILER_DIR.parent / "data" / "source"
TWINS_DIR = COMPILER_DIR.parent / "data" / "compiled"


# -----------------------------------------------------------------
# Main
# -----------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Compile Twin DSL source files into JSON."
    )

    parser.add_argument(
        "twin",
        help="Name of the twin directory inside config/description/twins"
    )

    args = parser.parse_args()

    twin_name = args.twin

    description_dir = DESCRIPTION_DIR / twin_name
    output_dir = TWINS_DIR / twin_name

    relation_file = description_dir / "relation.twin"
    connection_file = description_dir / "connection.twin"
    spec_file = description_dir / "spec.twin"

    relation_output = output_dir / "relation.json"
    connection_output = output_dir / "connection.json"
    spec_output = output_dir / "spec.json"

    # -----------------------------------------------------------------
    # Validate input directory
    # -----------------------------------------------------------------

    if not description_dir.is_dir():
        print(f"Error: Twin description directory not found: {description_dir}")
        raise SystemExit(1)

    if not relation_file.is_file():
        print(f"Error: relation.twin not found: {relation_file}")
        raise SystemExit(1)
        
    if not connection_file.is_file():
        print(f"Error: connection.twin not found: {connection_file}")
        raise SystemExit(1)

    if not spec_file.is_file():
        print(f"Error: spec.twin not found: {spec_file}")
        raise SystemExit(1)

    # -----------------------------------------------------------------
    # Parse relation.twin
    # -----------------------------------------------------------------

    print(f"Parsing relation file: {relation_file}")

    try:
        generate_relation_json(
            relation_file,
            relation_output
        )
    except Exception as e:
        print(f"Failed to generate relation.json: {e}")
        raise SystemExit(1)

    # -----------------------------------------------------------------
    # Parse connection.twin
    # -----------------------------------------------------------------

    print(f"Parsing connection file: {connection_file}")

    try:
        with open(relation_output, 'r', encoding='utf-8') as f:
            topology_data = json.load(f)
            
        generate_connection_json(
            connection_file,
            topology_data,
            connection_output
        )
    except Exception as e:
        print(f"Failed to generate connection.json: {e}")
        raise SystemExit(1)

    # -----------------------------------------------------------------
    # Parse spec.twin
    # -----------------------------------------------------------------

    print(f"Parsing spec file: {spec_file}")

    try:
        generate_spec_json(
            spec_file,
            spec_output
        )
    except Exception as e:
        print(f"Failed to generate spec.json: {e}")
        raise SystemExit(1)

    print(f"\nSuccessfully parsed twin: {twin_name}")
    print(f"Output directory: {output_dir}")

    print("\nCross-validating generated JSON files...")

    result = validate_twin(
        relation_output,
        connection_output,
        spec_output,
    )

    result.print_report()

    if not result.valid:
        print("\nCross-validation failed.")
        raise SystemExit(1)

    print("\nCross-validation passed.")


if __name__ == "__main__":
    main()