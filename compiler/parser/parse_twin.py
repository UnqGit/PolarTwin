#!/usr/bin/env python3
import sys
from pathlib import Path

# Provide backward compatibility for scripts calling parse_twin.py directly
# by adding the parent directory to sys.path and invoking the cli main function.

_parent = Path(__file__).resolve().parent.parent
if str(_parent) not in sys.path:
    sys.path.insert(0, str(_parent))

from parser.cli import main

if __name__ == "__main__":
    main()
