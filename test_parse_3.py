import sys, os
sys.path.append(os.getcwd())
from compiler.parser.spec_parser import parse_spec_file
from pathlib import Path

def debug_parse():
    with open("data/source/Maitri/spec.twin", "r") as f:
        text = f.read()
    lines = text.splitlines()
    scope_stack = []
    for i, l in enumerate(lines, 1):
        l = l.strip()
        if "{" in l:
            scope_stack.append((i, l))
        if "}" in l:
            if scope_stack:
                scope_stack.pop()
            else:
                print(f"Extra }} at {i}")
    for i, l in scope_stack:
        print(f"Unclosed {{ at {i}: {l}")

debug_parse()
