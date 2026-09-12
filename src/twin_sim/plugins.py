"""Loader for external DSL plugins."""

from pathlib import Path

from twin_sim.behaviors.dsl import DslBehavior
from twin_sim.behaviors.registry import register_plugin_behavior


def _create_factory(name: str, code: str):
    # Enclose in a closure to avoid late binding issues in loops
    def factory():
        return DslBehavior(name, code)
    return factory


def load_plugins_from_directory(directory: Path | str) -> None:
    path = Path(directory)
    if not path.is_dir():
        return
        
    for filepath in path.glob("*.ptb"):
        if filepath.is_file():
            name = filepath.stem
            code = filepath.read_text(encoding="utf-8")
            factory = _create_factory(name, code)
            register_plugin_behavior(name, factory)
