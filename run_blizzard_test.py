import json
from pathlib import Path
from twin_sim.compiler import compile_model
from twin_sim.scenarios import ScenarioEvent, ScenarioScheduler
from twin_sim.simulation import SimulationEngine

ROOT = Path("tests").resolve().parents[0]

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

root = ROOT / "examples/minimal"
graph = compile_model(read_json(root / "topology.json"), read_json(Path(str(root / "topology.json").replace("topology.json", "connections.json"))), read_json(root / "specification.json"))

engine = SimulationEngine(graph, environment={"temperature": 0, "heating_demand_multiplier": 0.5})
ScenarioScheduler().schedule(engine, [ScenarioEvent("blizzard", 2, "blizzard", 2, parameters={"heating_demand_multiplier": 1.7})])
engine.step()
generator = graph.get("Generator")
print("Tick 1 Generator:", generator.runtime_state.values)
engine.step()
print("Tick 2 Generator:", generator.runtime_state.values)
