"""Minimal AST-based Domain Specific Language for safe plugin execution."""

from __future__ import annotations

import ast
import operator
from typing import Any

from twin_sim.model import Component
from .base import Behavior, BehaviorContext


class DslExecutionError(Exception):
    pass


class DslEvaluator(ast.NodeVisitor):
    def __init__(self, state: dict[str, Any], inputs: dict[str, Any], env: dict[str, Any], dt: float) -> None:
        self.state = state
        self.inputs = inputs
        self.env = env
        self.dt = dt
        self.locals: dict[str, Any] = {}
        self.proposals: dict[str, Any] = {}
        self.operations = {
            ast.Add: operator.add,
            ast.Sub: operator.sub,
            ast.Mult: operator.mul,
            ast.Div: operator.truediv,
            ast.Mod: operator.mod,
            ast.Pow: operator.pow,
            ast.Eq: operator.eq,
            ast.NotEq: operator.ne,
            ast.Lt: operator.lt,
            ast.LtE: operator.le,
            ast.Gt: operator.gt,
            ast.GtE: operator.ge,
            ast.And: lambda a, b: a and b,
            ast.Or: lambda a, b: a or b,
            ast.Not: operator.not_,
            ast.USub: operator.neg,
            ast.UAdd: operator.pos,
        }

    def visit_Module(self, node: ast.Module) -> None:
        for stmt in node.body:
            self.visit(stmt)

    def visit_Assign(self, node: ast.Assign) -> None:
        value = self.visit(node.value)
        for target in node.targets:
            if isinstance(target, ast.Name):
                self.locals[target.id] = value
            elif isinstance(target, ast.Attribute):
                if isinstance(target.value, ast.Name) and target.value.id == "state":
                    self.proposals[target.attr] = value
                else:
                    raise DslExecutionError(f"Can only assign to 'state.*' or local variables, got {ast.dump(target)}")
            else:
                raise DslExecutionError("Unsupported assignment target")

    def visit_Name(self, node: ast.Name) -> Any:
        if isinstance(node.ctx, ast.Load):
            if node.id in self.locals:
                return self.locals[node.id]
            if node.id == "dt":
                return self.dt
            if node.id in ("True", "False", "None"):
                return {"True": True, "False": False, "None": None}[node.id]
            raise DslExecutionError(f"Undefined variable: {node.id}")
        return node.id

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        if isinstance(node.value, ast.Name):
            if node.value.id == "state":
                if node.attr in self.proposals:
                    return self.proposals[node.attr]
                return self.state.get(node.attr)
            if node.value.id == "input":
                return self.inputs.get(node.attr)
            if node.value.id == "env":
                return self.env.get(node.attr)
        raise DslExecutionError(f"Unsupported attribute access: {ast.dump(node)}")

    def visit_Constant(self, node: ast.Constant) -> Any:
        return node.value

    def visit_BinOp(self, node: ast.BinOp) -> Any:
        left = self.visit(node.left)
        right = self.visit(node.right)
        op_type = type(node.op)
        if op_type in self.operations:
            try:
                return self.operations[op_type](left, right)
            except Exception as e:
                raise DslExecutionError(f"Math error in '{op_type.__name__}': {e}")
        raise DslExecutionError(f"Unsupported binary operator: {op_type}")

    def visit_UnaryOp(self, node: ast.UnaryOp) -> Any:
        operand = self.visit(node.operand)
        op_type = type(node.op)
        if op_type in self.operations:
            return self.operations[op_type](operand)
        raise DslExecutionError(f"Unsupported unary operator: {op_type}")

    def visit_BoolOp(self, node: ast.BoolOp) -> Any:
        if isinstance(node.op, ast.And):
            for value in node.values:
                if not self.visit(value):
                    return False
            return True
        elif isinstance(node.op, ast.Or):
            for value in node.values:
                if self.visit(value):
                    return True
            return False
        raise DslExecutionError(f"Unsupported boolean operator: {type(node.op)}")

    def visit_Compare(self, node: ast.Compare) -> Any:
        left = self.visit(node.left)
        for op, right in zip(node.ops, node.comparators):
            op_type = type(op)
            if op_type not in self.operations:
                raise DslExecutionError(f"Unsupported comparator: {op_type}")
            r = self.visit(right)
            if not self.operations[op_type](left, r):
                return False
            left = r
        return True

    def visit_If(self, node: ast.If) -> None:
        test_val = self.visit(node.test)
        if test_val:
            for stmt in node.body:
                self.visit(stmt)
        else:
            for stmt in node.orelse:
                self.visit(stmt)
                
    def visit_Expr(self, node: ast.Expr) -> Any:
        return self.visit(node.value)
        
    def visit_Pass(self, node: ast.Pass) -> None:
        pass

    def generic_visit(self, node: ast.AST) -> None:
        raise DslExecutionError(f"Unsupported syntax node: {type(node).__name__}")


class DslBehavior(Behavior):
    level = "specialized"
    
    def __init__(self, name: str, code: str) -> None:
        self.name = name
        try:
            self.ast_tree = ast.parse(code, mode="exec")
        except SyntaxError as e:
            raise ValueError(f"DSL syntax error in {name}: {e}")
            
        # Optional: pre-validate all nodes by traversing once to ensure no invalid nodes exist before execution
        for node in ast.walk(self.ast_tree):
            if type(node) not in (
                ast.Module, ast.Assign, ast.Name, ast.Store, ast.Load,
                ast.Attribute, ast.Constant, ast.BinOp, ast.UnaryOp,
                ast.BoolOp, ast.Compare, ast.If, ast.Expr, ast.Pass,
                ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow,
                ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
                ast.And, ast.Or, ast.Not, ast.USub, ast.UAdd
            ):
                raise ValueError(f"DSL security error in {name}: unsupported syntax node {type(node).__name__}")
            
    def evaluate(self, component: Component, context: BehaviorContext, dt: float) -> dict[str, Any]:
        state = dict(component.runtime_state.values)
        inputs = state.get("inputs", {})
        env = dict(context.values.get("environment", {}))
        
        evaluator = DslEvaluator(state, inputs, env, dt)
        evaluator.visit(self.ast_tree)
        return evaluator.proposals
