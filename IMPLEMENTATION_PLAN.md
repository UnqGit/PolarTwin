# PolarTwin — Extensive Implementation Plan

> **Purpose:** Implementation blueprint for PolarTwin, the Antarctic research-station digital platform defined by the supplied specification.
>
> **Authority rule:** `hierarchy.twin`, `connection.twin`, and `spec.twin` are authoritative for the station model. `.scene` and `.event` are authoritative for scheduled simulation behavior. Runtime JSON files represent current state; the telemetry database represents persisted history. The frontend is a projection/editor over those systems and must not invent conflicting semantics.

---

# 0. Global Implementation Rules

## 0.1 Required subsystems

Build these cooperating subsystems:

1. Twin DSL compiler:
   - `hierarchy.twin` -> `hierarchy.json`
   - `connection.twin` -> compiled `connection.json`
   - `spec.twin` -> resolved `spec.json`
2. Runtime state:
   - `component.json`
   - simulation `connection.json`
   - `external.json`
3. Scenario DSL:
   - `.scene`
   - `.event`
4. Deterministic simulation engine.
5. Optional simulation telemetry publishing and persistent telemetry history.
6. Backend API and persistence.
7. Frontend pages:
   - Overview
   - Digital Twin
   - Components
   - Connections
   - History and Diagnostics
   - Scenario / Simulation

## 0.2 Recommended implementation stack where the specification is silent

Use existing repository technology if already established. Otherwise:

- Frontend: TypeScript + React + React Three Fiber/React Three.
- Backend: Python + FastAPI.
- Domain validation: Pydantic.
- Database: PostgreSQL.
- Source editor: Monaco or equivalent.
- Simulation: isolated deterministic worker/core library.
- Streaming: WebSocket or SSE.
- Tests: unit, parser golden, simulation deterministic, API integration, frontend interaction, E2E.

These are implementation choices, not changes to the product semantics.

## 0.3 Runtime/status enums

```text
ComponentStatus = inactive | active | failure
ConnectionStatus = inactive | active | failure
ConnectionType = power | data | signal | resource
SimulationStatus = Ready | Running | Paused | Completed | Error
TelemetrySource = SIMULATION | PHYSICAL/LIVE
```

Component names are globally unique. A connection is identified by source + type + target. Every simulation execution has a unique run identifier.

---

# Phase 1 — Repository and Domain Foundation

## Deliverables

Create clear modules for:

```text
apps/web
apps/api
apps/simulator
packages/twin-domain
packages/twin-parser
packages/twin-compiler
packages/scenario-parser
packages/simulation-core
packages/shared-models
tests/fixtures
```

Keep parser, compiler, simulation, persistence, and frontend responsibilities separate.

## Clock abstraction

Never use wall-clock time inside simulation rules.

```text
SECONDS_PER_SIMULATION_TICK = 15
TICKS_PER_SIMULATION_HOUR = 240
SIMULATION_SECONDS_PER_HOUR = 3600
```

Default playback:

```text
1 real-world second = 1 simulation tick = 15 simulation seconds
```

Changing playback speed changes how quickly ticks execute in wall-clock time only; it never changes event timestamps, durations, ordering, tick size, or internal timestamps.

## Error taxonomy

Implement structured errors:

```text
LexicalError
ParseError
SemanticValidationError
ReferenceResolutionError
UnitValidationError
ScenarioValidationError
SimulationError
PersistenceError
```

All frontend diagnostics should receive stable error codes and source locations.

---

# Phase 2 — Twin Domain Model

## 2.1 Hierarchy model

Represent every hierarchy component with:

```text
name
type
parent
priority
floor
is_backup
backup[]
external_field
children[]
tags[]
```

Supported containers:

```text
campus
station
floor
block
system
```

Supported internal/leaf types:

```text
sensor
antenna
generator
controller
tank
pump
storage
vent
alarm
server
vehicle
solar_panel
air_conditioner
```

Structural rules:

- `station` may be root or child of `campus`.
- `floor` may only be inside `station` or `block`.
- Every floor has integer `@level`.
- Non-floor elements default to floor `0`.
- Names are globally unique.
- Lower priority numbers mean higher priority; equal priorities are allowed.
- Backup targets must be the same component type as the backup component.

## 2.2 Connection model

Compiled connection:

```text
source
target
type
relation
```

Supported types:

```text
power
data
signal
resource
```

Runtime connection:

```text
source
target
type
status
```

The runtime form removes `relation` and adds `status`.

## 2.3 Specification model

Support:

```text
default/type specification
component-specific specification
rating@input
rating@output
rating@state
dimension
description
representation
sensor measures/rating
```

Inheritance is CSS-like:

1. Start with type default.
2. Apply explicit component values.
3. Inherit every omitted value.
4. Emit fully resolved `spec.json` entries for every hierarchy component.

---

# Phase 3 — Units, Pydantic Models, and Sensor Coverage

Implement canonical unit conversion/validation with Pydantic/domain validators.

| Measurement | Accepted units | Canonical |
|---|---|---|
| voltage | V, mV, kV | V |
| current | A, mA | A |
| power | W, kW | W |
| energy | Wh, kWh, J, kJ | J |
| light_irradiance | W/m2 | W/m2 |
| frequency | Hz, kHz, MHz, mHz | Hz |
| temperature | C, K, F | C |
| flowrate | cc/s, m3/hr, L/s, CFM | L/s |
| air_particulates | ppm, bpm | ppm |
| o2_level | % | 0–1 |
| co2_level | % | 0–1 |
| volume | L, m3, cm3, ml | L |
| weight | kg, g, mg | kg |
| count | - | - |

Runtime component values must use canonical units and therefore need not store units alongside every value.

Sensor requirements are hard validation rules:

```text
Component -> Sensor -> Antenna
```

For every rating value type defined for a component, there must be a sensor measuring that value. A sensor measures exactly one value, participates only in data connections, has exactly one incoming and exactly one outgoing connection, and its outgoing connection terminates at an antenna.

---

# Phase 4 — `hierarchy.twin` Parser/Compiler

## Lexer

Tokenize identifiers, `:`, `@`, `%`, parentheses, braces, commas, `backup`, `external`, integers, and supported whitespace/comments.

## Parser

Support nested declarations such as:

```text
Station:station @0 %critical {
  HVACBlock:block @0 {
    HeatingSystem:system @0 {
      MainConditioner:air_conditioner @0 %primary
      BackupConditioner:air_conditioner @0 backup(MainConditioner) %backup
    }
  }
}
```

Support multiple backup targets and external references such as:

```text
backup(MainConditioner, Conditioner2)
external@network.up
```

Preserve source locations in the AST.

## Semantic validation

Check:

- supported types;
- legal parent-child relationships;
- floor rules;
- integer priorities;
- globally unique names;
- backup target existence and same type;
- external reference syntax;
- duplicate/conflicting attributes.

## Output

Emit one object per component:

```json
{
  "name": "ComponentName",
  "type": "ComponentType",
  "parent": "DirectParentName",
  "priority": 0,
  "floor": 0,
  "is_backup": false,
  "backup": [],
  "external_field": null,
  "children": [],
  "tags": []
}
```

Build `children[]` from parent relationships.

## Tests

Golden fixtures for campus/station, nested containers, floors, tags, backup, multiple backup targets, external references, duplicate names, invalid parents, invalid types, and missing floor levels.

---

# Phase 5 — `connection.twin` Parser/Validator

Parse:

```text
source:target[connection_type]@relation
```

Example:

```text
EnergyController:Generator1[signal]@energy_demand
```

Validate:

- source exists;
- target exists;
- source != target;
- connection type is one of the four supported types;
- floor components have no connections;
- sensors only use data;
- sensor has exactly one incoming and one outgoing connection;
- sensor outgoing target is antenna;
- controllers only use signal;
- alarms have exactly one incoming signal and no outgoing connection.

Compile to `source`, `target`, `type`, `relation` only.

---

# Phase 6 — `spec.twin` Parser, Defaults, Inheritance, and Compilation

Only one outer scope is allowed. Inner scopes are `rating` and `dimension`; rating groups are `input`, `output`, `state`.

Support scalar and range values:

```text
frequency=50 unit=Hz
voltage=120:255 unit=V
```

Implement deep, field-aware inheritance rather than shallow object replacement.

## Required defaults

### generator

```text
input: flowrate=0:135 L/hr
state: temperature=10:95 C
output: power=0:500 kW
dimension: 4m x 2m x 1.75m
description="Generates electrical power"
representation=generator
```

### pump

```text
input: voltage=240 V, current=0:12 A
state: temperature=10:50 C
output: flowrate=90:600 L/hr
dimension: 0.4m x 0.3m x 0.2m
description="Pushes liquid"
HP=2
representation=pump
```

### solar_panel

```text
input: light_irradiance=0:1000 W/m2
output: power=0:400 W
dimension: 2m x 1m x 0.1m
description="Converts solar energy into electrical power"
representation=solar_panel
```

### air_conditioner

```text
input: voltage=220 V, current=0:9 A
state: temperature=0:65 C
output: flowrate=0:1000 L/hr, temperature=16:40 C
description="Provides stable temperature source"
representation=air_conditioner
```

### tank

```text
state: volume=0:3000 L
description="holds water"
representation=tank
```

### sensor

```text
measures=voltage
rating=0:100 V
description="Measures quantity"
representation=sensor
```

### storage

```text
state: count=0:200, weight=0:1000 kg
dimension: 5m x 5m x 3m
description="Stores items"
representation=storage
```

### alarm

```text
input: voltage=12 V, current=0:5 A
description="Alerts"
representation=alarm
```

### antenna

```text
input: voltage=15 V, current=0:5 A
state: frequency=40:75 kHz
description="Transmits signal"
representation=antenna
```

### vehicle

```text
dimension: 3m x 1.2m x 1.2m
description="Transportation assist"
representation=vehicle
```

### server

```text
input: power=200:1000 W
state: temperature=10:50 C
description="Stores data"
representation=server
```

### vent

```text
input: voltage=30 V, current=0:2 A
output: flowrate=0:75 L/hr
description="Passes air"
representation=vent
```

### controller

```text
input: voltage=24 V, current=0:15 A
description="Signals components"
representation=controller
```

### station

```text
state: count=0:50, temperature=0:30 C
description="Antarctic research station"
representation=station
```

### block

```text
state: temperature=10:30 C
description="Block inside the research station"
representation=block
```

Golden-test every default and every inheritance/override path.

---

# Phase 7 — Runtime Models

## `external.json`

Groups:

```text
weather
network
supplies
```

Weather fields:

- temperature
- wind speed
- humidity
- O2 level
- CO2 level
- wind direction
- visibility
- pressure
- dew frost point

Network fields:

- bandwidth
- mainland connectivity
- upload window
- upload speed (canonical KB/s)
- download speed

Supplies contain ETA in days, description, and transport mode such as air/water.

## `component.json`

```json
{
  "name": "ComponentName",
  "type": "ComponentType",
  "is_backup": false,
  "status": "active",
  "value": {}
}
```

Support inactive/active/failure. Preserve state/input/output distinctions when a field name occurs in multiple sections.

## Runtime `connection.json`

```json
{
  "source": "SourceNodeName",
  "target": "TargetNodeName",
  "type": "connection_type",
  "status": "active"
}
```

Keep this separate from compiled connection definitions.

---

# Phase 8 — `.scene` and `.event` DSL

## Scene model

Represent each event instance with:

```text
event reference
selector
at
duration
set payload
source location
source order
```

`at` and `for` use simulation hours because one simulation time unit = one hour.

Support:

```text
event:failure @Generator1 at=1.0 for=2.0
event:failure @generator at=1.5 for=0.5
event:failure_except_backup @generator at=2.0 for=1.0
event:network_outage at=2.0 for=inf
event:connection_failure @(|data|) at=1.0 for=6.0
event:set_external @network at=1.0 for=0.5 { ... }
event:set_component @Generator1 at=1.2 for=inf { ... }
event:fix_connection @(Generator1|data|) at=2.0 for=inf
```

## Event definitions

Support:

```text
target
where
set
```

Target selectors:

### Component

```text
@component.name
@component.type
@component.type | @component.name
```

Standalone `@component` is invalid.

### Connection

General:

```text
@connection
```

Scene selector:

```text
(source|type|target)
```

All three fields optional individually, but at least one must be supplied and the parenthesized syntax retained.

Examples:

```text
@(|data|)
@(Generator1|data|Antenna1)
```

Field-specific selectors:

```text
@connection.source
@connection.target
@connection.type
```

Multiple connection fields may be expressed as `@connection.(field1 & field2)`; the fields must be distinct.

### External

General `@external` requires a scene selector such as `@network`, `@weather`, or `@supplies`.

Specific forms require no additional selector:

```text
@external.network
@external.weather
@external.supplies
```

---

# Phase 9 — `where` and `set` Semantics

## `where`

Evaluate for every selected node; retain only true results.

Component examples:

```text
where value.temperature>30.0
where is_backup=true
```

Connection references from components:

```text
where @connection(@node|data|)
where @connection(@node||@component.type=generator)
where @connection(MainController||@node)
where @connection(@node||).status=failure
```

Connection references to components:

```text
where @component(source).type=generator
& type=data
& @component(target).type=sensor
where @component(source).is_backup=true
```

Build a typed expression AST; never execute arbitrary Python/JavaScript.

## `set`

Support:

```text
set fields
set { value }
set value.temperature=124.2
```

Support mixed declarations such as:

```text
set {
  values.temperature
  values.voltage.output=120
  status=failure
  fields
}
```

Fixed event values cannot be overridden by the scene. `is_backup` is immutable.

For `for=inf` sets:

- remove previously active sets on affected fields;
- write values into underlying state;
- fields become mutable again subject to set restrictions.

Finite-duration changes remain temporary.

---

# Phase 10 — Event Stack and Timeline Semantics

For every affected field track:

```text
base value
active event layers
```

Each layer stores event ID, source order, start/end, value, finite/infinite state, and field.

Events are processed chronologically. Equal `at` values use stable source order.

For:

```text
X = R
A -> S for N
B -> T for M
```

if `M > N`, A expires first and X remains T. If `N > M`, B expires first and X becomes S; when A later expires X becomes R.

This exact stack-unwinding behavior must be unit-tested.

---

# Phase 11 — Simulation Engine Core

Implement one deterministic tick pipeline:

1. Advance simulation time by 15 simulation seconds.
2. Instantiate events whose `at` time has been reached.
3. Apply event mutations in stable order.
4. Expire finite event layers.
5. Resolve hierarchical effective status.
6. Resolve active/inactive/failure connections.
7. Resolve missing data.
8. Resolve resource allocation and automatic activation/deactivation.
9. Apply controller adjustments.
10. Run type-specific component behavior.
11. Evaluate rating/tolerance failure countdowns.
12. Apply backup behavior.
13. Recalculate container/station thermal state.
14. Write runtime component state.
15. Write runtime connection state.
16. Update external runtime state.
17. Produce simulation log entries.
18. If telemetry publishing is enabled, persist one record.
19. Publish a state update to the frontend.

Centralize ordering and test it. Do not scatter tick semantics across UI callbacks.

## Hierarchical status

If a parent is inactive/failure, descendants do not function. Do not mutate every descendant merely to represent propagation; compute effective state through `hierarchy.json` when possible.

## Missing data

Inactive data connection -> transmitted data is `NULL`.

Extrapolate missing values from:

1. other available non-missing data;
2. previously valid data for that field.

Make the precedence deterministic.

---

# Phase 12 — General Simulation Rules

## Backup

- Backups remain off until at least one backed-up same-type component is active.
- Backup automatically activates when all components it backs up are inactive/failure.
- Scene may explicitly activate backup earlier.

## Controllers

- Components controlled through `signal` may have operational values adjusted.
- Adjustments depend on other components/system requirements.
- Inactive controller or inactive controller connection prevents automatic adjustment.

## Tolerance

If component tolerance is `x` and global tolerance is `y`:

```latex
\[
T_{\mathrm{specific}}=T_{\mathrm{component}}\left(1+\frac{T_{\mathrm{global}}}{100}\right)
\]
```

Human-readable: `specific tolerance = component tolerance × (1 + global tolerance / 100)`.

Specific tolerance factor:

```latex
\[
SPF=1+\frac{T_{\mathrm{specific}}}{100}
\]
```

Maximum tolerated value:

```latex
\[
R_{\mathrm{tol}}=R_{\mathrm{max}}\cdot SPF
\]
```

## Automatic resource activation/deactivation

Inactive components may activate to meet demand unless their inactive state was explicitly imposed by a scene event. If demand remains unsatisfied, deactivate the lowest-priority applicable component first. Lower numerical priority means higher priority.

---

# Phase 13 — General Failure Model

For a leaf component exceeding `max_rating_limit`:

```latex
\[
t_{\mathrm{off}}=1-3a_c^2+2a_c^3
\]
```

Human-readable: `toff = 1 - 3ac² + 2ac³`.

```latex
\[
a_c=\operatorname{clamp}(a,0,1)
\]
```

```latex
\[
a=\frac{\mathrm{current\_value}-\mathrm{max\_rating\_value}}
{\mathrm{max\_tolerated\_value}-\mathrm{max\_rating\_value}}
\]
```

Human-readable: `a = (current value - max rated value) / (max tolerated value - max rated value)`.

Rules:

- countdown uses simulation time, not wall-clock time;
- failure occurs only if the value remains beyond permitted rating/tolerance for the calculated duration;
- returning to the permitted range cancels the countdown;
- log the automatic failure transition.

---

# Phase 14 — General Power and Allocation

Power applies to components where relevant.

If explicit power exists, it wins. Otherwise:

```latex
\[
P=VI
\]
```

Human-readable: `power = voltage × current`.

For multiple active power supplies, distribute demand so a greater proportion is requested from the source with lower current load. Use deterministic tie-breaking.

---

# Phase 15 — Exact Component Behaviors

Implement a behavior module for each type. Each module should calculate requirements, outputs, state changes, and failure-related behavior without bypassing the shared resource/status engine.

## 15.1 Generator

If:

```latex
\[
P_D<P_A+P_B+P_C
\]
```

first attempt to increase generator output if capacity exists.

If it can provide at least 35% of total requested power:

```latex
\[
x=\frac{P_D}{P_A+P_B+P_C}
\]
```

Each requester receives `x × requested power`.

If below 35%, deactivate the lowest-priority component. If an inactive applicable component can be activated to restore >=35%, activate it instead. Never override explicit scene-imposed inactivity.

### Generator temperature

```latex
\[
T_{\mathrm{curr}}(n)=T_{\mathrm{curr}}(n-1)+\beta\left(\alpha_{\mathrm{component}}T\frac{P_{\mathrm{curr}}}{P}+T_{\mathrm{surr}}-T_{\mathrm{curr}}(n-1)\right)
\]
```

Where:

```text
T = maximum rated temperature - minimum rated temperature
P = maximum power output - minimum power output
Tsurr = containing component temperature
alpha_component = 0.225
beta = 0.5
```

### Generator flow/power

```latex
\[
FR_{\mathrm{required}}=FR_{\mathrm{rating,max}}\frac{P_{\mathrm{curr}}}{P_{\mathrm{rating,max}}}
\]
```

Human-readable: required flowrate is maximum rated flowrate multiplied by current power divided by maximum rated power.

Available flowrate proportionally constrains maximum possible power.

### Startup deadlock

An inactive generator may start at minimum operating capacity if its required pump is inactive, allowing the pump to start and preventing generator/pump soft-lock.

## 15.2 Pump

For connected requesters:

```latex
\[
FR_P=FR_A+FR_B+FR_C
\]
```

If demand exceeds pump capacity:

- increase output if possible;
- if maxed but >=30%, allocate proportionally:

```latex
\[
x=\frac{FR_P}{FR_A+FR_B+FR_C}
\]
```

- each requester receives `x × requested flowrate`;
- below 30%, deactivate lowest-priority requester;
- if activating the highest-priority applicable inactive component restores >=30%, activate it.

Pump temperature uses the generator temperature model with resource term:

```latex
\[
\frac{FR_{\mathrm{curr}}}{FR}
\]
```

Pump power and flowrate are directly proportional within rated range.

## 15.3 Solar panel

```latex
\[
P_{\mathrm{curr}}=P_{\mathrm{max}}\frac{I_{\mathrm{curr}}}{I_{\mathrm{max}}}
\]
```

Clamp output to maximum rated power.

## 15.4 Tank

```latex
\[
V_{\mathrm{curr}}(n)=V_{\mathrm{curr}}(n-1)-\left(\sum FR_{\mathrm{pump}}\right)\Delta t
\]
```

Volume cannot become negative. Empty tank turns off pumps relying on it; a pump can remain active if another connected tank is non-empty and can supply the resource.

## 15.5 Antenna

Frequency is random within rated range and has no resource effect.

```text
0 active connections -> 0 A
1–19 active connections -> Imax / 2
20+ active connections -> Imax
```

## 15.6 Server

Use generator temperature model, but use:

```latex
\[
\frac{P_{\mathrm{required}}}{P}
\]
```

for the power term.

## 15.7 Alarm

```text
inactive -> 0 A
active -> 5 A
```

Power uses the general calculation.

## 15.8 Air conditioner

Current:

```latex
\[
I_{\mathrm{required}}=I_{\mathrm{max}}\left[\alpha\left(\frac{FR_{\mathrm{curr}}}{FR_{\mathrm{max}}}\right)+(1-\alpha)\operatorname{clamp}\left(\frac{|T_{\mathrm{output}}-T_{\mathrm{surr}}|}{T_{\mathrm{max}}-T_{\mathrm{min}}},0,1\right)\right]
\]
```

with `alpha=0.4`.

```latex
\[
P_{\mathrm{required}}=V_{\mathrm{curr}}I_{\mathrm{required}}
\]
```

Airflow:

```latex
\[
FR_{\mathrm{required}}=\sum_{k=1}^{N_{\mathrm{vent}}}FR_{\mathrm{vent},k}
\]
```

No 30%/35% cutoff applies to AC airflow.

Output temperature:

```latex
\[
T_{\mathrm{out}}(n)=T_{\mathrm{out}}(n-1)+\beta(T_{\mathrm{target}}-T_{\mathrm{out}}(n-1))
\]
```

with `beta=0.5`.

Non-zero insufficient power means continue at reduced power rather than immediately shutting down. Shutdown is through the temperature failure rule.

## 15.9 Vent

```latex
\[
P=VI
\]
```

Current is directly proportional to airflow up to maximum rated current.

## 15.10 Containers

Temperature:

```latex
\[
T_{\mathrm{curr}}(n)=T_{\mathrm{curr}}(n-1)+\beta\left(\alpha_{\mathrm{inner}}I_{\mathrm{avg}}+V_{\mathrm{all}}+\alpha_{\mathrm{surr}}T_{\mathrm{surr}}-T_{\mathrm{curr}}(n-1)\right)
\]
```

Defaults:

```text
beta = 0.5
alpha_inner = 0.225
alpha_surr = 0.8
```

Average child temperature:

```latex
\[
I_{\mathrm{avg}}=\frac{1}{N_{\mathrm{inner}}}\sum_{k=1}^{N_{\mathrm{inner}}}T_k
\]
```

Airflow-weighted AC contribution:

```latex
\[
V_{\mathrm{all}}=\frac{1}{A_{\mathrm{mtotal}}}\sum_{k=1}^{N_{\mathrm{vent}}}V_kA_{\mathrm{curr},k}
\]
```

with:

```latex
\[
A_{\mathrm{mtotal}}=\sum_{k=1}^{N_{\mathrm{vent}}}A_{\mathrm{max},k}
\]
```

Definitions:

- `Tk`: kth child temperature.
- `Vk`: associated AC output temperature.
- `A_curr,k`: current airflow through kth vent.
- `A_max,k`: maximum vent airflow.

Containers do not immediately fail from temperature. Corrective sequence:

1. Increase connected vent airflow until max.
2. If vents maxed, decrease applicable AC target temperature by `2°C`.
3. If still hot, attempt to decrease temperature output of inner components/containers.
4. Only then consider ordinary failure behavior as applicable.

## 15.11 Station

```latex
\[
T_{\mathrm{surr}}=T_{\mathrm{external}}+20
\]
```

Use current external temperature for station environmental/thermal behavior.

---

# Phase 16 — Telemetry and Persistence

## Publishing

UI control:

```text
Publish Simulation as Live Telemetry
```

Disabled:

```text
Simulation -> Runtime state
```

Enabled:

```text
Simulation -> Runtime state -> Telemetry record -> Telemetry DB
```

Stopping telemetry publishing must not stop or modify simulation.

## Sampling

One telemetry record per simulation tick while publishing. At default playback this means one record per real-world second and each record represents another 15 simulation seconds.

## Record contents

State:

- components;
- component values;
- component statuses;
- connection statuses;
- external fields.

Metadata:

- station/model;
- simulation/scenario run ID;
- simulation timestamp;
- persistence timestamp;
- source.

Use `source=SIMULATION` for generated records and distinguish physical/live data.

## Database

Recommended logical entities:

```text
stations
station_models
scenarios
simulation_runs
telemetry_records
telemetry_component_states
telemetry_connection_states
telemetry_external_states
```

Index by station/time, source/time, run/simulation-time, component/time, and connection/time.

Historical records are append-only and must be reconstructable independently.

---

# Phase 17 — Backend API

Implement endpoints equivalent to:

```text
GET  /stations
GET  /stations/{id}
GET  /stations/{id}/model
GET  /stations/{id}/hierarchy
GET  /stations/{id}/connections
GET  /stations/{id}/spec
GET  /stations/{id}/runtime

GET    /stations/{id}/scenarios
POST   /stations/{id}/scenarios
GET    /scenarios/{id}
PUT    /scenarios/{id}
POST   /scenarios/{id}/duplicate
DELETE /scenarios/{id}
POST   /scenarios/{id}/validate
GET    /scenarios/{id}/source
PUT    /scenarios/{id}/source

GET /event-definitions
GET /event-definitions/{name}

POST /simulations
GET  /simulations/{runId}
POST /simulations/{runId}/play
POST /simulations/{runId}/pause
POST /simulations/{runId}/step
POST /simulations/{runId}/reset
POST /simulations/{runId}/telemetry/start
POST /simulations/{runId}/telemetry/stop
GET  /simulations/{runId}/state
GET  /simulations/{runId}/log

GET /telemetry
GET /telemetry/runs
GET /telemetry/records/{id}
GET /telemetry/components/{id}
GET /telemetry/connections/{id}
GET /telemetry/external
```

Revalidate all frontend-submitted DSL and initial-state data on the backend.

---

# Phase 18 — Frontend Shell and Global Navigation

Global navigation:

- Overview
- Digital Twin
- Components
- Connections
- Scenario / Simulation
- History and Diagnostics

Theme selector: dark/light.

Persist selected station/model across navigation. Switching stations reloads the corresponding model, specs, telemetry, scenarios, and runtime context.

Shared state should separate server state, editor state, simulation state, and UI state.

---

# Phase 19 — Overview

Display:

1. station name;
2. satellite image;
3. dashboard;
4. rotating block cards.

Dashboard:

- active components / total;
- station power output;
- station temperature;
- next supply arrival.

Block cards:

- related image;
- name;
- active/inactive/failure;
- functioning inner components / total.

Randomly rotate block selection with fade transition.

---

# Phase 20 — Digital Twin 3D

## Data source separation

Static structure:

```text
hierarchy.json
connection.json
spec.json
```

Dynamic current state:

```text
latest persisted telemetry record
```

If no telemetry exists, show current telemetry unavailable. Never fabricate values.

## Workspace

```text
Left: collapsible Hierarchy / Connections / Settings
Center: interactive 3D station
Right: station info / hover card / inspector
Bottom-left: Focus
```

## Settings

Interactivity:

```text
Components interactable = On
Connections interactable = On
Interactable floor level = 0
```

Floor filtering makes only selected floor interactive and makes other components/floor containers almost transparent. If both interaction types are off, use the same transparency rather than floor-based differentiation.

View controls:

```text
Hide all components
Hide all connections
Lighting = Off | Baked | Dynamic
Occlusion = Off(translucent) | Off on hover
```

Defaults: lighting Off; occlusion Off(translucent).

## Hierarchy panel

File-explorer behavior:

- containers behave like folders;
- leaves behave like files;
- expand/collapse;
- visibility toggles;
- subtree hiding also hides associated wires;
- Expand All / Collapse All.

Container status:

- gray dot if any inner component inactive;
- red dot if any inner component failed;
- active tag only if all inner components active.

## 3D geometry

- container types = boxes sized to fit children;
- campus = plane underneath model;
- leaf types get dedicated 3D representations;
- same floor = same altitude;
- different floors = corresponding altitudes;
- suspended/hanging floors get four corner support beams;
- unconnected floors get visual lift mesh; lift is not interactable.

## Connections

Render cuboidal wires.

| Type | Required visual | Relative thickness |
|---|---|---|
| power | pale red | slightly thicker |
| data | pale blue | slightly thinner |
| signal | pale yellow | thinnest |
| resource | pale green | thickest |

Endpoints attach to component walls.

Routing must:

- avoid unrelated components;
- stay inside outer container bounds;
- clamp to container walls;
- use staircase-like paths;
- use four horizontal directions;
- support floor transitions;
- use 3D A* obstacle avoidance.

## Connection buses

Merge same-type connections traveling through the same general area. Preserve type appearance; bus gets thicker as connections merge. Different types must not overlap, although they may cross. Hover/select bus highlights every member and inspector lists all members.

## Hover

Hovered component/connection gets yellow overlay + outline.
Hovered component highlights associated connections pale yellow. Hovered connection highlights both endpoint components pale yellow. Show right-side hover card. With `Off on hover`, containers become translucent when hovered. Most-specific object under cursor wins.

## Selection

Selected component/connection gets golden overlay + outline. Selected component highlights associated connections pale gold. Selected connection highlights both endpoint components.

Component inspector:

- name/type;
- connected components/connections;
- current values;
- tags;
- backup designation;
- status;
- dimensions;
- position.

Connection inspector shows source/target/type/relationship/status. Bus inspector lists all member connections. Dynamic values come from latest telemetry.

Selection works from hierarchy, 3D view, Connections panel and remains synchronized.

## Connections panel

Sort/group by:

- source;
- target;
- connection type.

Each connection has an independent visibility toggle.

## Focus

Reset rotation, zoom/scale, pan, camera and viewport to defaults.

---

# Phase 21 — Components Page

Initially show cards for outermost components/containers.

Card:

- image;
- name;
- status;
- power consumption where applicable;
- inspector button.

Clicking a container drills into children with a fade transition. Provide navigation back to parent without losing hierarchy context.

---

# Phase 22 — Connections Page

Represent components as rectangles; nested components appear inside parent rectangles; names above shapes.

Generate connections from station topology. Endpoints touch rectangle walls. Reuse Digital Twin connection colors/thicknesses.

Support hover and golden selection with right-side inspector.

Support zoom and drag/pan. Focus is bottom-right. Zoom-out must not exceed 3.5 times the full graph size.

---

# Phase 23 — History and Diagnostics

Historical information must always come from persisted telemetry. Never substitute current in-memory runtime state.

## Filters

- station/model;
- start/end time;
- source: physical vs simulation;
- simulation run when simulation source selected.

## Timeline

Show simulation time and persistence time separately. Show component status changes, connection changes, external-field changes, and telemetry records.

## Table

Columns:

- simulation time;
- persistence time;
- source;
- simulation run;
- station/model;
- components summary;
- connections summary;
- external fields summary.

## Component history

Show name/type, historical values, value changes, operational status, transitions, simulation/persistence timestamps, source, and run. Values use canonical units.

## Connection history

Show source, target, type, status history, transitions, simulation/persistence timestamps, source, run. Statuses are active/inactive/failure.

## External history

Weather: temperature, wind speed, humidity, O2, CO2, wind direction, visibility, pressure, dew/frost point.

Network: bandwidth, mainland connectivity, upload window, upload speed, download speed.

Supplies: ETA, description, transport mode.

## Run reconstruction

Simulation run ID is the primary reconstruction filter. Records from another execution of the same scenario must never be mixed in.

## Record inspector

Show station/model, source, run, simulation time, persistence time, complete component state/value/status, connection status, and external fields. This is the persisted historical snapshot, not current runtime state.

## Diagnostics

Show record count, selected run, source, first/last record, missing/unavailable data, selected record timestamps. If no historical data exists, state that explicitly.

---

# Phase 24 — Scenario/Simulation Workspace

## Layout

```text
Top bar:
  scenario selector, validation, simulation time, playback controls,
  save state, telemetry status

Left collapsible:
  scenario library, event library

Center:
  simulation monitor / Digital Twin
  timeline

Right collapsible:
  event inspector
  component/connection inspector

Bottom collapsible:
  simulation log
  diagnostics
  DSL source editor
```

Timeline and monitor receive greatest visual emphasis.

## Scenario library

Support create/open/rename/duplicate/delete. New scenario can be empty or a duplicate. Duplicate is independent. Delete requires confirmation.

Display name, optional description, event count, determinable duration, save state, validation state.

## Initial state

Before execution configure:

Components: operational status, current values, other mutable fields.

Connections: status.

External: weather, network, supplies, other mutable fields.

Validate against digital twin/spec. Unconfigured fields use defaults/baselines. Initial state is separate from events and begins at simulation time 0.

## Simulation states

```text
Ready
Running
Paused
Completed
Error
```

Display current time separately from total duration.

## Telemetry states

```text
Not Publishing
Publishing
Stopped
```

## Playback

Play, Pause, Step, Reset, Speed.

Step = exactly one simulation tick.

Reset restores initial component values/statuses, initial connection state, initial external conditions, clears temporary event effects, and resets time. Confirm while running or if unsaved results would be discarded.

---

# Phase 25 — Event Library, Timeline, Inspector

## Event library

Display event name, description, target type, modifiable fields, and whether scene configuration is required.

Required event types:

```text
failure
failure_except_backup
network_outage
connection_failure
fix_connection
set_external
set_component
```

Adding an event only edits the scenario; it must not directly mutate runtime state.

## Timeline

Display horizontal simulation-time axis, playhead, tracks, zoom, horizontal scroll, selection, movement, resizing, deletion, and creation.

Event bar spans `at` to `at + for`. Infinite duration has no scheduled endpoint and gets distinct visual treatment.

Overlapping events remain individually visible/selectable. Same-time events preserve `.scene` order.

Provide next-event, previous-event, selected-event-start navigation. When supported by the engine, seeking while paused reconstructs the correct state at that simulation time.

## Event inspector

Show:

- event type;
- target;
- `at`;
- `for`;
- `where`;
- `set` fields/values;
- affected-node preview;
- validation diagnostics.

Only fields permitted by the corresponding `.event` definition may be shown/editable.

## Target pickers

Components: name, type, or supported combined selector; browse hierarchy.

Connections: source/type/target; use simulation connection topology.

External: weather/network/supplies.

Generate only valid DSL references.

## Filter builder

Support only documented fields/operators. Component filters include `is_backup`, `status`, value fields, and supported connection references. Connection filters include type, source properties, target properties, status.

Show generated DSL and allow direct DSL editing.

## Set builder

Distinguish:

- fixed event-defined values;
- scene-editable fields;
- immutable fields.

`is_backup` is never editable. Values are canonicalized before serialization.

---

# Phase 26 — DSL Source Editor and Synchronization

Editor features:

- syntax highlighting;
- indentation;
- line numbers;
- validation markers;
- selected-event highlighting;
- timeline/source navigation;
- inspect corresponding `.event` definition.

Visual edits to event time, duration, target, filters, and configurable values update `.scene`.

Source edits update timeline only after successful parsing. Syntax errors preserve user text and show diagnostics; invalid text is never silently discarded.

Create round-trip tests:

```text
DSL -> AST -> visual model -> DSL
visual edit -> DSL -> AST -> visual model
```

No unsupported fields may be generated and event meaning must not change during conversion.

---

# Phase 27 — Simulation Monitor and Causal UI

Monitor must display actual current runtime state:

- station overview;
- component status summary;
- connection status summary;
- external conditions;
- important values;
- active events;
- upcoming events.

Use current runtime `component.json`, runtime connection state, and `external.json`.

## External conditions

Weather: temperature, wind speed, humidity, O2, CO2, wind direction, visibility, pressure, dew/frost point.

Network: bandwidth, mainland connectivity, upload window, upload speed, download speed.

Supplies: ETA, transport mode, description.

Event-driven changes must show current value, indicate event influence, and distinguish initial from current value.

## Causal distinction

Every important state change should identify whether it came from:

- scheduled scenario event;
- automatic backup activation;
- automatic activation/deactivation;
- resource demand/shortage;
- rating/tolerance violation;
- parent failure/inactivity;
- connection failure/inactivity;
- another simulation rule.

Do not require users to schedule automatic behavior.

## Backup display

Distinguish inactive, active, and explicitly event-activated backup. Automatic activation should expose its cause.

## Tolerance display

Show rating range, tolerance boundary/effective tolerance, current value, out-of-range condition, and actual failure separately.

## Active event stack

For each active event show type, target, start, finite end or infinite state, remaining duration, and affected fields/statuses. Selecting one highlights timeline and opens inspector. When multiple events affect one field, expose active stack ordering/effective value.

---

# Phase 28 — Simulation Log and Diagnostics

## Log

Record:

- event instantiation;
- event expiration;
- temporary restoration;
- infinite-state application;
- automatic status changes;
- backup activation;
- connection changes;
- rating/tolerance failures;
- resource shortages/deactivation;
- validation errors;
- simulation errors.

Each entry has simulation timestamp, description, affected node where applicable.

Clicking an entry can jump timeline, highlight Digital Twin target, open inspector, and identify responsible scheduled event.

Filters: event type, component, connection, severity.

Visually distinguish scheduled events, automatic changes, warnings, and errors.

## Validation

Validate before run:

- event definition exists;
- target syntax valid;
- target exists;
- `at`/`for` valid;
- `where` supported;
- `set` fields allowed;
- values valid;
- no unresolved references.

Diagnostics identify event + field/source location + problem. Warnings and errors are distinct. Errors prevent execution where required by the engine.

---

# Phase 29 — Digital Twin ↔ Scenario Integration

Reuse the Digital Twin 3D view in the Scenario page.

Selecting an event/log entry:

- highlights target in 3D;
- opens appropriate inspector;
- preserves station/scenario/run context.

Selecting a component/connection in 3D should expose events affecting it.

Navigation between Scenario and Digital Twin must preserve active scenario and simulation state.

---

# Phase 30 — Optional Scenario Comparison

Implement only after core behavior is stable.

Compare two scenarios using the same station configuration by:

- component statuses;
- connection statuses;
- component values;
- external conditions;
- event timing;
- automatic changes;
- errors/warnings.

Allow inspecting a difference and jumping to its component, connection, or timeline location. Never merge both simulation states into one ambiguous state.

---

# Phase 31 — 3D Geometry and Routing Engineering

## Layout

Deterministically:

1. build hierarchy tree;
2. place floors;
3. place containers;
4. place leaves;
5. compute bounding boxes;
6. expand containers to fit children;
7. place campus plane;
8. create suspended/lift visuals.

Same model input must produce the same layout.

## Interaction priority

Most-specific/deepest object under cursor wins. Hidden/non-interactable objects must not be hit targets.

## Visibility

Keep these independently controlled:

```text
component visibility
connection visibility
hierarchy subtree visibility
global hide components
global hide connections
```

## A* routing

Use a 3D occupancy grid/voxel graph. Penalize collision, leaving bounds, excessive length, and unnecessary turns. Enforce wall endpoints, staircase routing, four horizontal directions, floor transitions, and no unrelated component collision. Cache routes until topology/layout changes.

---

# Phase 32 — Persistence Architecture

Recommended logical database entities:

```text
Station
StationModel
Scenario
EventDefinition
SimulationRun
TelemetryRecord
TelemetryComponentState
TelemetryConnectionState
TelemetryExternalField
```

Every telemetry record independently answers:

```text
station/model?
source?
run?
simulation time?
persistence time?
component state/value/status?
connection status?
external state?
```

Historical records are immutable. Runtime changes must never mutate history.

---

# Phase 33 — Test Strategy

## Parser/compiler

Test every DSL for valid syntax, invalid syntax, source locations, nesting, defaults, inheritance, units, and golden JSON output.

## Cross-file validation

Test duplicate names, invalid parents, invalid floors, missing/wrong backups, self-connections, invalid sensor topology, invalid controller/alarm topology, missing sensor coverage, and invalid external references.

## Unit conversion

Test every accepted/canonical unit pair and boundaries.

## Simulation formulas

Every formula needs nominal, boundary, zero where meaningful, max, tolerance, multi-tick, and unit-consistency tests.

## Generator

Test capacity increase, 35% cutoff, proportional allocation, priority shutdown, automatic activation, explicit inactive protection, startup deadlock, temperature, flow/power relationship.

## Pump

Test total flow, 30% cutoff, proportional allocation, priority, temperature, power/flow.

## Solar

Test zero/half/max irradiance and above-max clamp.

## Tank

Test consumption, non-negative volume, empty tank, multiple tanks, alternate supply.

## Antenna

Test 0, 1–19, 20+ active connections; frequency bounds; frequency excluded from resource calculations.

## AC

Test current equation, power, airflow, temperature convergence, reduced-power operation, absence of 30/35% cutoff.

## Containers

Test inner average, weighted AC contribution, external temperature, vent increase, 2°C AC target decrease, inner corrective response.

## Failure

Test exact `t_off`, countdown cancellation, and simulation-time dependence.

## Event stack

Test the A/B overlap example exactly.

## Determinism

Same station + initial state + scenario + tick count must produce the same state.

## Telemetry

Test one record/tick, run ID, source, simulation/persistence timestamps, complete snapshot, disabled publishing, and stopping publishing without stopping simulation.

---

# Phase 34 — Frontend Tests

Test:

- navigation and station context;
- theme;
- cards/inspectors/statuses;
- hierarchy interaction;
- 3D selection/hover/occlusion;
- visibility controls;
- floor filtering;
- connection buses;
- lighting modes;
- Connections graph;
- zoom/pan and 3.5× zoom-out limit;
- scenario create/duplicate/delete;
- timeline add/move/resize/infinite/overlap;
- target/filter/set builders;
- validation;
- source round-trip;
- monitor/log/diagnostics;
- telemetry controls.

---

# Phase 35 — End-to-End Acceptance Scenarios

## A. Generator failure

Load model -> validate -> run -> schedule generator failure -> reach event -> verify failure -> verify backup -> verify log -> verify Digital Twin -> publish telemetry -> verify History.

## B. Sensor chain

Create invalid sensor topology -> compiler/validator rejects it with precise diagnostics.

## C. Generator shortage

Demand > capacity -> generator increases -> >=35% proportional allocation -> <35% priority shutdown/activation behavior -> explicit inactive not overridden.

## D. Pump shortage

Verify exact 30% behavior.

## E. Thermal response

Overheat container -> vent increase -> AC target decreases by 2°C when vents maxed -> inner controls -> no immediate container failure.

## F. Overlapping events

Two events modify same field with different durations -> verify exact stack unwinding.

## G. Infinite event

`for=inf` -> underlying state replacement -> temporary layers removed -> no arbitrary endpoint -> field mutable subject to event restrictions.

## H. Playback speed

Run same scenario at multiple speeds -> same event timestamps/order/final state; only wall-clock duration differs.

## I. History reconstruction

Run same scenario twice -> unique run IDs -> run A excludes run B -> history comes from DB, not current state.

## J. No telemetry

No telemetry -> static Digital Twin still renders -> dynamic current values say unavailable, never fabricated.

---

# Phase 36 — Performance and Reliability

## Simulation

Keep core independent of UI. Avoid repeated full-state serialization. Telemetry persistence may be asynchronous if it cannot affect deterministic simulation ordering. State streaming must not mutate simulation semantics.

## Frontend

Memoize 3D geometry, cache meshes by type/spec, cache routes, virtualize large lists, and avoid rerendering the full 3D scene for one state change.

## Database

Index time/run/source/component/connection dimensions and paginate historical queries.

---

# Phase 37 — Security and Integrity

Never trust frontend-generated DSL. Reparse and validate on the backend.

Never evaluate `where` as arbitrary code.

Never silently rewrite malformed source.

Where project-level auditing is required, record scenario edits, simulation lifecycle, telemetry publishing state, and source edits.

---

# Phase 38 — Deployment and Operations

Recommended services:

```text
web
api
simulator-worker
postgres
```

Optional broker/Redis only if needed for multi-worker coordination.

CI order:

1. format;
2. typecheck;
3. lint;
4. unit tests;
5. parser/compiler golden tests;
6. simulation determinism tests;
7. API integration tests;
8. frontend tests;
9. production build;
10. database migration checks.

Operational logs should cover simulation lifecycle, validation failures, telemetry persistence failures, parser errors, and connection issues. Keep operational logs separate from user-facing simulation logs.

---

# Phase 39 — Documentation

Create:

```text
docs/architecture.md
docs/twin-dsl.md
docs/scenario-dsl.md
docs/simulation-engine.md
docs/simulation-formulas.md
docs/telemetry.md
docs/frontend.md
docs/api.md
docs/testing.md
docs/deployment.md
```

The formula document must include every formula and human-readable interpretation. Explicitly document:

```text
component.json = current runtime state
simulation connection.json = current runtime connection state
external.json = current runtime external conditions
telemetry database = persisted history
```

---

# Phase 40 — Final Integration Checklist

## Twin DSL

- [ ] Hierarchy parser/compiler.
- [ ] All container types.
- [ ] All internal/leaf types.
- [ ] Priority/tags/backup/external references.
- [ ] Global uniqueness.
- [ ] Hierarchy JSON.
- [ ] Connection parser/compiler.
- [ ] Four connection types.
- [ ] All connection validation rules.
- [ ] Spec parser/compiler.
- [ ] All supplied defaults.
- [ ] CSS-like inheritance.
- [ ] Canonical units.
- [ ] Resolved spec for every component.
- [ ] Mandatory sensor coverage.

## Runtime

- [ ] External model.
- [ ] Component runtime model.
- [ ] Runtime connection model.
- [ ] Canonical values.
- [ ] Status enums.

## Scenario DSL

- [ ] Scene parser.
- [ ] Event parser.
- [ ] Component selectors.
- [ ] Connection selectors.
- [ ] External selectors.
- [ ] `where`.
- [ ] `set`.
- [ ] Immutable `is_backup`.
- [ ] Infinite events.
- [ ] Stable ordering.
- [ ] Event stack/reversion.

## Simulation

- [ ] 15-second tick.
- [ ] 1-hour simulation unit.
- [ ] 240 ticks/hour.
- [ ] Playback independence.
- [ ] Failure model.
- [ ] Power precedence.
- [ ] Multi-supply allocation.
- [ ] Backup.
- [ ] Controllers.
- [ ] Automatic resource activation/deactivation.
- [ ] Hierarchical status propagation.
- [ ] Missing-data extrapolation.
- [ ] Generator.
- [ ] Pump.
- [ ] Solar panel.
- [ ] Tank.
- [ ] Antenna.
- [ ] Server.
- [ ] Alarm.
- [ ] Air conditioner.
- [ ] Vent.
- [ ] Containers.
- [ ] Station.

## Telemetry

- [ ] Optional publishing.
- [ ] One record/tick while publishing.
- [ ] Run IDs.
- [ ] Simulation and persistence timestamps.
- [ ] Source indicator.
- [ ] Complete state snapshot.
- [ ] Historical immutability.
- [ ] Run reconstruction.

## Frontend

- [ ] Global navigation/context/theme.
- [ ] Overview.
- [ ] Digital Twin.
- [ ] Components.
- [ ] Connections.
- [ ] History and Diagnostics.
- [ ] Scenario/Simulation.
- [ ] Inspectors.
- [ ] Status semantics.
- [ ] Procedural 3D.
- [ ] 3D routing.
- [ ] Buses.
- [ ] Hover/selection.
- [ ] Timeline.
- [ ] Event library.
- [ ] Event inspector.
- [ ] Target picker.
- [ ] Filter builder.
- [ ] Set builder.
- [ ] Source editor.
- [ ] Simulation monitor.
- [ ] Simulation log.
- [ ] Diagnostics.
- [ ] Telemetry publishing.
- [ ] Scenario comparison if enabled.

---

# Phase 41 — Recommended Antigravity Execution Order

Use this order to minimize rework.

## Sprint 1 — Domain

1. Repository skeleton.
2. Shared models/enums.
3. Unit conversion.
4. Hierarchy model.
5. Connection model.
6. Spec model.

## Sprint 2 — Compiler

7. Hierarchy parser/compiler.
8. Connection parser/compiler.
9. Spec parser/compiler.
10. Cross-file validation.
11. Golden fixtures.

## Sprint 3 — Runtime

12. Component runtime model.
13. Runtime connection model.
14. External model.
15. Initial-state validation.

## Sprint 4 — Scenario DSL

16. Event parser.
17. Scene parser.
18. Selector AST.
19. `where` evaluator.
20. `set` semantics.
21. Event stack.

## Sprint 5 — Simulation

22. Simulation clock.
23. Deterministic tick loop.
24. Failure model.
25. Resource allocation.
26. Backup.
27. Hierarchical propagation.
28. Missing data.
29. All component behaviors.
30. Determinism tests.

## Sprint 6 — Persistence/API

31. Database schema.
32. Telemetry persistence.
33. Simulation run lifecycle.
34. REST API.
35. State streaming.
36. History queries.

## Sprint 7 — Frontend foundation

37. App shell/navigation.
38. Station context.
39. Shared inspectors/status components.
40. Overview.
41. Components.
42. Connections.

## Sprint 8 — Digital Twin

43. Hierarchy layout.
44. Procedural geometry.
45. Floor/lift rendering.
46. Connection routing.
47. Buses.
48. Hover/selection.
49. Telemetry integration.

## Sprint 9 — History

50. Filters.
51. Timeline.
52. Record table.
53. Component history.
54. Connection history.
55. External history.
56. Run reconstruction.

## Sprint 10 — Scenario editor

57. Scenario library.
58. Event library.
59. Timeline.
60. Inspector.
61. Target picker.
62. `where` builder.
63. `set` builder.
64. Source editor.
65. Bidirectional synchronization.

## Sprint 11 — Simulation workspace

66. Initial state editor.
67. Playback controls.
68. Simulation monitor.
69. Active event stack.
70. Log.
71. Diagnostics.
72. Telemetry controls.

## Sprint 12 — Integration

73. Digital Twin ↔ Scenario navigation.
74. End-to-end scenarios.
75. Performance.
76. Deployment.
77. Documentation.
78. Final acceptance checklist.

---

# Phase 42 — Definition of Done

A phase is complete only when:

1. behavior is implemented;
2. automated tests cover it;
3. invalid inputs fail predictably;
4. authoritative DSL semantics are preserved;
5. compiled model data is used instead of hardcoded demos;
6. runtime state is separate from historical telemetry;
7. simulation time is separate from wall-clock time;
8. visual editing cannot generate unsupported DSL;
9. source editing cannot silently lose user text;
10. cross-page context/selection is preserved;
11. diagnostics identify the source of invalid configuration;
12. deterministic behavior is tested where required.

---

# Phase 43 — Critical Invariants

Encode these as assertions/tests wherever practical:

```text
1. Component names are globally unique.
2. hierarchy.json contains every declared component exactly once.
3. spec.json resolves every hierarchy component.
4. Runtime component values are canonical.
5. Sensor coverage exists for every required rating measurement.
6. Floor components never participate in connections.
7. Sensor connections are data-only and form the required Component -> Sensor -> Antenna chain.
8. Controller connections are signal-only.
9. Alarm has exactly one incoming signal and no outgoing connection.
10. Runtime connection JSON has status and not relation.
11. Every simulation tick represents 15 simulation seconds.
12. Playback speed never changes event timestamps/durations/order.
13. Equal-time events preserve scene source order.
14. Finite event changes restore through event-stack semantics.
15. Infinite set events modify underlying state as specified.
16. is_backup cannot be modified through set.
17. Explicit power overrides V×I.
18. Failure countdown uses simulation time.
19. Containers attempt thermal correction before ordinary failure.
20. component.json is runtime state, not history.
21. Runtime connection.json is runtime state, not history.
22. Telemetry DB is historical state.
23. Simulation telemetry has a unique run ID.
24. History queries use persisted telemetry.
25. Digital Twin static structure comes from compiled model data.
26. Digital Twin dynamic state comes from latest telemetry when available.
27. No telemetry means unavailable, never fabricated current values.
28. Visual scenario editing is a constrained representation of DSL semantics.
29. Invalid source edits are preserved and diagnosed.
30. Simulation continues independently of telemetry publishing.
```

---

# Phase 44 — Final Architectural Mental Model

```text
                    AUTHORITATIVE MODEL
┌─────────────────────────────────────────────────────────┐
│ hierarchy.twin                                          │
│ connection.twin                                         │
│ spec.twin                                                │
└───────────────────────────┬─────────────────────────────┘
                            │ compile + validate
                            ▼
┌─────────────────────────────────────────────────────────┐
│ hierarchy.json                                           │
│ compiled connection.json                                 │
│ resolved spec.json                                       │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       STATIC DIGITAL TWIN          SIMULATION INITIALIZATION
              │                           │
              │                    component.json
              │                    simulation connection.json
              │                    external.json
              │                           │
              │                    + .scene + .event
              │                           │
              │                           ▼
              │                    ┌───────────────┐
              │                    │ SIMULATION    │
              │                    │ ENGINE        │
              │                    └───────┬───────┘
              │                            │
              │                 runtime state / ticks
              │                            │
              │               ┌────────────┴────────────┐
              │               ▼                         ▼
              │       Simulation Monitor          Telemetry
              │                                         │
              ▼                                         ▼
      Digital Twin 3D                           Telemetry DB
                                                        │
                                                        ▼
                                             History & Diagnostics
```

The essential separation is:

```text
MODEL
  = what the station is

RUNTIME
  = what the station is doing now in this execution

SCENARIO
  = what the user schedules

EVENT DEFINITION
  = what a reusable scheduled operation is allowed to do

SIMULATION ENGINE
  = what happens as scheduled events + automatic rules interact

TELEMETRY
  = persisted historical snapshots of runtime state

FRONTEND
  = visual/editor/inspection layer over those authoritative systems
```

If a frontend convenience conflicts with DSL or simulation semantics, DSL/simulation semantics win. If a current runtime view conflicts with historical telemetry, the selected persisted record wins on History. If the visual editor cannot represent a construct exactly, expose the source representation instead of inventing new semantics.
