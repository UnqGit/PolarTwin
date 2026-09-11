"""Command-line composition layer for validation, inspection, and runs."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.ingestion.loaders import load_model_inputs
from twin_sim.ingestion.validator import ValidationError, load_json
from twin_sim.outputs import JsonlSink, create_sink
from twin_sim.observability import build_quality_report
from twin_sim.scenarios import ScenarioScheduler, load_scenario_events
from twin_sim.simulation import SimulationEngine


def _inputs(args):
    return load_model_inputs(args.topology, args.spec)


def _scenario(engine, path):
    if path:
        ScenarioScheduler().schedule(engine, load_scenario_events(path))


def command_validate(args) -> int:
    _inputs(args)
    print("VALID")
    return 0


def command_inspect(args) -> int:
    topology, specification = _inputs(args)
    graph = compile_model(topology, specification)
    behavior_counts: dict[str, int] = {}
    for component in graph.components.values():
        name = component.behavior.name if component.behavior else "none"
        behavior_counts[name] = behavior_counts.get(name, 0) + 1
    print(json.dumps({
        "root": graph.root.name,
        "components": len(graph.components),
        "connections": len(graph.connections),
        "behaviors": behavior_counts,
        "diagnostics": graph.diagnostics,
    }, sort_keys=True))
    return 0


def command_graph(args) -> int:
    topology, specification = _inputs(args)
    graph = compile_model(topology, specification)
    for connection in graph.connections:
        print(f"{connection.source}{connection.direction}{connection.target}@{connection.type}")
    return 0


def command_quality(args) -> int:
    topology, specification = _inputs(args)
    report = build_quality_report(compile_model(topology, specification))
    print(json.dumps(report.to_dict(), sort_keys=True))
    return 0


def _write_messages(messages, output: str | None) -> None:
    if output:
        sink = JsonlSink(output)
        with sink:
            for message in messages:
                sink.write(message)
        return
    for message in messages:
        print(json.dumps(message.to_dict(), sort_keys=True))


def _run_engine(args):
    topology, specification = _inputs(args)
    graph = compile_model(topology, specification)
    engine = SimulationEngine(
        graph,
        tick_interval=args.tick_interval,
        time_scale=args.time_scale,
        seed=args.seed,
        run_id=args.run_id,
        environment=json.loads(args.environment) if args.environment else None,
    )
    _scenario(engine, args.scenario)
    engine.run(duration=args.duration)
    return engine


def command_run(args) -> int:
    engine = _run_engine(args)
    _write_messages(engine.telemetry, args.output)
    return 0


def command_generate(args) -> int:
    engine = _run_engine(args)
    configuration = load_json(args.mqtt_config)
    sink = create_sink(configuration)
    try:
        sink.start()
        for message in engine.telemetry:
            sink.write(message)
        sink.flush()
    finally:
        sink.close()
    print(json.dumps({"messages": len(engine.telemetry), "sink": configuration.get("type")}))
    return 0


def command_validate_simulation(args) -> int:
    topology, specification = _inputs(args)
    graph = compile_model(topology, specification)
    events = load_scenario_events(args.scenario) if args.scenario else []
    targets = set(graph.components)
    for event in events:
        if event.target and event.target not in targets:
            raise ValidationError(f"scenario event '{event.id}' references unknown component '{event.target}'")
    print(json.dumps({"valid": True, "events": len(events), "diagnostics": graph.diagnostics}, sort_keys=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="twin-sim")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_inputs(command):
        command.add_argument("--topology", required=True)
        command.add_argument("--spec", required=True)

    validate = subparsers.add_parser("validate")
    add_inputs(validate)
    validate.set_defaults(handler=command_validate)

    inspect = subparsers.add_parser("inspect")
    add_inputs(inspect)
    inspect.set_defaults(handler=command_inspect)

    graph = subparsers.add_parser("graph")
    add_inputs(graph)
    graph.set_defaults(handler=command_graph)

    quality = subparsers.add_parser("quality")
    add_inputs(quality)
    quality.set_defaults(handler=command_quality)

    run = subparsers.add_parser("run")
    add_inputs(run)
    run.add_argument("--scenario")
    run.add_argument("--duration", type=float, default=1)
    run.add_argument("--tick-interval", type=float, default=1)
    run.add_argument("--time-scale", type=float, default=1)
    run.add_argument("--seed", type=int)
    run.add_argument("--run-id", default="run-cli")
    run.add_argument("--environment", help="JSON object of initial environment values")
    run.add_argument("--output")
    run.set_defaults(handler=command_run)

    generate = subparsers.add_parser("generate")
    for action in ("topology", "spec", "scenario"):
        generate.add_argument(f"--{action}", required=action != "scenario")
    generate.add_argument("--mqtt-config", required=True)
    generate.add_argument("--duration", type=float, default=1)
    generate.add_argument("--tick-interval", type=float, default=1)
    generate.add_argument("--time-scale", type=float, default=1)
    generate.add_argument("--seed", type=int)
    generate.add_argument("--run-id", default="run-generate")
    generate.add_argument("--environment")
    generate.set_defaults(handler=command_generate)

    dry_run = subparsers.add_parser("validate-simulation")
    add_inputs(dry_run)
    dry_run.add_argument("--scenario")
    dry_run.set_defaults(handler=command_validate_simulation)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.handler(args)
    except (ValidationError, KeyError, ValueError, RuntimeError) as exc:
        parser.error(str(exc))
        return 2


if __name__ == "__main__":
    sys.exit(main())