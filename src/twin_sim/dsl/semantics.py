import re
from typing import Any, Dict, List, Optional
from twin_sim.ingestion.models import RuntimeComponent, RuntimeConnection, ExternalModel
from packages.shared_models.errors import ParseError

class SemanticError(ParseError):
    pass

# ---------------------------------------------------------
# WHERE Semantics (AST & Evaluator)
# ---------------------------------------------------------

class ASTNode:
    def evaluate(self, node: Any, state: Dict[str, Any]) -> bool:
        raise NotImplementedError()

class ComparisonNode(ASTNode):
    def __init__(self, left: str, op: str, right: str):
        self.left = left
        self.op = op
        self.right = right

    def evaluate(self, node: Any, state: Dict[str, Any]) -> bool:
        left_val = self._resolve_path(self.left, node, state)
        right_val = self._parse_literal(self.right)

        if left_val is None:
            return False

        try:
            if self.op == "=": return left_val == right_val
            if self.op == "!=": return left_val != right_val
            if self.op == ">": return float(left_val) > float(right_val)
            if self.op == "<": return float(left_val) < float(right_val)
            if self.op == ">=": return float(left_val) >= float(right_val)
            if self.op == "<=": return float(left_val) <= float(right_val)
        except (ValueError, TypeError):
            return False
        return False

    def _resolve_path(self, path: str, node: Any, state: Dict[str, Any]) -> Any:
        # Handle @connection(...) and @component(...) lookups
        if path.startswith("@connection("):
            return self._resolve_connection_lookup(path, node, state)
        if path.startswith("@component("):
            return self._resolve_component_lookup(path, node, state)
            
        # Standard field lookup
        return self._get_nested_field(node, path)

    def _get_nested_field(self, obj: Any, path: str) -> Any:
        parts = path.split(".")
        current = obj
        for p in parts:
            if isinstance(current, dict):
                current = current.get(p)
            elif hasattr(current, p):
                current = getattr(current, p)
            else:
                return None
            if current is None:
                return None
        return current

    def _resolve_connection_lookup(self, path: str, node: Any, state: Dict[str, Any]) -> Any:
        # e.g., @connection(@node|data|).status
        m = re.match(r"^@connection\((.*?)\)(?:\.(.*))?$", path)
        if not m:
            raise SemanticError(f"Invalid @connection syntax: {path}")
            
        selector, sub_path = m.groups()
        parts = selector.split("|")
        if len(parts) != 3:
            raise SemanticError(f"@connection selector must have 3 parts: {selector}")
            
        src_query, type_query, tgt_query = parts
        
        # Determine the contextual @node name
        node_name = getattr(node, "name", None)
        
        connections = state.get("connections", [])
        
        # Check if there is any connection matching the query
        for c in connections:
            if src_query:
                if src_query == "@node" and c.source != node_name: continue
                elif src_query != "@node" and c.source != src_query: continue
                
            if type_query and c.type != type_query: continue
                
            if tgt_query:
                if tgt_query == "@node" and c.target != node_name: continue
                elif tgt_query.startswith("@component.type="):
                    # need to check target component type
                    tgt_type_req = tgt_query.split("=")[1]
                    tgt_comp = next((x for x in state.get("components", []) if x.name == c.target), None)
                    if not tgt_comp or tgt_comp.type != tgt_type_req: continue
                elif tgt_query != "@node" and c.target != tgt_query: continue
                
            # Found a matching connection
            if sub_path:
                return self._get_nested_field(c, sub_path)
            return True # Just checking existence
            
        return False

    def _resolve_component_lookup(self, path: str, node: Any, state: Dict[str, Any]) -> Any:
        # e.g., @component(source).type
        m = re.match(r"^@component\((.*?)\)(?:\.(.*))?$", path)
        if not m:
            raise SemanticError(f"Invalid @component syntax: {path}")
            
        rel, sub_path = m.groups()
        if rel not in ("source", "target"):
            raise SemanticError(f"@component relationship must be source or target: {rel}")
            
        # node must be a connection
        target_name = getattr(node, rel, None)
        if not target_name: return None
        
        comp = next((x for x in state.get("components", []) if x.name == target_name), None)
        if not comp: return None
        
        if sub_path:
            return self._get_nested_field(comp, sub_path)
        return True

    def _parse_literal(self, val: str) -> Any:
        if val == "true": return True
        if val == "false": return False
        try:
            if "." in val: return float(val)
            return int(val)
        except ValueError:
            return val

class ExistsNode(ASTNode):
    def __init__(self, path: str):
        self.path = path
        
    def evaluate(self, node: Any, state: Dict[str, Any]) -> bool:
        comp = ComparisonNode(self.path, "=", "true")
        res = comp._resolve_path(self.path, node, state)
        return bool(res)

def build_where_ast(clause: str) -> ASTNode:
    # e.g., value.temperature>30.0
    # or @connection(@node|data|)
    
    # Check relational operators
    for op in (">=", "<=", "!=", "=", ">", "<"):
        if op in clause:
            # But wait, @connection(@node||@component.type=generator) contains `=` inside the parentheses!
            # We must only split on the *outermost* operator.
            # A simple hack: split only if it's not inside parentheses.
            in_parens = 0
            for i, char in enumerate(clause):
                if char == "(": in_parens += 1
                elif char == ")": in_parens -= 1
                elif in_parens == 0:
                    if clause[i:i+len(op)] == op:
                        left = clause[:i].strip()
                        right = clause[i+len(op):].strip()
                        return ComparisonNode(left, op, right)
                        
    # If no outer operator, it's an existence check
    return ExistsNode(clause)

def evaluate_node(node: Any, where_clauses: List[str], state: Dict[str, Any]) -> bool:
    for clause in where_clauses:
        # Split by `&` at the outer level (handled loosely here by assuming `&` is already split in the parser)
        # Actually in parser I split by `& \n`, but if it's inline, we might need to split it here if not done.
        # Assuming `clause` is a single condition.
        ast = build_where_ast(clause.strip())
        if not ast.evaluate(node, state):
            return False
    return True

# ---------------------------------------------------------
# SET Semantics (Payload Application & Expiration)
# ---------------------------------------------------------

def dict_deep_update(base: Dict[str, Any], overrides: Dict[str, Any]):
    for k, v in overrides.items():
        if isinstance(v, dict) and k in base and isinstance(base[k], dict):
            dict_deep_update(base[k], v)
        else:
            base[k] = v

def _set_nested_field(obj: Any, path: str, value: Any):
    parts = path.split(".")
    current = obj
    for p in parts[:-1]:
        if isinstance(current, dict):
            if p not in current:
                current[p] = {}
            current = current[p]
        elif hasattr(current, p):
            current = getattr(current, p)
            
    last = parts[-1]
    if isinstance(current, dict):
        current[last] = value
    elif hasattr(current, last):
        setattr(current, last, value)

def apply_set(node: Any, fixed_sets: Dict[str, Any], payload: Dict[str, Any], set_allowed: List[str], set_fields_allowed: bool):
    """
    Applies the fixed mutations and dynamic payload to a given node.
    Enforces restrictions (`set_allowed` and `set_fields_allowed`).
    `is_backup` is immutable.
    """
    # 1. Reject immutable field changes
    if "is_backup" in fixed_sets or "is_backup" in payload:
        raise SemanticError("is_backup is immutable and cannot be set")
        
    # 2. Check payload restrictions against set_allowed / set_fields_allowed
    if not set_fields_allowed:
        for key in payload.keys():
            if key not in set_allowed and not any(a.startswith(f"{key}.") for a in set_allowed):
                # If they try to set `value` but only `value.temperature` is allowed, we must recursively check.
                # For simplicity in this DSL, if `set_fields_allowed` is False, the root key must be explicitly allowed.
                if not any(k == key or k.startswith(f"{key}.") for k in set_allowed):
                    raise SemanticError(f"Field '{key}' is not allowed to be modified by the scene payload")

    # 3. Apply scene payload
    # Note: Payload could be nested dicts. We deep update it into the node.
    if isinstance(node, dict):
        dict_deep_update(node, payload)
    else:
        # Pydantic model
        for k, v in payload.items():
            if hasattr(node, k):
                current_attr = getattr(node, k)
                if isinstance(current_attr, dict) and isinstance(v, dict):
                    dict_deep_update(current_attr, v)
                else:
                    setattr(node, k, v)
            else:
                # If it's a dynamic field in 'value' dict, try putting it there
                if hasattr(node, "value") and isinstance(getattr(node, "value"), dict):
                    current_val = getattr(node, "value")
                    current_val[k] = v
                else:
                    setattr(node, k, v)
                    
    # 4. Apply fixed sets (they override payload)
    for k, v in fixed_sets.items():
        if k == "is_backup": continue
        _set_nested_field(node, k, v)
