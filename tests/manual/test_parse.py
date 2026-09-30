import sys
import os
sys.path.append(os.getcwd())
from compiler.parser.utils import strip_comments
text = "count=0:50 #count of the number of people\n"
print("'" + strip_comments(text) + "'")
