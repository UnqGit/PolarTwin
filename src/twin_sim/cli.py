import argparse
import datetime
import hashlib
import json
import random
import sys
import uuid
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.ingestion.config import load_runtime_config
from twin_sim.ingestion.validator import ValidationError, load_json
from twin_sim.observability import build_quality_report
from twin_sim.outputs import AsyncTelemetryPipeline, DatabaseSink, JsonlSink, MultiSink, create_sink, TelemetrySink
from twin_sim.dsl.scene_parser import parse_scene_string
from twin_sim.simulation.engine_core import SimulationEngineCore
from twin_sim.simulation.station_loader import LoadedStation, _DEFAULT_EXTERNAL
from twin_sim.ingestion.loaders import generate_runtime_components, generate_runtime_connections
from twin_sim.storage import SQLiteAdapter


def _inputs(args):
    return load_json(args.topology), load_json(args.connection), load_json(args.spec)




def _hash_file(path_str: str | list[str] | None) -> str | None:
    if not path_str:
        return None
    if isinstance(path_str, list):
        hashes = []
        for p in path_str:
            data = load_json(p)
            content = json.dumps(data, sort_keys=True).encode("utf-8")
            hashes.append(hashlib.sha256(content).hexdigest())
        return hashlib.sha256(",".join(hashes).encode("utf-8")).hexdigest()
        
    data = load_json(path_str)
    content = json.dumps(data, sort_keys=True).encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def command_validate(args) -> int:
    _inputs(args)
    print("VALID")
    return 0


def command_inspect(args) -> int:
    topology, connections, specification = _inputs(args)
    graph = compile_model(topology, connections, specification)
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
    topology, connections, specification = _inputs(args)
    graph = compile_model(topology, connections, specification)
    for connection in graph.connections:
        print(f"{connection.source}{connection.direction}{connection.target}@{connection.type}")
    return 0


def command_quality(args) -> int:
    topology, connections, specification = _inputs(args)
    report = build_quality_report(compile_model(topology, connections, specification))
    print(json.dumps(report.to_dict(), sort_keys=True))
    return 0



def _merge_config(args):
    config = {}
    if getattr(args, "config", None):
        config = load_runtime_config(args.config)
        
    def _get(key, default=None):
        val = getattr(args, key, None)
        if val is not None:
            return val
        if key == "scenario":
            if "scenarios" in config:
                return config["scenarios"]
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


def _run_engine(args, _get=None, seed: int | None = None, run_id: str | None = None):
    if _get is None:
        _, _get = _merge_config(args)
    topology, connections, specification = _inputs(args)
    
    val_arg = _get("validation")
    validation_config = None
    if val_arg:
        validation_config = json.loads(val_arg) if isinstance(val_arg, str) else val_arg

    plugins_dir = _get("plugins")
    if plugins_dir:
        from twin_sim.plugins import load_plugins_from_directory
        load_plugins_from_directory(plugins_dir)

    graph = compile_model(topology, connections, specification, validation_config)
    
    env_arg = _get("environment")
    environment = None
    if env_arg:
        environment = json.loads(env_arg) if isinstance(env_arg, str) else env_arg
    final_seed = seed if seed is not None else _get("seed", None)
    final_run_id = run_id if run_id is not None else _get("run_id", "run-cli")

    hierarchy_list = topology if isinstance(topology, list) else [topology]
    compiled_connections = connections if isinstance(connections, list) else [connections]
    specs = specification if isinstance(specification, list) else [specification]

    runtime_components = generate_runtime_components(hierarchy_list, specs)
    runtime_conns = generate_runtime_connections(compiled_connections)
    
    assert final_run_id is not None
    station = LoadedStation(
        station_id=final_run_id,
        hierarchy_list=hierarchy_list,
        runtime_components=runtime_components,
        runtime_connections=runtime_conns,
        external=_DEFAULT_EXTERNAL,
        specs_list=specs,
    )
    
    scenario_paths = getattr(args, "scenario", None) or []
    if isinstance(scenario_paths, str):
        scenario_paths = [scenario_paths]
        
    scenes = []
    for path in scenario_paths:
        with open(path, "r", encoding="utf-8") as f:
            scenes.extend(parse_scene_string(f.read()))

    engine = station.build_engine(scenes=scenes)
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
    engine.telemetry_publishing = True
    
    try:
        pipeline.start()
        duration = _get("duration") or 1.0
        while engine.time < duration:
            engine.run_tick()
            if engine.telemetry:
                pipeline.write_batch(engine.telemetry)
                engine.telemetry.clear()
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
    engine.telemetry_publishing = True
    
    try:
        pipeline.start()
        duration = _get("duration") or 1.0
        while engine.time < duration:
            engine.run_tick()
            if engine.telemetry:
                pipeline.write_batch(engine.telemetry)
                engine.telemetry.clear()
        pipeline.flush()
    finally:
        pipeline.close()
    dropped = pipeline.dropped_batches
    print(json.dumps({"sinks": len(sinks), "dropped_batches": dropped}))
    return 0


def command_validate_simulation(args) -> int:
    topology, connections, specification = _inputs(args)
    validation_config = json.loads(args.validation) if getattr(args, "validation", None) else None
    graph = compile_model(topology, connections, specification, validation_config)
    scenario_paths = getattr(args, "scenario", None) or []
    if isinstance(scenario_paths, str):
        scenario_paths = [scenario_paths]
    events = []
    for path in scenario_paths:
        with open(path, "r", encoding="utf-8") as f:
            events.extend(parse_scene_string(f.read()))
    targets = set(graph.components)
    for event in events:
        if event.selector and event.selector not in targets:
            raise ValidationError(f"scenario event '{event.event_ref}' references unknown component '{event.selector}'")
    print(json.dumps({"valid": True, "events": len(events), "diagnostics": graph.diagnostics}, sort_keys=True))
    return 0


def command_experiment(args) -> int:
    config, _get = _merge_config(args)
    
    topology_hash = _hash_file(args.topology)
    spec_hash = _hash_file(args.spec)
    scen_hash = _hash_file(getattr(args, "scenario", None))
    config_content = json.dumps(config, sort_keys=True) if config else None
    
    db_path = getattr(args, "db_path", "experiments.db")
    db_adapter = SQLiteAdapter(db_path)
    db_adapter.start()
    
    runs_count = getattr(args, "runs", 1)
    base_seed = _get("seed", None)
    
    try:
        for run_idx in range(runs_count):
            run_id = getattr(args, "run_id", None)
            if not run_id or runs_count > 1:
                run_id = f"run-{uuid.uuid4().hex[:8]}"
                
            if base_seed is not None:
                current_seed = base_seed + run_idx
            else:
                current_seed = random.randint(0, 2**31 - 1)
                
            start_ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            engine = _run_engine(args, _get, seed=current_seed, run_id=run_id)
            
            sinks: list[TelemetrySink] = [DatabaseSink(SQLiteAdapter(db_path))]
            if "outputs" in config:
                for output_cfg in config["outputs"]:
                    if output_cfg.get("enabled", True):
                        sinks.append(create_sink(output_cfg))
            elif getattr(args, "output", None):
                sinks.append(JsonlSink(args.output))
                
            multi_sink = MultiSink(sinks)
            pipeline = AsyncTelemetryPipeline(multi_sink, backpressure_policy="drop")
            engine.telemetry_publishing = True
            
            try:
                pipeline.start()
                duration = _get("duration") or 1.0
                while engine.time < duration:
                    engine.run_tick()
                    if engine.telemetry:
                        pipeline.write_batch(engine.telemetry)
                        engine.telemetry.clear()
                pipeline.flush()
            finally:
                pipeline.close()
                
            end_ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            db_adapter.record_experiment(
                run_id=run_id,
                seed=current_seed,
                topology_hash=topology_hash,
                specification_hash=spec_hash,
                scenario_hash=scen_hash,
                configuration=config_content,
                start_timestamp=start_ts,
                end_timestamp=end_ts,
            )
    finally:
        db_adapter.close()
        
    print(json.dumps({"runs": runs_count, "db_path": db_path, "status": "completed"}, sort_keys=True))
    return 0


def command_serve(args) -> int:
    import uvicorn
    uvicorn.run("twin_sim.api.server:app", host=args.host, port=args.port)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="twin-sim")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_inputs(command):
        command.add_argument("--topology", required=True)
        command.add_argument("--connection", required=True)
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
    run.add_argument("--scenario", action="append", help="Scenario JSON file(s)")
    run.add_argument("--duration", type=float, default=None)
    run.add_argument("--tick-interval", type=float, default=None)
    run.add_argument("--time-scale", type=float, default=None)
    run.add_argument("--seed", type=int)
    run.add_argument("--run-id", default=None)
    run.add_argument("--environment", help="JSON object of initial environment values")
    run.add_argument("--output")
    run.add_argument("--debug", action="store_true", help="Enable debug causal tracing")
    run.set_defaults(handler=command_run)

    experiment = subparsers.add_parser("experiment")
    add_inputs(experiment)
    experiment.add_argument("--config", help="Runtime configuration JSON file")
    experiment.add_argument("--scenario", action="append", help="Scenario JSON file(s)")
    experiment.add_argument("--runs", type=int, default=1, help="Number of experiment runs")
    experiment.add_argument("--db-path", default="experiments.db", help="Path to SQLite database file")
    experiment.add_argument("--duration", type=float, default=None)
    experiment.add_argument("--tick-interval", type=float, default=None)
    experiment.add_argument("--time-scale", type=float, default=None)
    experiment.add_argument("--seed", type=int)
    experiment.add_argument("--run-id", default=None)
    experiment.add_argument("--environment", help="JSON object of initial environment values")
    experiment.add_argument("--output")
    experiment.set_defaults(handler=command_experiment)

    generate = subparsers.add_parser("generate")
    for action in ("topology", "connection", "spec"):
        generate.add_argument(f"--{action}", required=True)
    generate.add_argument("--scenario", action="append", help="Scenario JSON file(s)")
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
    dry_run.add_argument("--scenario", action="append", help="Scenario JSON file(s)")
    dry_run.set_defaults(handler=command_validate_simulation)
    serve = subparsers.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.set_defaults(handler=command_serve)
    
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