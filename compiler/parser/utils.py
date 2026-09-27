import re

def strip_comments(text: str) -> str:
    """
    Strips single-line (#) and multi-line (/* ... */) comments from the text.
    Preserves line numbers by replacing multi-line comments with the equivalent
    number of newlines. Does not strip '#' if it is inside a string literal.
    """
    # Pattern matches:
    # 1) Double-quoted strings
    # 2) Single-quoted strings
    # 3) Block comments /* ... */
    # 4) Line comments # ...
    pattern = re.compile(
        r'(?P<string>"(?:\\.|[^"])*"|\'(?:\\.|[^\'])*\')|(?P<block_comment>/\*.*?\*/)|(?P<line_comment>#.*)',
        re.DOTALL
    )

    def replacer(match):
        if match.group('string'):
            # Return the string exactly as it is
            return match.group('string')
        elif match.group('block_comment'):
            # Return the same number of newlines to preserve line numbering
            return '\n' * match.group('block_comment').count('\n')
        elif match.group('line_comment'):
            # Line comments can just be removed
            return ''
        return match.group(0)

    return pattern.sub(replacer, text)
