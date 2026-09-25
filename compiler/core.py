import argparse
import json
from pathlib import Path

from compiler.parser.hierarchy_parser import parse_hierarchy_file
from compiler.parser.connection_parser import parse_connection_file
from compiler.parser.spec_parser import parse_spec_file
from compiler.cross_validator import validate_asts, CrossValidationError

def compile_station(input_dir: Path, output_dir: Path):
    """
    Compile a polar station from .twin source files to .json ASTs.
    """
    hierarchy_file = input_dir / "hierarchy.twin"
    connection_file = input_dir / "connection.twin"
    spec_file = input_dir / "spec.twin"
    
    if not hierarchy_file.exists():
        raise FileNotFoundError(f"Missing {hierarchy_file}")
    if not connection_file.exists():
        raise FileNotFoundError(f"Missing {connection_file}")
    if not spec_file.exists():
        raise FileNotFoundError(f"Missing {spec_file}")
        
    print(f"Compiling from {input_dir}...")
    
    # 1. Parse hierarchy.twin
    hierarchy_components = parse_hierarchy_file(hierarchy_file)
    print(f"Parsed {len(hierarchy_components)} hierarchy components.")
    
    # 2. Parse connection.twin
    connections = parse_connection_file(connection_file, hierarchy_components)
    print(f"Parsed {len(connections)} connections.")
    
    # 3. Parse spec.twin
    specs = parse_spec_file(spec_file, hierarchy_components)
    print(f"Parsed {len(specs)} component specifications.")
    
    # 4. Cross-file Validation
    try:
        validate_asts(hierarchy_components, connections, specs)
        print("Cross-file AST validation passed.")
    except CrossValidationError as e:
        print(f"Cross-Validation Error: {e}")
        raise
        
    # 5. Emit JSON artifacts
    output_dir.mkdir(parents=True, exist_ok=True)
    
    hierarchy_out = output_dir / "hierarchy.json"
    connection_out = output_dir / "connection.json"
    spec_out = output_dir / "spec.json"
    
    with open(hierarchy_out, "w", encoding="utf-8") as f:
        json.dump([c.to_dict() for c in hierarchy_components], f, indent=2)
        
    with open(connection_out, "w", encoding="utf-8") as f:
        json.dump([c.to_dict() for c in connections], f, indent=2)
        
    with open(spec_out, "w", encoding="utf-8") as f:
        json.dump([s.to_dict() for s in specs], f, indent=2)
        
    print(f"Successfully generated compiler outputs in {output_dir}")

def main():
    parser = argparse.ArgumentParser(description="PolarTwin Compiler Entrypoint")
    parser.add_argument("--input", "-i", type=str, required=True, help="Input directory containing .twin files")
    parser.add_argument("--output", "-o", type=str, required=True, help="Output directory for compiled .json files")
    
    args = parser.parse_args()
    
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    
    compile_station(input_dir, output_dir)

if __name__ == "__main__":
    main()
