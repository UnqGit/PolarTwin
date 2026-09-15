# Maitri End-to-End Demonstration

This example runs the generated Maitri topology and specification through the
generic compiler, behavior registry, scenario engine, simulation engine, and
telemetry generator. No Maitri-specific simulation code is required.

Validate the model:

```powershell
$env:PYTHONPATH = "src"
python -m twin_sim.cli validate `
  --topology config/twins/maitri/relation.json `
  --spec config/twins/maitri/spec.json
```

Run the canonical scenario to JSON Lines:

```powershell
python -m twin_sim.cli run `
  --topology config/twins/maitri/relation.json `
  --spec config/twins/maitri/spec.json `
  --scenario examples/maitri/scenario.json `
  --duration 6 `
  --seed 42 `
  --run-id maitri-demo `
  --output output/maitri-telemetry.jsonl
```

The scenario starts a blizzard at simulation time `2`, restores its
environment changes after three simulation seconds, and fails `Generator1` at
time `4`. The generic failure policy then assigns available backup generation
and battery support, while causal effects are included in telemetry context.