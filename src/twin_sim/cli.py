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


def command_explain(args) -> int:
    _, _get = _merge_config(args)
    engine = _run_engine(args, _get)
    engine.run(duration=_get("duration", 1.0))
    explanation = engine.tracer.explain(args.component)
    if args.json:
        print(json.dumps(explanation.to_dict(), sort_keys=True, indent=2))
    else:
        print(explanation.format_text())
    return 0


def command_trace(args) -> int:
    _, _get = _merge_config(args)
    engine = _run_engine(args, _get)
    engine.run(duration=_get("duration", 1.0))
    if args.component:
        events = [e for e in engine.tracer.events if any(eff.component == args.component for eff in e.effects)]
    else:
        events = engine.tracer.events
    
    if args.json:
        print(json.dumps([e.to_dict() for e in events], sort_keys=True, indent=2))
    else:
        for event in events:
            print(f"[{event.timestamp}] {event.cause.component} {event.cause.event}")
            for effect in event.effects:
                print(f"  -> {effect.component}: {effect.state_change}")
    return 0


from twin_sim.outputs import create_sink, AsyncTelemetryPipeline, JsonlSink, MultiSink
from twin_sim.ingestion.config import load_runtime_config

def _merge_config(args):
    config = {}
    if getattr(args, "config", None):
        config = load_runtime_config(args.config)
        
    def _get(key, default=None):
        val = getattr(args, key, None)
        if val is not None:
            return val
        if key in config:
            return config[key]
        return default
        
    return config, _get


def _write_messages(messages, output_file):
    if output_file:
        sink = JsonlSink(output_file)
        with sink:
            for message in messages:
                sink.write(message)
        return
    for message in messages:
        print(json.dumps(message.to_dict(), sort_keys=True))


def _run_engine(args, _get=None):
    if _get is None:
        _, _get = _merge_config(args)
    topology, specification = _inputs(args)
    
    val_arg = _get("validation")
    validation_config = None
    if val_arg:
        validation_config = json.loads(val_arg) if isinstance(val_arg, str) else val_arg

    plugins_dir = _get("plugins")
    if plugins_dir:
        from twin_sim.plugins import load_plugins_from_directory
        load_plugins_from_directory(plugins_dir)

    graph = compile_model(topology, specification, validation_config)
    
    env_arg = _get("environment")
    environment = None
    if env_arg:
        environment = json.loads(env_arg) if isinstance(env_arg, str) else env_arg

    engine = SimulationEngine(
        graph,
        tick_interval=_get("tick_interval", 1.0),
        time_scale=_get("time_scale", 1.0),
        seed=_get("seed", None),
        run_id=_get("run_id", "run-cli"),
        environment=environment,
        debug=_get("debug", True) if getattr(args, "command", "") in ("explain", "trace") else _get("debug", False),
        validation_config=validation_config,
    )
    _scenario(engine, getattr(args, "scenario", None))
    return engine


def command_run(args) -> int:
    config, _get = _merge_config(args)
    engine = _run_engine(args, _get)
    
    sinks = []
    if "outputs" in config:
        for output_cfg in config["outputs"]:
            if output_cfg.get("enabled", True):
                sinks.append(create_sink(output_cfg))
    elif args.output:
        sinks.append(JsonlSink(args.output))
    else:
        sinks.append(create_sink({"type": "stdout"}))
        
    multi_sink = MultiSink(sinks)
    pipeline = AsyncTelemetryPipeline(multi_sink, backpressure_policy="drop")
    engine.telemetry_sink = pipeline
    engine.telemetry_batch_size = 100
    
    try:
        pipeline.start()
        engine.run(duration=_get("duration", 1.0))
        pipeline.flush()
    finally:
        pipeline.close()
        
    import sys
    sys.stdout.flush()

    return 0


def command_generate(args) -> int:
    config, _get = _merge_config(args)
    engine = _run_engine(args, _get)
    
    sinks = []
    if getattr(args, "mqtt_config", None):
        configuration = load_json(args.mqtt_config)
        sinks.append(create_sink(configuration))
    elif "outputs" in config:
        for output_cfg in config["outputs"]:
            if output_cfg.get("enabled", True):
                sinks.append(create_sink(output_cfg))
                
    if not sinks:
        print("No outputs configured. Use --mqtt-config or --config with outputs array.")
        return 1

    multi_sink = MultiSink(sinks)
    pipeline = AsyncTelemetryPipeline(multi_sink, backpressure_policy="drop")
    engine.telemetry_sink = pipeline
    engine.telemetry_batch_size = 100
    
    try:
        pipeline.start()
        engine.run(duration=_get("duration", 1.0))
        pipeline.flush()
    finally:
        pipeline.close()
    
    dropped = pipeline.dropped_batches
    print(json.dumps({"sinks": len(sinks), "dropped_batches": dropped}))
    return 0


def command_validate_simulation(args) -> int:
    topology, specification = _inputs(args)
    validation_config = json.loads(args.validation) if getattr(args, "validation", None) else None
    graph = compile_model(topology, specification, validation_config)
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
        command.add_argument(
            "--validation",
            choices=["error", "warning", "ignore"],
            help="validation strictness (overrides config JSON)",
        )
        command.add_argument(
            "--plugins",
            type=str,
            help="path to external plugins directory (overrides config JSON)",
        )

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
    run.add_argument("--config", help="Runtime configuration JSON file")
    run.add_argument("--scenario")
    run.add_argument("--duration", type=float, default=None)
    run.add_argument("--tick-interval", type=float, default=None)
    run.add_argument("--time-scale", type=float, default=None)
    run.add_argument("--seed", type=int)
    run.add_argument("--run-id", default=None)
    run.add_argument("--environment", help="JSON object of initial environment values")
    run.add_argument("--output")
    run.add_argument("--debug", action="store_true", help="Enable debug causal tracing")
    run.set_defaults(handler=command_run)

    generate = subparsers.add_parser("generate")
    for action in ("topology", "spec", "scenario"):
        generate.add_argument(f"--{action}", required=action != "scenario")
    generate.add_argument("--config", help="Runtime configuration JSON file")
    generate.add_argument("--mqtt-config", required=False)
    generate.add_argument("--duration", type=float, default=None)
    generate.add_argument("--tick-interval", type=float, default=None)
    generate.add_argument("--time-scale", type=float, default=None)
    generate.add_argument("--seed", type=int)
    generate.add_argument("--run-id", default=None)
    generate.add_argument("--environment")
    generate.set_defaults(handler=command_generate)

    dry_run = subparsers.add_parser("validate-simulation")
    add_inputs(dry_run)
    dry_run.add_argument("--scenario")
    dry_run.set_defaults(handler=command_validate_simulation)
    
    explain = subparsers.add_parser("explain")
    add_inputs(explain)
    explain.add_argument("--config", help="Runtime configuration JSON file")
    explain.add_argument("--scenario")
    explain.add_argument("--component", required=True)
    explain.add_argument("--duration", type=float, default=None)
    explain.add_argument("--json", action="store_true")
    explain.set_defaults(handler=command_explain)

    trace = subparsers.add_parser("trace")
    add_inputs(trace)
    trace.add_argument("--config", help="Runtime configuration JSON file")
    trace.add_argument("--scenario")
    trace.add_argument("--component")
    trace.add_argument("--duration", type=float, default=None)
    trace.add_argument("--json", action="store_true")
    trace.set_defaults(handler=command_trace)
    
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