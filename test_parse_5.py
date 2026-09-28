import sys, os
sys.path.append(os.getcwd())
from compiler.parser.utils import strip_comments

with open("data/source/Maitri/spec.twin", "r") as f:
    text = f.read()

stripped = strip_comments(text)
with open("data/source/Maitri/spec.stripped.twin", "w") as f:
    f.write(stripped)
