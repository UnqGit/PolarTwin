"""
Structured error taxonomy for PolarTwin (implementation_plan.md Phase 1).

All errors include stable error codes and, where applicable, source locations
so that frontend diagnostics receive actionable information.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class SourceLocation:
    """Source file location for a diagnostic."""

    file: str
    line: int
    column: int = 0

    def __str__(self) -> str:
        if self.column:
            return f"{self.file}:{self.line}:{self.column}"
        return f"{self.file}:{self.line}"


class PolarTwinError(Exception):
    """Base class for all PolarTwin errors."""

    code: str = "POLAR_TWIN_ERROR"

    def __init__(
        self,
        message: str,
        location: SourceLocation | None = None,
        context: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.location = location
        self.context: dict = context or {}

    def __str__(self) -> str:
        prefix = f"[{self.code}]"
        if self.location:
            return f"{prefix} {self.location}: {self.message}"
        return f"{prefix} {self.message}"


# ---------------------------------------------------------------------------
# DSL / Compiler errors
# ---------------------------------------------------------------------------


class LexicalError(PolarTwinError):
    """Invalid token or character in source DSL."""

    code = "LEXICAL_ERROR"


class ParseError(PolarTwinError):
    """Syntactically invalid DSL structure."""

    code = "PARSE_ERROR"


class SemanticValidationError(PolarTwinError):
    """Structurally valid but semantically invalid DSL."""

    code = "SEMANTIC_VALIDATION_ERROR"


class ReferenceResolutionError(PolarTwinError):
    """Reference to an unknown or undeclared identifier."""

    code = "REFERENCE_RESOLUTION_ERROR"


class UnitValidationError(PolarTwinError):
    """Invalid, unrecognised, or non-canonical measurement unit."""

    code = "UNIT_VALIDATION_ERROR"


class ScenarioValidationError(PolarTwinError):
    """Invalid scene or event file."""

    code = "SCENARIO_VALIDATION_ERROR"


# ---------------------------------------------------------------------------
# Runtime errors
# ---------------------------------------------------------------------------


class SimulationError(PolarTwinError):
    """Error occurring during simulation execution."""

    code = "SIMULATION_ERROR"


class PersistenceError(PolarTwinError):
    """Error reading from or writing to the persistence layer."""

    code = "PERSISTENCE_ERROR"


# ---------------------------------------------------------------------------
# Diagnostic accumulator
# ---------------------------------------------------------------------------


@dataclass
class Diagnostic:
    """A single compiler or validator diagnostic."""

    code: str
    message: str
    severity: str = "error"   # "error" | "warning"
    location: Optional[SourceLocation] = None
    context: dict = field(default_factory=dict)

    @property
    def is_error(self) -> bool:
        return self.severity == "error"

    @property
    def is_warning(self) -> bool:
        return self.severity == "warning"

    def __str__(self) -> str:
        prefix = f"[{self.severity.upper()} {self.code}]"
        if self.location:
            return f"{prefix} {self.location}: {self.message}"
        return f"{prefix} {self.message}"


@dataclass
class DiagnosticBag:
    """Accumulates diagnostics during parsing/compilation/validation."""

    diagnostics: list[Diagnostic] = field(default_factory=list)

    def add_error(
        self,
        code: str,
        message: str,
        location: SourceLocation | None = None,
        context: dict | None = None,
    ) -> None:
        self.diagnostics.append(
            Diagnostic(
                code=code,
                message=message,
                severity="error",
                location=location,
                context=context or {},
            )
        )

    def add_warning(
        self,
        code: str,
        message: str,
        location: SourceLocation | None = None,
        context: dict | None = None,
    ) -> None:
        self.diagnostics.append(
            Diagnostic(
                code=code,
                message=message,
                severity="warning",
                location=location,
                context=context or {},
            )
        )

    @property
    def errors(self) -> list[Diagnostic]:
        return [d for d in self.diagnostics if d.is_error]

    @property
    def warnings(self) -> list[Diagnostic]:
        return [d for d in self.diagnostics if d.is_warning]

    @property
    def has_errors(self) -> bool:
        return any(d.is_error for d in self.diagnostics)

    def raise_if_errors(self, error_class: type[PolarTwinError] = SemanticValidationError) -> None:
        """Raise an aggregated error if any errors are present."""
        if self.has_errors:
            messages = "\n".join(str(d) for d in self.errors)
            raise error_class(f"Validation failed with {len(self.errors)} error(s):\n{messages}")

    def __len__(self) -> int:
        return len(self.diagnostics)

    def __iter__(self):
        return iter(self.diagnostics)
