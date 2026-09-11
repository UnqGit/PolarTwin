"""Structured causal tracking and explainability engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CausalCause:
    component: str
    event: str
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        res = {"component": self.component, "event": self.event}
        if self.details:
            res.update(self.details)
        return res


@dataclass
class CausalEffect:
    component: str
    state_change: str
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        res = {"component": self.component, "state_change": self.state_change}
        if self.details:
            res.update(self.details)
        return res


@dataclass
class CausalEvent:
    timestamp: float
    cause: CausalCause
    effects: list[CausalEffect] = field(default_factory=list)
    chain: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "cause": self.cause.to_dict(),
            "effects": [e.to_dict() for e in self.effects],
        }


@dataclass
class CausalExplanation:
    target_component: str
    question: str
    chain: list[str]
    events: list[CausalEvent] = field(default_factory=list)

    def format_text(self) -> str:
        lines = [self.question, ""]
        if not self.chain:
            return "\n".join([self.question, "", "No causal events recorded."])
        for i, step in enumerate(self.chain):
            lines.append(step)
            if i < len(self.chain) - 1:
                lines.append("        |")
                lines.append("        v")
        return "\n".join(lines)

    def to_dict(self) -> list[dict[str, Any]]:
        return [event.to_dict() for event in self.events]


class CausalTracer:
    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self.events: list[CausalEvent] = []

    def record_event(self, event: CausalEvent) -> None:
        if not self.enabled:
            return
        self.events.append(event)

    def record_cause_and_effects(
        self,
        timestamp: float,
        cause_component: str,
        cause_event: str,
        effects: list[tuple[str, str]],
        chain: list[str] | None = None,
    ) -> CausalEvent | None:
        if not self.enabled:
            return None
        event = CausalEvent(
            timestamp=timestamp,
            cause=CausalCause(component=cause_component, event=cause_event),
            effects=[CausalEffect(component=c, state_change=s) for c, s in effects],
            chain=chain or [],
        )
        self.events.append(event)
        return event

    def explain(self, component: str, question: str | None = None) -> CausalExplanation:
        question = question or f"WHY did {component} change state?"
        chain: list[str] = []
        events: list[CausalEvent] = []
        
        for event in self.events:
            for effect in event.effects:
                if effect.component == component:
                    if event not in events:
                        events.append(event)
                        if event.chain:
                            if chain and chain[-1] == event.chain[0]:
                                chain.extend(event.chain[1:])
                            else:
                                if chain:
                                    chain.append("        |")
                                    chain.append("        v")
                                chain.extend(event.chain)

        if not events:
            chain = [f"Component operated in steady state with no external disturbances or failure events."]

        return CausalExplanation(
            target_component=component,
            question=question,
            chain=chain,
            events=events,
        )

    def to_dict(self) -> list[dict[str, Any]]:
        return [e.to_dict() for e in self.events]
