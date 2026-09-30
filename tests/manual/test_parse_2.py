import sys, os
sys.path.append(os.getcwd())
from compiler.parser.spec_parser import parse_spec_file
from pathlib import Path
try:
    parse_spec_file(Path("data/source/Maitri/spec.twin"), [])
except Exception as e:
    import traceback
    traceback.print_exc()
