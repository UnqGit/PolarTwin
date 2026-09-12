# Schema-Driven Digital Twin / Telemetry Simulator — Implementation Plan

## 0. Goal

Build a **schema-driven simulation engine** that takes:

1. A **topology/relations JSON**
2. A **component specifications JSON**
3. An optional **scenario/events JSON**
4. Runtime configuration

and automatically constructs an executable simulation model without requiring a hand-written model for every new system.

The same engine must support two major modes:

### Mode A — Local Simulator

```text
Topology JSON + Spec JSON + Scenario JSON
                    |
                    v
             Model Compiler
                    |
                    v
             Simulation Engine
                    |
                    v
       JSON telemetry/event stream
                    |
                    v
        Console / local DB / file
```

No network transmission is performed.

### Mode B — Synthetic Telemetry Generator

```text
Topology JSON + Spec JSON + Scenario JSON
                    |
                    v
             Model Compiler
                    |
                    v
             Simulation Engine
                    |
                    v
          Telemetry/Event Stream
                    |
                    v
            MQTT Publisher
                    |
             +------+------+
             |             |
          connected     disconnected
             |             |
             v             v
          publish      durable queue
                           |
                           v
                     store-and-forward
```

The simulator should support:

- Continuous execution until stopped
- Fixed simulation duration
- Simulation timestamps independent of wall-clock time
- Configurable simulation speed
- Deterministic/reproducible runs
- Real-time runs
- Accelerated runs
- Scenario events
- Component failures
- Environmental conditions
- Cascading effects
- Sensor noise
- Fault injection
- Derived telemetry
- MQTT output
- Local database output
- Store-and-forward MQTT delivery
- Multiple databases through a pluggable adapter interface
- Small and large topologies using the same engine
- Automatic model construction from topology/specification JSON

---

# 1. Core Design Principle

Do **not** create a custom simulation class for every component.

Instead, implement a generic pipeline:

```text
JSON
 |
 | parse
 v
Validated Schema
 |
 | compile
 v
Generic Component Graph
 |
 | infer behavior
 v
Simulation Runtime Model
 |
 | execute discrete events / time steps
 v
State Changes
 |
 | observe
 v
Telemetry
 |
 +----> local output
 |
 +----> database
 |
 +----> MQTT
```

The JSON describes **what exists and how it is related**.

The specification describes **what each component means and its physical/functional constraints**.

The simulation engine supplies generic behavior based on:

- component type
- specification fields
- connections
- direction
- units
- tags
- dependency relationships
- scenario events
- behavior templates

This separation is extremely important.

---

# 2. Recommended Repository Structure

Create the project approximately as:

```text
digital-twin-simulator/
│
├── README.md
├── LICENSE
├── pyproject.toml
├── .gitignore
├── docker-compose.yml
│
├── configs/
│   ├── simulator.example.json
│   ├── mqtt.example.json
│   ├── database.example.json
│   └── scenario.example.json
│
├── schemas/
│   ├── topology.schema.json
│   ├── specification.schema.json
│   ├── scenario.schema.json
│   ├── telemetry.schema.json
│   └── runtime-config.schema.json
│
├── examples/
│   ├── maitri/
│   │   ├── topology.json
│   │   ├── specification.json
│   │   ├── scenario.json
│   │   └── expected/
│   │
│   └── minimal/
│       ├── topology.json
│       ├── specification.json
│       └── scenario.json
│
├── src/
│   └── twin_sim/
│       ├── __init__.py
│       ├── cli.py
│       │
│       ├── ingestion/
│       │   ├── topology_loader.py
│       │   ├── specification_loader.py
│       │   └── validator.py
│       │
│       ├── model/
│       │   ├── component.py
│       │   ├── connection.py
│       │   ├── graph.py
│       │   ├── specification.py
│       │   └── runtime_state.py
│       │
│       ├── compiler/
│       │   ├── model_compiler.py
│       │   ├── dependency_builder.py
│       │   ├── behavior_inference.py
│       │   └── consistency_checker.py
│       │
│       ├── simulation/
│       │   ├── engine.py
│       │   ├── clock.py
│       │   ├── scheduler.py
│       │   ├── state_store.py
│       │   ├── propagation.py
│       │   └── randomness.py
│       │
│       ├── behaviors/
│       │   ├── base.py
│       │   ├── sensor.py
│       │   ├── controller.py
│       │   ├── generator.py
│       │   ├── battery.py
│       │   ├── pump.py
│       │   ├── heater.py
│       │   ├── fan.py
│       │   ├── server.py
│       │   └── generic.py
│       │
│       ├── scenarios/
│       │   ├── loader.py
│       │   ├── event.py
│       │   ├── scheduler.py
│       │   └── handlers.py
│       │
│       ├── telemetry/
│       │   ├── model.py
│       │   ├── generator.py
│       │   ├── serializer.py
│       │   └── quality.py
│       │
│       ├── outputs/
│       │   ├── base.py
│       │   ├── stdout.py
│       │   ├── jsonl.py
│       │   ├── database.py
│       │   └── mqtt.py
│       │
│       ├── storage/
│       │   ├── outbox.py
│       │   ├── sqlite.py
│       │   └── retention.py
│       │
│       ├── observability/
│       │   ├── logging.py
│       │   ├── metrics.py
│       │   └── run_summary.py
│       │
│       └── utils/
│           ├── units.py
│           ├── ids.py
│           └── time.py
│
└── tests/
    ├── unit/
    ├── integration/
    ├── scenarios/
    ├── mqtt/
    ├── database/
    └── fixtures/
```

The exact language can be changed, but Python is a strong prototype choice because it is excellent for JSON, scientific calculations, MQTT, databases, testing, and rapid iteration.

---

# 3. Phase 1 — Define the Canonical Data Contracts

## Objective

Before writing the simulator, define the schemas that everything else depends upon.

Create formal JSON Schema files.

### Topology

The topology should represent:

```text
component hierarchy
component name
component type
tags
connections
```

Do not rely only on nested `children` for dependencies.

Connections are the actual functional graph.

The hierarchy is the containment graph.

These are two different graphs.

### Specification

The specification should describe:

```text
component type
physical properties
functional properties
limits
units
roles
inputs
outputs
```

### Scenario

Introduce a standard scenario structure.

Example:

```json
{
  "name": "Antarctic Blizzard Test",
  "seed": 42,
  "events": [
    {
      "id": "blizzard-1",
      "timestamp": 110,
      "event": "blizzard",
      "duration": 300,
      "parameters": {
        "severity": 0.8,
        "temperature_delta": -15,
        "wind_speed": 45,
        "connectivity_loss_probability": 0.8
      }
    },
    {
      "id": "generator-failure-1",
      "timestamp": 250,
      "event": "component_failure",
      "target": "Generator1",
      "parameters": {
        "failure_mode": "hard_failure"
      }
    }
  ]
}
```

### Runtime configuration

Example:

```json
{
  "mode": "simulator",
  "duration": 1000,
  "tick_interval": 1,
  "time_scale": 10,
  "seed": 42,
  "outputs": [
    {
      "type": "jsonl",
      "enabled": true,
      "path": "./output/telemetry.jsonl"
    }
  ]
}
```

## Deliverables

- JSON Schemas
- Example topology
- Example specification
- Example scenario
- Example runtime configuration
- Schema validation tests

## Agent prompt

> Implement Phase 1 of the schema-driven digital twin simulator.
>
> Create formal JSON Schemas for topology, specification, scenario, telemetry, and runtime configuration.
>
> The topology contains a hierarchy using `children` and a functional dependency graph using `connections`. Treat these as separate concepts.
>
> Create loaders and validators with useful error messages.
>
> Add example JSON files and tests.
>
> Do not implement MQTT or simulation behavior yet.
>
> The system must reject malformed references, duplicate component names, invalid connection directions, and invalid specification types.
>
> Preserve unknown specification properties rather than silently deleting them.

---

# 4. Phase 2 — Build the Generic Component Graph

## Objective

Convert the two JSON documents into one normalized internal representation.

The compiler should:

1. Traverse the hierarchy
2. Create every component
3. Attach tags
4. Attach specification
5. Resolve component types
6. Resolve connections
7. Build parent/child relationships
8. Build incoming/outgoing dependency indexes

Internal representation:

```text
Component
 ├── id
 ├── name
 ├── type
 ├── tags
 ├── parent
 ├── children
 ├── specification
 ├── incoming_connections
 ├── outgoing_connections
 └── runtime_state
```

Connection:

```text
Connection
 ├── source
 ├── target
 ├── type
 └── direction
```

Do not hardcode Maitri.

The compiler should work on:

```text
Maitri
SmallTestStation
RandomGeneratedSystem
FutureStation
```

without changing the compiler.

## Deliverables

- Component model
- Connection model
- Graph model
- Specification attachment
- Reference resolver
- Graph consistency checker
- Tests using both a tiny topology and the Maitri topology

## Agent prompt

> Implement Phase 2.
>
> Build a normalized internal component graph from topology.json and specification.json.
>
> Do not create Maitri-specific classes or hardcoded component names.
>
> Every component should have a generic runtime state object.
>
> Build both containment relationships and functional connections.
>
> Validate that every connection source and target exists.
>
> Validate that specification type matches topology type where applicable.
>
> Preserve all specification properties.
>
> Add graph traversal APIs for parents, children, ancestors, descendants, incoming dependencies, and outgoing dependencies.
>
> Add comprehensive tests.

---

# 5. Phase 3 — Behavior Inference

This is the most important architectural phase.

The system must infer a starting behavior model from the JSON.

Do not attempt to make arbitrary JSON magically simulate arbitrary physics.

Instead implement a **layered behavior system**:

```text
                    +------------------+
                    | Explicit behavior|
                    +---------+--------+
                              |
                    +---------v--------+
                    | Type behavior    |
                    +---------+--------+
                              |
                    +---------v--------+
                    | Specification    |
                    | inference        |
                    +---------+--------+
                              |
                    +---------v--------+
                    | Generic fallback |
                    +------------------+
```

Priority:

1. Explicit behavior configuration
2. Component type behavior
3. Specification-derived behavior
4. Generic behavior

For example:

```text
type = sensor
```

implies sensor behavior.

```text
type = generator
rating = 300 kW
fuel_capacity = 2000 L
```

allows a generator behavior template to model power generation and fuel consumption.

```text
type = controller
inputs = power_data,fuel_data,battery_data,status
outputs = generator_command,charge_control,power_control
```

allows a controller behavior template to consume upstream data and produce commands.

## Behavior interface

Conceptually:

```python
class ComponentBehavior:

    def initialize(self, component, context):
        ...

    def step(self, component, context, dt):
        ...

    def handle_event(self, component, event, context):
        ...

    def produce_telemetry(self, component, context):
        ...
```

The engine should not know how a generator works.

It only asks:

```text
behavior.step(...)
```

## Generic fallback

If a new component appears:

```json
{
  "name": "QuantumWidget",
  "type": "quantum_widget",
  "spec": {
    "provides": "mysterious useful thing"
  }
}
```

the simulator should not crash merely because there is no specialized behavior.

Instead:

```text
GenericBehavior
```

should keep the component alive, emit basic state/health telemetry, and report:

```text
behavior_level = generic
```

This allows new topology to be simulated immediately while specialized behaviors are gradually added.

## Agent prompt

> Implement Phase 3: behavior inference.
>
> Build a behavior registry and behavior interface.
>
> Implement specialized behaviors for:
>
> - sensor
> - controller
> - generator
> - battery
> - inverter
> - heater
> - fan
> - cooler
> - pump
> - tank
> - storage
> - server
> - router
> - vehicle
> - robot
> - alarm
> - beacon
> - radio
> - antenna
>
> Also implement GenericBehavior.
>
> The simulation engine must never depend directly on specific component names.
>
> Behavior selection must be based on type/specification rather than names.
>
> Add a registry so additional behaviors can be added without modifying the core engine.
>
> Implement explicit behavior overrides as a future-compatible extension point.

---

# 6. Phase 4 — Simulation Engine

## Objective

Build a time-driven simulation engine.

Support:

```text
run for N simulation seconds
run continuously
pause
resume
stop
```

Simulation time should be independent from wall-clock time.

Example:

```text
simulation_time = 0
tick = 1 second

tick 0
tick 1
tick 2
...
tick 110
```

At simulation timestamp 110:

```text
blizzard event
```

is applied.

## Clock modes

Support:

```text
REALTIME
ACCELERATED
FAST
MANUAL
```

Example:

```json
{
  "tick_interval": 1,
  "time_scale": 10
}
```

means:

```text
1 simulation second = 0.1 real seconds
```

A manual mode is useful for debugging:

```text
advance 1 tick
advance 10 ticks
```

## Determinism

Use a seed:

```json
{
  "seed": 42
}
```

A run with the same inputs and seed should produce the same results.

This is extremely valuable for debugging.

## Agent prompt

> Implement Phase 4.
>
> Create a deterministic simulation clock and scheduler.
>
> Support fixed-duration runs, continuous runs, pause/resume/stop, accelerated execution, real-time execution, and manual stepping.
>
> Simulation time must not depend on wall-clock time.
>
> Add seeded randomness.
>
> Make simulation execution deterministic when given the same topology, specification, scenario, configuration, and seed.
>
> Implement graceful shutdown.
>
> Add tests for timestamps, scheduler ordering, deterministic random values, and stop behavior.

---

# 7. Phase 5 — State Propagation and Causal Simulation

This phase makes the simulator actually interesting.

A simulation tick should conceptually be:

```text
1. Apply scheduled events
2. Update environmental state
3. Evaluate component behavior
4. Propagate signals through connections
5. Update component state
6. Generate telemetry
7. Send telemetry to outputs
8. Record errors/metrics
```

Avoid immediately mutating everything in arbitrary order.

Prefer a predictable pipeline.

For example:

```text
Generator
   |
   | power
   v
EnergyController
   |
   | command
   v
Generator

Sensor
   |
   | measurement
   v
Controller
   |
   | command
   v
Actuator
```

This should form a causal graph.

## Important concept: state vs telemetry

Do not use telemetry as the internal state.

Internal state might be:

```json
{
  "fuel_level": 0.82,
  "temperature": -18,
  "running": true,
  "health": 1.0
}
```

Telemetry is an observation:

```json
{
  "timestamp": 110,
  "component": "FuelLevelSensor",
  "measurement": {
    "quantity": "fuel_level",
    "value": 81.7,
    "unit": "%"
  }
}
```

This distinction will save enormous pain later.

## Agent prompt

> Implement Phase 5.
>
> Build causal state propagation using the connection graph.
>
> Each tick should have an explicit deterministic phase order:
>
> 1. scheduled events
> 2. environment update
> 3. behavior evaluation
> 4. signal propagation
> 5. state commit
> 6. telemetry generation
> 7. output publishing
>
> Avoid order-dependent mutation where possible.
>
> Keep internal component state separate from telemetry.
>
> Add tests demonstrating sensor -> controller -> actuator behavior and controller -> actuator -> physical-state feedback loops.

---

# 8. Phase 6 — Physical/Functional Models

Implement practical first-order models.

Do not attempt full computational fluid dynamics or detailed electrical simulation in version 1.

The first prototype should use transparent equations.

## Generator

Example:

```text
power_output <= rated_power

fuel_consumption =
    base_rate + load_factor * power_output
```

Generator failure:

```text
running = false
power_output = 0
```

## Battery

Maintain:

```text
state_of_charge
energy
charge_power
discharge_power
```

Example:

```text
SOC(t+dt) =
SOC(t) + charge_energy - discharge_energy
```

bounded by:

```text
0 <= SOC <= capacity
```

## Heater

Power consumption:

```text
electrical_power
```

produces:

```text
thermal_power
```

Temperature can use a simple thermal balance:

```text
dT/dt =
    heating_input
    - heat_loss
    + environmental_effect
```

## Fan

Airflow can depend on:

```text
command
rated_airflow
```

## Sensors

Sensor behavior should include:

- true value
- noise
- bias
- accuracy
- resolution
- range
- failure state

Example:

```text
observed = true_value + gaussian_noise
```

Then clamp/quantize according to sensor specification.

## Controllers

Use simple control logic initially:

```text
threshold controller
PID-like controller
state machine controller
```

Do not overengineer the first release.

## Agent prompt

> Implement Phase 6 physical behavior models.
>
> Use transparent first-order models rather than high-fidelity physics.
>
> Implement generator fuel consumption and power output, battery SOC, inverter conversion efficiency, heater thermal output, fan airflow, pump flow, tank level, storage levels, server health, and sensor noise/range/accuracy/resolution.
>
> Keep equations isolated inside behavior classes.
>
> Use specification values and units instead of hardcoded component-specific values.
>
> Add unit tests for conservation/bounds such as:
>
> - battery SOC never exceeds capacity
> - fuel never becomes negative
> - sensor values respect ranges
> - generator cannot exceed rating
> - actuator output falls when unavailable
>
> Document the equations used.

---

# 9. Phase 7 — Environment Model

Introduce a global environment.

Example:

```json
{
  "environment": {
    "temperature": -25,
    "wind_speed": 15,
    "pressure": 980,
    "humidity": 60,
    "connectivity": 1.0
  }
}
```

Components can consume environmental variables.

For example:

```text
outdoor temperature
       |
       v
Heating demand
       |
       v
heater power consumption
       |
       v
generator load
       |
       v
fuel consumption
```

This is where the digital twin starts becoming a causal system instead of a random-number generator wearing a fake moustache.

---

# 10. Phase 8 — Scenario/Event Engine

Create a generic event system.

Event:

```json
{
  "timestamp": 110,
  "event": "blizzard"
}
```

More detailed:

```json
{
  "timestamp": 110,
  "event": "blizzard",
  "duration": 300,
  "parameters": {
    "severity": 0.8,
    "temperature_delta": -15,
    "wind_speed": 45,
    "heating_demand_multiplier": 1.5,
    "connectivity": 0.2
  }
}
```

Component-specific event:

```json
{
  "timestamp": 250,
  "event": "component_failure",
  "target": "Generator1",
  "parameters": {
    "failure_mode": "hard_failure"
  }
}
```

Recovery:

```json
{
  "timestamp": 400,
  "event": "component_repair",
  "target": "Generator1"
}
```

## Event types to support

Initial:

```text
environment_change
blizzard
temperature_change
component_failure
component_repair
sensor_failure
network_outage
power_outage
fuel_shortage
manual_command
alarm_trigger
```

Later:

```text
component_degradation
random_failure
maintenance
communication_latency
packet_loss
data_corruption
partial_capacity
operator_intervention
```

## Agent prompt

> Implement Phase 8.
>
> Create a generic scenario/event engine.
>
> Events must be timestamped in simulation time and applied when the simulation clock reaches the event timestamp.
>
> Support event duration and optional automatic restoration.
>
> Implement blizzard, component failure, component repair, sensor failure, network outage, temperature change, fuel shortage, and manual command events.
>
> Events should not contain simulator-specific code.
>
> Use an event registry/handler system.
>
> Add tests proving that events execute at the correct simulation timestamp and that overlapping events are handled deterministically.

---

# 11. Phase 9 — Blizzard Scenario

Implement the first end-to-end scenario.

Example:

```json
{
  "events": [
    {
      "timestamp": 110,
      "event": "blizzard",
      "duration": 300,
      "parameters": {
        "severity": 0.9,
        "temperature_delta": -15,
        "wind_speed": 50,
        "heating_demand_multiplier": 1.7,
        "connectivity": 0.1
      }
    }
  ]
}
```

Expected causal chain:

```text
BLIZZARD
   |
   +--> lower outdoor temperature
   |
   +--> higher wind
   |
   +--> higher heat loss
             |
             v
       heating demand
             |
             v
        heater load
             |
             v
       electrical demand
             |
             v
        generator load
             |
             v
       fuel consumption
             |
             v
        fuel level falls
```

Meanwhile:

```text
BLIZZARD
   |
   v
network degradation
   |
   +--> packet loss
   +--> delayed telemetry
   +--> MQTT disconnection
```

This scenario should become the canonical demonstration.

---

# 12. Phase 10 — Failure Propagation

A key requirement is answering:

> "What happens next if something fails?"

Example:

```text
Generator1 fails
       |
       v
EnergyController detects loss
       |
       +--> Generator2 starts/increases output
       |
       +--> Battery discharges if needed
       |
       +--> Power margin decreases
       |
       +--> alarm/status generated
       |
       v
MainController receives energy_status
```

Implement dependency-aware propagation.

Every failure should produce:

1. Component state change
2. Downstream effects
3. Telemetry
4. Optional alarm
5. Optional recovery behavior

Avoid hardcoding:

```text
if Generator1:
    ...
```

Instead derive dependencies from:

```text
connections
```

and component behavior.

---

# 13. Phase 11 — Telemetry Contract

Define one standard JSON telemetry envelope.

Recommended structure:

```json
{
  "schema_version": "1.0",
  "run_id": "run-abc123",
  "timestamp": 110,
  "wallclock_timestamp": "2026-09-11T12:30:00Z",
  "component": {
    "name": "FuelLevelSensor",
    "type": "sensor",
    "tags": ["monitoring"]
  },
  "measurement": {
    "quantity": "fuel_level",
    "value": 81.7,
    "unit": "%"
  },
  "quality": {
    "status": "good",
    "simulated": true,
    "estimated": false
  },
  "source": {
    "component": "FuelLevelSensor",
    "measures": "fuel level"
  },
  "context": {
    "environment": {
      "temperature": -25,
      "wind_speed": 15
    }
  },
  "active_events": [],
  "state": {
    "health": 1.0
  }
}
```

For event telemetry:

```json
{
  "schema_version": "1.0",
  "run_id": "run-abc123",
  "timestamp": 250,
  "event": {
    "type": "component_failure",
    "target": "Generator1"
  }
}
```

Consider supporting:

```text
measurement
state
event
alarm
heartbeat
```

as message types.

## Important

The telemetry should explicitly identify:

```text
what component
what type
what measurement
what value
what unit
what simulation time
what run
what scenario/event context
```

---

# 14. Phase 12 — Local Output

Implement output adapters.

Interface:

```python
class TelemetrySink:

    def start(self):
        ...

    def write(self, telemetry):
        ...

    def flush(self):
        ...

    def close(self):
        ...
```

Initial sinks:

```text
stdout
JSON Lines
CSV
SQLite
```

JSON Lines is especially useful:

```text
telemetry.jsonl
```

because it can be streamed continuously.

Configuration:

```json
{
  "outputs": [
    {
      "type": "stdout"
    },
    {
      "type": "jsonl",
      "path": "./output/telemetry.jsonl"
    },
    {
      "type": "sqlite",
      "path": "./output/telemetry.db"
    }
  ]
}
```

---

# 15. Phase 13 — Database Adapter System

Do not couple the simulation engine to one database.

Create:

```text
TelemetrySink
      |
      +-- SQLite
      +-- PostgreSQL
      +-- TimescaleDB
      +-- InfluxDB
      +-- MongoDB
      +-- custom adapter
```

The simulator should only know:

```text
sink.write(message)
```

Database-specific code belongs in adapters.

Recommended first database:

```text
SQLite
```

for zero-dependency local testing.

Then:

```text
PostgreSQL/TimescaleDB
```

for serious deployments.

---

# 16. Phase 14 — MQTT Synthetic Telemetry Generator

Create an MQTT sink:

```text
Simulation
     |
     v
TelemetrySink
     |
     v
MQTT Publisher
```

Configuration example:

```json
{
  "mqtt": {
    "enabled": true,
    "host": "192.168.1.100",
    "port": 1883,
    "topic_prefix": "maitri/synthetic",
    "qos": 1,
    "retain": false
  }
}
```

Recommended topic structure:

```text
<site>/<system>/<component>/<message_type>
```

Example:

```text
maitri/energy/FuelLevelSensor/measurement
maitri/energy/Generator1/state
maitri/control/MainController/state
maitri/safety/FireSensor/measurement
```

Optionally also publish a normalized topic:

```text
maitri/telemetry
```

with the component information inside the JSON.

---

# 17. Phase 15 — Store-and-Forward MQTT

This is essential.

Do NOT block the simulator waiting for MQTT.

Architecture:

```text
Simulation
    |
    v
Telemetry Queue
    |
    +------> MQTT publisher ------> network
    |
    +------> durable local outbox
```

If MQTT works:

```text
generate
   |
publish
   |
mark delivered
```

If MQTT fails:

```text
generate
   |
write durable outbox
   |
continue simulation
```

When connection returns:

```text
outbox
  |
  v
publisher
  |
  v
MQTT
  |
  v
mark delivered
```

Use message IDs:

```text
run_id + sequence_number
```

to provide idempotency.

Example:

```json
{
  "message_id": "run123-00000000142"
}
```

The receiver can ignore duplicates.

## Outbox states

```text
PENDING
IN_FLIGHT
DELIVERED
FAILED
```

Add retry metadata:

```text
attempt_count
last_attempt
next_attempt
last_error
```

Use exponential backoff.

---

# 18. Phase 16 — Connectivity Simulation

The simulator itself should be able to simulate network conditions.

Example:

```json
{
  "timestamp": 110,
  "event": "network_outage",
  "duration": 120,
  "parameters": {
    "packet_loss": 0.9,
    "latency_ms": 5000,
    "disconnect": true
  }
}
```

This allows testing the store-and-forward system without actually unplugging a cable.

Very useful.

---

# 19. Phase 17 — CLI

Provide a clean CLI.

Examples:

```bash
twin-sim validate \
  --topology topology.json \
  --spec specification.json
```

```bash
twin-sim run \
  --topology topology.json \
  --spec specification.json \
  --scenario scenario.json \
  --duration 1000
```

```bash
twin-sim run \
  --topology topology.json \
  --spec specification.json \
  --scenario scenario.json \
  --mode realtime
```

Synthetic telemetry:

```bash
twin-sim generate \
  --topology topology.json \
  --spec specification.json \
  --scenario scenario.json \
  --mqtt-config mqtt.json
```

Inspect:

```bash
twin-sim inspect \
  --topology topology.json \
  --spec specification.json
```

Graph:

```bash
twin-sim graph \
  --topology topology.json
```

Dry run:

```bash
twin-sim validate-simulation \
  --topology topology.json \
  --spec specification.json \
  --scenario scenario.json
```

---

# 20. Phase 18 — Minimal Topology Test

Before relying on Maitri, create a tiny system.

Example:

```text
MiniStation
 |
 +-- EnergySystem
       |
       +-- Generator
       +-- FuelSensor
       +-- Controller
```

Connections:

```text
Generator -> Controller
FuelSensor -> Controller
Controller -> Generator
```

This system should demonstrate:

```text
generator runs
fuel decreases
sensor measures fuel
controller receives fuel
generator fails
controller reacts
```

This is the primary unit/integration test topology.

The whole architecture must work without the giant Maitri example.

---

# 21. Phase 19 — Maitri End-to-End Demonstration

Now run the supplied topology/specification.

Expected output:

```text
[0] Generator1 power = ...
[0] Generator2 power = ...
[0] FuelLevelSensor = ...
[0] BatterySensor = ...
...
[110] EVENT blizzard START
[111] OutdoorTemperatureSensor = ...
[111] heating demand increases
[111] generator load increases
[111] fuel consumption increases
...
[250] EVENT Generator1 FAILURE
[251] EnergyController detects failure
[251] Generator2 load increases
[251] Battery begins discharging
...
```

Do not require exact numbers initially.

First validate causal behavior.

---

# 22. Phase 20 — Automatic Model Quality Report

After compiling a JSON system, generate a report.

Example:

```text
MODEL REPORT
============

Components: 84
Connections: 91

Types:
  sensor: 29
  controller: 17
  system: 12
  server: 4
  ...

Specialized behaviors:
  72

Generic behaviors:
  12

Unresolved references:
  0

Potential cycles:
  7

Unconnected components:
  3

Missing specifications:
  0

Unsupported behavior:
  2
```

This is extremely useful for new twin systems.

---

# 23. Phase 21 — Explainability / Causal Trace

Add an optional debug mode.

Example:

```text
WHY did Generator2 increase power?

Generator1 failed
        |
        v
EnergyController received Generator1 status = FAILED
        |
        v
Available generation decreased
        |
        v
EnergyController issued Generator2 command = 0.92
        |
        v
Generator2 output increased to 276 kW
```

This should be represented internally as causal events.

Optional JSON:

```json
{
  "timestamp": 251,
  "cause": {
    "component": "Generator1",
    "event": "failure"
  },
  "effects": [
    {
      "component": "EnergyController",
      "state_change": "generator_available=false"
    },
    {
      "component": "Generator2",
      "state_change": "power_output=276"
    }
  ]
}
```

This will make debugging dramatically easier.

---

# 24. Phase 22 — Validation and Safety Rails

The engine should detect impossible states.

Examples:

```text
fuel < 0
battery SOC > 100%
battery SOC < 0%
temperature outside physical model range
generator output > rating
negative tank volume
unknown sensor quantity
connection references nonexistent component
```

Use warnings/errors with configurable severity.

Example:

```json
{
  "validation": {
    "negative_fuel": "error",
    "generator_overload": "warning"
  }
}
```

---

# 25. Phase 23 — Performance

Only optimize after correctness.

Potential architecture:

```text
Simulation Engine
      |
      v
Component State Store
      |
      +--> Behavior evaluation
      |
      +--> Telemetry batch
      |
      v
Async output pipeline
```

For large systems:

- Avoid repeatedly traversing the entire graph
- Precompute dependency indexes
- Batch telemetry
- Use asynchronous sinks
- Use bounded queues
- Avoid blocking the simulation loop
- Use incremental state updates
- Add backpressure policies

Important principle:

> Network/database slowness must not automatically slow down simulation time.

---

# 26. Phase 24 — Configuration Layer

Separate:

```text
system definition
```

from:

```text
simulation configuration
```

from:

```text
scenario
```

from:

```text
output configuration
```

Do not put MQTT credentials into topology.

Do not put scenario events into component specification.

Do not put physical constants into the MQTT configuration.

Keep concerns separated.

---

# 27. Phase 25 — Plugin Architecture

Eventually support external behavior plugins.

Example:

```text
behaviors/
    custom_oxygen_generator.py
    custom_reactor.py
```

Registry:

```python
register_behavior(
    component_type="oxygen_generator",
    behavior=OxygenGeneratorBehavior
)
```

This preserves the generic architecture while allowing high-fidelity domain-specific models.

---

# 28. Phase 26 — Reproducible Experiment Runner

Add:

```bash
twin-sim experiment \
  --scenario baseline.json \
  --runs 100
```

Each run gets:

```text
run_id
seed
configuration
topology hash
specification hash
scenario hash
start/end timestamps
```

This enables comparison:

```text
baseline
vs
generator failure
vs
blizzard
vs
blizzard + generator failure
```

This is the beginning of a proper what-if analysis platform.

---

# 29. Phase 27 — Telemetry Ingress & Egress Middleware

Implement an Ingress (Modulation) and Egress (Demodulation) pipeline to securely and robustly handle external data.

1. **Ingress (Modulation)**: Validate incoming data via Pydantic and normalize units (e.g. F to K, pounds to kg).
2. **Egress (Demodulation)**: Expand compressed delta telemetry into discrete time points using linear interpolation right before the sink.

---

# 30. Phase 28 — Scenario Composition

Allow multiple scenario files:

```bash
twin-sim run \
  --scenario blizzard.json \
  --scenario generator_failure.json
```

Or:

```json
{
  "scenarios": [
    "blizzard",
    "generator_failure"
  ]
}
```

The engine should merge events deterministically.

---

# 31. Phase 29 — Digital Twin API

After the core CLI is stable, add an API.

Potential endpoints:

```text
POST /runs
GET /runs/{id}
POST /runs/{id}/pause
POST /runs/{id}/resume
POST /runs/{id}/stop
GET /runs/{id}/state
GET /runs/{id}/telemetry
POST /runs/{id}/events
GET /models/{id}
```

This allows a UI or external system to control simulations.

Do this after the engine works as a library/CLI.

---

# 32. Phase 30 — Web UI

Only after the backend is stable.

Useful views:

```text
Topology graph
Component state
Live telemetry
Active events
Failure propagation
MQTT status
Outbox size
Simulation clock
```

A particularly useful UI:

```text
                    SIMULATION

Time: 251 / 1000
Mode: accelerated 10x

ACTIVE EVENTS
--------------
BLIZZARD
GENERATOR1 FAILURE

SYSTEM HEALTH
-------------
Energy       72%
HVAC         91%
Control      99%
Network      24%
Water        99%

TELEMETRY
---------
FuelLevelSensor       73.2%
Generator2            276 kW
BatterySensor         61%
OutdoorTemperature    -38 C

MQTT
----
Connected: NO
Outbox: 18,420 messages
```

---

# 33. Recommended MVP Scope

Do NOT build every phase immediately.

The first useful MVP should contain:

```text
[1] topology/spec loader
[2] schema validation
[3] normalized component graph
[4] behavior registry
[5] generic behavior
[6] sensor behavior
[7] generator behavior
[8] controller behavior
[9] simple battery behavior
[10] simulation clock
[11] scenario events
[12] telemetry JSON
[13] JSONL output
[14] SQLite output
[15] MQTT output
[16] durable MQTT outbox
[17] store-and-forward
[18] CLI
[19] minimal test topology
[20] Maitri demonstration
```

Do not build the web UI first.

Do not build high-fidelity physics first.

Do not build ten databases first.

Do not build Kubernetes first.

Get the causal simulation loop working first.

---

# 34. Recommended MVP Behavior Model

For the first version, implement these causal chains.

## Energy

```text
Generator
   |
   v
Power output
   |
   +--> EnergyController
   |
   +--> PowerSensor
   |
   v
Power demand

FuelLevelSensor
   |
   v
EnergyController
   |
   v
Generator load
   |
   v
Fuel consumption
```

## HVAC

```text
OutdoorTemperatureSensor
          |
          v
   HeatingController
          |
          v
      MainHeater
          |
          v
    Indoor temperature
          |
          v
IndoorTemperatureSensor
```

## Blizzard

```text
Blizzard
   |
   +--> outdoor temperature decreases
   +--> heating demand increases
   +--> generator load increases
   +--> fuel consumption increases
   +--> network connectivity decreases
```

## Generator failure

```text
Generator1 FAILED
       |
       v
EnergyController
       |
       +--> Generator2 increases output
       |
       +--> Battery discharges
       |
       +--> alarm/status
```

This gives a compelling demonstration with relatively little code.

---

# 35. Telemetry Frequency

Do not necessarily emit every component on every tick.

Support:

```json
{
  "telemetry": {
    "default_interval": 5,
    "per_component": {
      "PowerSensor": 1,
      "FuelLevelSensor": 5,
      "WeatherSensor": 10
    }
  }
}
```

Also support event-triggered telemetry:

```text
component failure
alarm
threshold crossing
state transition
```

This prevents massive output volumes.

---

# 36. Simulation vs Telemetry Generation

Keep these as separate concepts.

## Simulation

```text
simulation state
     |
     v
telemetry
     |
     v
local sinks
```

## Synthetic telemetry generator

```text
simulation state
     |
     v
telemetry
     |
     v
MQTT
```

The generator should **reuse the exact same simulator**.

There should not be:

```text
Simulator implementation
Synthetic generator implementation
```

as two separate engines.

There should be:

```text
One simulation engine
        |
        +--> local sinks
        |
        +--> MQTT sink
```

This is one of the most important architectural decisions.

---

# 37. Failure Handling Strategy

Every external output must be non-blocking from the simulation engine's perspective.

Bad:

```text
simulation -> MQTT.publish()
                  |
               network hangs
                  |
              simulation hangs
```

Good:

```text
simulation
   |
   v
bounded async queue
   |
   +--> MQTT worker
   |
   +--> durable outbox
```

If the queue becomes full, define a policy:

```text
BLOCK
DROP_OLDEST
DROP_NEWEST
PERSIST
```

For synthetic telemetry, `PERSIST` should generally be preferred when reliable delivery is required.

---

# 38. Security Considerations

When MQTT is eventually deployed:

- TLS
- username/password or certificates
- topic ACLs
- secure secret storage
- configurable client IDs
- reconnect limits
- payload validation
- maximum message size
- authentication failure handling

Never place passwords directly in topology/spec JSON.

---

# 39. Testing Strategy

Use several layers.

## Unit tests

Test:

```text
sensor noise
generator fuel consumption
battery SOC
temperature model
event scheduling
unit conversion
MQTT retry
outbox
```

## Integration tests

Test:

```text
topology -> compiler -> simulator -> telemetry
```

## Scenario tests

Test:

```text
blizzard
generator failure
network outage
combined events
```

## Determinism tests

Same:

```text
topology
spec
scenario
seed
configuration
```

must produce equivalent output.

## Property tests

Examples:

```text
fuel never negative
SOC remains bounded
simulation timestamp monotonic
message IDs unique
no connection references nonexistent components
```

---

# 40. Definition of Done for MVP

The MVP is complete when this works:

```bash
twin-sim generate \
  --topology examples/maitri/topology.json \
  --spec examples/maitri/specification.json \
  --scenario examples/maitri/scenario.json \
  --duration 1000 \
  --mqtt-config configs/mqtt.example.json
```

and:

1. The topology is validated.
2. The specification is validated.
3. The graph is compiled automatically.
4. No Maitri-specific simulation code is required.
5. Simulation starts.
6. Telemetry is generated.
7. Blizzard begins at its configured simulation timestamp.
8. Heating demand changes.
9. Generator load changes.
10. Fuel consumption changes.
11. Generator failure causes downstream effects.
12. MQTT disconnect does not stop the simulator.
13. Messages enter the durable outbox.
14. MQTT reconnect causes queued messages to be delivered.
15. Duplicate delivery is safely handled.
16. The same run can also operate completely locally.
17. A smaller topology works without changing the simulator code.
18. A new unknown component type falls back to GenericBehavior rather than crashing.

---

# 41. Suggested Agent Execution Strategy

Do not ask Cursor/Copilot to implement the entire project in one prompt.

Use one phase at a time.

After each phase:

```text
implement
test
run
inspect
fix
commit
```

Recommended sequence:

```text
Phase 1  -> schemas
Phase 2  -> graph
Phase 3  -> behaviors
Phase 4  -> clock
Phase 5  -> propagation
Phase 6  -> physical models
Phase 7  -> environment
Phase 8  -> events
Phase 9  -> blizzard
Phase 10 -> failures
Phase 11 -> telemetry
Phase 12 -> local sinks
Phase 13 -> database
Phase 14 -> MQTT
Phase 15 -> outbox
Phase 16 -> connectivity
Phase 17 -> CLI
Phase 18 -> minimal system
Phase 19 -> Maitri
Phase 20 -> reports
Phase 21 -> causal traces
Phase 22 -> validation
Phase 23 -> performance
Phase 24 -> configuration
Phase 25 -> plugins
Phase 26 -> experiments
Phase 27 -> telemetry ingress/egress
Phase 28 -> scenario composition
Phase 29 -> API
Phase 30 -> UI
```

---

# 42. Master Prompt for Cursor / Copilot / Coding Agent

Copy this prompt into the coding agent after giving it this plan:

> You are implementing a schema-driven digital twin and synthetic telemetry simulator.
>
> Read the repository plan in `IMPLEMENTATION_PLAN.md` completely before modifying code.
>
> The system must convert a pair of JSON documents:
>
> 1. topology/relations JSON
> 2. component specification JSON
>
> into a generic executable simulation model.
>
> The simulator must NOT contain hardcoded knowledge of a particular station such as Maitri. Component behavior must be selected using component type, tags, specification fields, connection semantics, and registered behavior plugins.
>
> Treat the hierarchy (`children`) and functional connection graph (`connections`) as separate concepts.
>
> Build one reusable simulation engine. A local simulator and a synthetic telemetry generator must use the same engine and differ only in their output sinks.
>
> Required capabilities:
>
> - JSON Schema validation
> - automatic model compilation
> - generic component graph
> - behavior registry
> - specialized behaviors where possible
> - generic fallback behavior
> - deterministic simulation with seed
> - simulation clock independent of wall-clock time
> - real-time and accelerated execution
> - continuous execution
> - fixed duration
> - pause/resume/stop
> - timestamped events
> - environmental events
> - component failures
> - recovery events
> - causal state propagation
> - sensor noise
> - physical/functional first-order models
> - JSON telemetry
> - JSONL output
> - SQLite output
> - pluggable database sinks
> - MQTT output
> - asynchronous MQTT publishing
> - durable store-and-forward outbox
> - reconnect/retry
> - idempotent message IDs
> - configurable telemetry rates
> - simulation diagnostics
> - graph validation
> - explainable causal traces
>
> Implement the project incrementally according to the phases in `IMPLEMENTATION_PLAN.md`.
>
> Do not skip directly to the UI.
>
> Do not replace the architecture with a hardcoded collection of component-specific scripts.
>
> Do not put MQTT/database logic inside simulation behaviors.
>
> Do not block the simulation loop on network or database operations.
>
> Do not use telemetry as internal component state.
>
> Prefer clear interfaces and dependency inversion.
>
> Every phase must include tests.
>
> Before implementing a phase:
>
> 1. inspect the existing repository
> 2. identify what has already been implemented
> 3. summarize the relevant existing architecture
> 4. implement only the next phase
> 5. run tests
> 6. run static/type checks where configured
> 7. run a minimal example
> 8. fix regressions
> 9. update documentation
>
> Do not silently invent incompatible JSON formats.
>
> Preserve unknown specification fields so the system remains forward compatible.
>
> When a behavior cannot be inferred, use GenericBehavior and emit a diagnostic rather than crashing.
>
> For physical models, prefer simple transparent equations for the MVP. Document every equation.
>
> The final architecture should allow a completely new small topology/specification pair to run without modifying simulator source code.
>
> Begin with Phase 1 only.

---

# 43. Prompt for Later "Implement Next Phase" Iterations

Use this repeatedly:

> Continue implementing the next incomplete phase from `IMPLEMENTATION_PLAN.md`.
>
> First inspect the repository and determine exactly which phases are complete.
>
> Do not reimplement working code.
>
> Implement only the next logical phase and all tests required for it.
>
> Preserve the existing architecture:
>
> ```text
> JSON
>  -> validation
>  -> normalized graph
>  -> behavior inference
>  -> simulation engine
>  -> state propagation
>  -> telemetry
>  -> output sinks
> ```
>
> Keep the simulation engine independent from MQTT and databases.
>
> Keep component behavior independent from topology names.
>
> Run the complete test suite after implementation.
>
> Run the smallest available example and verify actual output.
>
> If the existing implementation conflicts with the plan, do not blindly rewrite it. Explain the conflict, make the smallest safe architectural correction, and then continue.
>
> At the end, report:
>
> - files changed
> - functionality added
> - tests added
> - tests passed
> - known limitations
> - next phase

---

# 44. Prompt for Debugging an Existing Implementation

> Act as a senior distributed-systems and simulation-engineering reviewer.
>
> Inspect the current implementation against `IMPLEMENTATION_PLAN.md`.
>
> Look specifically for:
>
> - topology-specific hardcoding
> - simulation/network coupling
> - blocking MQTT operations
> - lack of durable outbox
> - nondeterministic simulation
> - wall-clock/simulation-clock confusion
> - incorrect event timing
> - state/telemetry coupling
> - invalid causal propagation
> - unit inconsistencies
> - impossible physical states
> - missing graph validation
> - duplicate message problems
> - race conditions
> - unbounded queues
> - behavior registry violations
> - poor failure handling
>
> Do not immediately rewrite the project.
>
> Produce a prioritized list of architectural problems, then fix the highest-impact problems one at a time with tests.

---

# 45. Long-Term Architecture

The eventual system should look like:

```text
                         +-----------------------+
                         | Topology JSON         |
                         +-----------+-----------+
                                     |
                         +-----------v-----------+
                         | Specification JSON    |
                         +-----------+-----------+
                                     |
                         +-----------v-----------+
                         | Schema Validator      |
                         +-----------+-----------+
                                     |
                         +-----------v-----------+
                         | Model Compiler        |
                         +-----------+-----------+
                                     |
                    +----------------v----------------+
                    | Generic Digital Twin Model     |
                    |                                |
                    | Components                     |
                    | Connections                    |
                    | Specifications                 |
                    | Behaviors                      |
                    | Runtime State                  |
                    +----------------+---------------+
                                     |
                         +-----------v-----------+
                         | Simulation Engine      |
                         |                       |
                         | Clock                 |
                         | Scheduler             |
                         | Environment           |
                         | Events                |
                         | State Propagation     |
                         +-----------+-----------+
                                     |
                         +-----------v-----------+
                         | Telemetry Engine      |
                         +-----------+-----------+
                                     |
                  +------------------+------------------+
                  |                  |                  |
                  v                  v                  v
              JSONL/STDOUT       Database           MQTT
                                     |                  |
                                     |             +----v----+
                                     |             | Outbox  |
                                     |             +----+----+
                                     |                  |
                                     |             reconnect
                                     |                  |
                                     |             +----v----+
                                     +-------------| MQTT   |
                                                   +---------+
```

This architecture gives you one core simulator that can evolve into:

```text
Digital twin engine
        +
Scenario/what-if engine
        +
Synthetic telemetry generator
        +
Fault injection platform
        +
System integration test harness
```

without requiring a separate simulator for every station/system.

---

# 46. Final Architectural Rule

The most important rule for the project is:

> **The topology and specification describe the system; the simulation engine interprets the description.**

Avoid this:

```python
if component.name == "Generator1":
    ...
```

Prefer:

```python
if component.type == "generator":
    ...
```

Better:

```python
behavior = behavior_registry.resolve(component)
behavior.step(...)
```

And eventually:

```text
JSON
  |
  v
semantic model
  |
  v
behavior selection
  |
  v
simulation
```

That distinction is what makes the system reusable across multiple digital twins rather than turning into a giant `if-else` zoo.

