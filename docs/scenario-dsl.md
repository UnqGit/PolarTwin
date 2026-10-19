# PolarTwin Scenario & Event DSL Specification

This document provides the definitive, comprehensive specification for the PolarTwin Scenario Domain-Specific Language (DSL) family. The system uses two dedicated scripting formats:
- **`*.event` files**: Declarative, parameterized behavioral templates and fault injection definitions (analogous to function prototypes or contracts).
- **`*.scene` files**: Temporal orchestration scripts that instantiate and schedule events across a global simulation timeline.

Together with the structural Digital Twin (`hierarchy.twin`, `connection.twin`, `spec.twin`), they form a deterministic, mathematically verifiable digital twin of an Antarctic research facility.

---

## 1. Architecture: The Tripartite DSL Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STRUCTURAL TRUTH (Physical Model)                    │
│   hierarchy.twin          spec.twin               connection.twin      │
│   [Components & Trees]    [Ratings & Constraints] [Topological Graphs] │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Cross-Schema Validation
┌────────────────────────┐          │
│   *.event Definition   │◄─────────┤ Compiles & Type-Checks Schema
│  (Reusable Template)   │          │
└───────────┬────────────┘          │
            │ Instantiated by       │
┌───────────▼────────────┐          │
│    *.scene Scenario    │◄─────────┘
│ (Timeline Orchestrator)│
└───────────┬────────────┘
            │ Compiles into Sorted SceneEvent AST
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   DETERMINISTIC SIMULATION ENGINE                      │
│   TimelineStateManager (LIFO Stack) ──► Effective State Recalculation  │
│   Active Layers (Temporary events) ──► Automatic Temporal Unwinding    │
│   Base State (Nominal + Infinite for=inf overrides)                    │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Station Truth**: `hierarchy.twin` defines the containment topology; `spec.twin` defines component operational limits, baseline ratings, and sensor telemetry bindings; `connection.twin` specifies directional power, fluid, and data routing.
2. **Behavioral Templates (`*.event`)**: Specify *what* can be altered, *which* entities are eligible, and *what conditions* must be met.
3. **Temporal Scenarios (`*.scene`)**: Specify *when* (`at`), *for how long* (`for`), *which instance* (`@selector`), and *with what parameters* (`set { ... }`).

---

## 2. Event Definition Files (`*.event`)

An `.event` file defines a parameterized mutation rule. It consists of three clauses in strict order:
1. `target <target-kind>` (Mandatory)
2. `where <condition>` (Optional, chainable with `&`)
3. `set <mutations>` (Mandatory)

Comments begin with `#` and are ignored by the compiler, except when embedded within quoted strings.

### 2.1 Target Taxonomy

The `target` clause specifies the architectural domain and granularity of the event. The compiler enforces strict validation per the table below:

| Target Syntax | Target Kind Constant | Description & Resolution Rules | Scene Selector Syntax |
| :--- | :--- | :--- | :--- |
| `target @component.name` | `component.name` | Matches an exact component name. Fails if selector does not match a declared component. | `@Generator1`, `@TankMain` |
| `target @component.type` | `component.type` | Matches **all** components of the given type simultaneously. | `@generator`, `@pump` |
| `target @component.type \| @component.name` | `component.any` | Combined fallback: First attempts to match by exact component name; if not found, matches by component type. | `@Generator1` OR `@generator` |
| `target @connection` | `connection` | Targets connections via a full 3-part tuple selector: `(source\|type\|target)`. Wildcards allowed. | `@(Gen1\|power\|BusA)`, `@(\|data\|)` |
| `target @connection.source` | `connection.source` | Filters connections whose source component matches the selector. | `@Generator1` |
| `target @connection.target` | `connection.target` | Filters connections whose destination component matches the selector. | `@MainSwitchboard` |
| `target @connection.type` | `connection.type` | Filters connections of a specific medium (`power`, `fluid`, `data`, `signal`). | `@data`, `@fluid` |
| `target @connection.(f1 & f2)` | `connection.multi` | Multi-field connection selector. Requires exactly two distinct fields from `source`, `target`, `type`. | `@(Generator1\|power\|)` |
| `target @external` | `external` | Targets environmental or external subsystems. Scene selector specifies the group. | `@network`, `@weather`, `@supplies` |
| `target @external.network` | `external.network` | Targets satellite and WAN communications. **No scene selector required** (auto-synthesized). | *(Omitted)* or `@network` |
| `target @external.weather` | `external.weather` | Targets atmospheric model (ambient temperature, wind, irradiance). **No selector required**. | *(Omitted)* or `@weather` |
| `target @external.supplies` | `external.supplies` | Targets logistics and resupply pipelines. **No selector required**. | *(Omitted)* or `@supplies` |

> [!WARNING]
> Bare `target @component` is **syntactically invalid** and rejected by the compiler. You must specify `.name`, `.type`, or the combined `.type | .name`.

---

### 2.2 Where Clause & Relational AST Evaluator

The `where` clause filters candidate nodes before an event is applied. Conditions can be chained across multiple lines using the continuation prefix `&`:

```text
target @component.type
where type = "battery"
& status = "active"
& value.charge < 20.0
& is_backup = false
```

#### Supported Relational Operators
- Equality / Inequality: `=`, `!=`
- Numeric Comparisons: `<`, `<= `>`, `>=`
- String Literals: `"generator"`, `'active'`
- Boolean Literals: `true`, `false`
- Numeric Literals: `120`, `-45.5`

#### Graph-Aware Contextual Lookups
The evaluator parses cross-entity references at runtime using the station's topology:
1. **Component $\rightarrow$ Outgoing Connection**:
   `@connection(@node|data|)` evaluates whether the contextual component (`@node`) has an outgoing `data` connection.
2. **Component $\rightarrow$ Incoming Connection**:
   `@connection(MainController||@node)` evaluates whether the component receives any connection from `MainController`.
3. **Component $\rightarrow$ Typed Target**:
   `@connection(@node||@component.type=generator)` checks if the node connects to any component whose type is `generator`.
4. **Connection $\rightarrow$ Endpoint Components**:
   When targeting a connection, `@component(source).type=generator` or `@component(target).status=active` inspects the state of connected nodes.

---

### 2.3 Set Block: Mutation Schema & Strictness

The `set` block defines what fields the event modifies, which values are hardcoded, and which must be provided by the invoking scenario.

```text
target @component.name
set {
    status = failure               # 1. FIXED FIELD
    values.temperature             # 2. REQUIRED FIELD
    ?values.voltage.output         # 3. OPTIONAL FIELD
    fields                         # 4. OPEN-ENDED WILDCARD
}
```

#### Rules & Syntax Forms:
1. **Fixed Fields (`field = value`)**:
   - Hardcoded values applied whenever the event triggers.
   - The scene file **cannot** override this value; attempting to do so raises a compilation error.
   - Fixed fields **cannot** start with `?` (e.g. `?status=failure` is illegal).
2. **Required Fields (`field`)**:
   - Fields that the invoking `.scene` file **must** supply in its `set { ... }` block.
   - If omitted in the `.scene`, the compiler raises `Missing required field '<field>'`.
3. **Optional Fields (`?field`)**:
   - Fields that the invoking `.scene` file may optionally specify. If omitted, no mutation occurs on that field.
4. **The `fields` Keyword**:
   - Relaxes strict schema enforcement, allowing the scene file to pass arbitrary custom attributes without triggering unrecognized field errors.
5. **Component Status Constraints**:
   - The `status` attribute only accepts: `"active"`, `"inactive"`, `"failure"`. Any other string fails compilation.
6. **Immutability of `is_backup`**:
   - `is_backup` is hard-locked structural metadata. Setting `is_backup` in an `.event` or `.scene` file raises an immediate `SemanticError`.

---

## 3. Scenario Files (`*.scene`)

A `.scene` file sequences events along a continuous timeline. It treats `.event` files as callable functions with typed parameter payloads.

### 3.1 Event Invocation Syntax

```text
# Format:
event:<event_name> [@<selector>] at=<hours> for=<hours|inf> [set { <payload> }]
```

#### Example Single-Line Invocations:
```text
# Component failure starting at simulation hour 1.5, lasting 2.0 hours
event:generator_overheat @Generator1 at=1.5 for=2.0

# Permanent external weather shift at hour 0.0 (no selector required)
event:polar_blizzard at=0.0 for=inf

# Connection outage on all data links using wildcard selector
event:connection_sever @(|data|) at=3.0 for=0.5
```

#### Example Multi-Line Invocations with Payload:
```text
event:manual_override @HeaterPrimary at=2.0 for=1.5 set {
    values.temperature = 22.5
    status = active
}
```

#### Nested Payload Blocks:
The scene parser supports JSON-like nesting using braces:
```text
event:calibrate_sensor @TempSensor1 at=0.5 for=inf {
    set {
        value {
            calibration_offset = 0.45
            sampling_rate = 10
        }
    }
}
```

### 3.2 Time & Duration Semantics

- **Simulation Time (`at=<float>`)**: Specified in simulation hours from $T=0.0$.
- **Finite Duration (`for=<float>`)**: Specifies how long the event remains active before automatically expiring and unwinding.
- **Infinite Duration (`for=inf`)**: Overrides the base state permanently. Infinite events never pop off the stack.
- **Stable Timeline Ordering**: If two events have identical `at` timestamps, they execute strictly in the order they appear in the file (`source_order`).

---

## 4. Compiler Cross-Validation Pipeline

When an `.event` or `.scene` script is saved or validated via the API (`POST /scenarios/{id}/validate` or `POST /scenarios/parse`), it undergoes multi-stage validation against the active digital twin:

```
[Scene Script] ──► Parse Tokens ──► Link EventDefinition
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      ▼                                      ▼                                      ▼
[Target Binding]                       [Field Scoping]                       [Type Conformance]
Check against hierarchy.twin           Cross-check with spec.twin            Validate values against
Is @Generator1 declared?               Does 'temperature' belong to          rating schema (numeric vs
Is connection topological?             'state', 'input', or 'output'?        boolean, within range)
```

1. **Target Existence**: Verifies that `@Generator1` actually exists in the station's compiled `hierarchy.json`.
2. **Ambiguous Field Disambiguation**:
   If a component spec has `input.temperature` and `state.temperature`:
   - Setting `temperature = 80` produces: `Ambiguous field 'temperature'. It exists in scopes: input, state. Please specify scope.`
   - Setting `state.temperature = 80` passes validation.
3. **Type Constraints**: If a field is defined with numeric ratings (`min`, `max`, `unit`), non-numeric values are rejected.
4. **Contract Satisfaction**: Confirms that every field marked non-optional in `.event` is present in the `.scene` payload.

---

## 5. Runtime Execution & LIFO State Stacking

Simulation state management is governed by [`TimelineStateManager`](file:///c:/Users/VISHESH%20MEENA/OneDrive/Documents/Repositories/PolarTwin/src/twin_sim/dsl/event_stack.py#L20):

```
       TIME FLOW ────────────────────────────────────────────────────────►
       
       t = 0.0h                t = 1.0h                t = 2.5h
       ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
       │                  │    │ [Active Layer 1] │    │                  │
       │                  │    │ Temp = 125°C     │    │  LAYER EXPIRES   │
STACK: │                  │    │ Status = FAILURE │    │  (Popped & Gone) │
       ├──────────────────┤    ├──────────────────┤    ├──────────────────┤
       │ [Base State]     │    │ [Base State]     │    │ [Base State]     │
       │ Nominal (65°C)   │    │ Nominal (65°C)   │    │ Nominal (65°C)   │
       └──────────────────┘    └──────────────────┘    └──────────────────┘
       Effective: 65°C         Effective: 125°C        Effective: 65°C (UNWOUND!)
```

1. **Pushing Layers**: When an event triggers at `scene.at`, the engine creates an `EventLayer` recording `[event_id, start_time, end_time, node_key, field_path, value]`.
2. **Effective State Calculation**: Whenever the layer stack changes, `recalculate_effective_state()` rebuilds the runtime state by overlaying active layers in order of `(start_time, source_order)`.
3. **Automatic Unwinding**: At each simulation tick, `expire_events(current_time)` purges layers whose `end_time <= current_time`. The component automatically reverts to the baseline or preceding active layer.
4. **Infinite Override (`for=inf`)**: Infinite events bypass temporary stacking. They clear any conflicting active layers for that target field and write directly to `base_components` or `base_connections`.

---

## 6. End-to-End Practical Examples

### Example 1: Generator Thermal Runaway & Nominal Recovery

#### `thermal_runaway.event`
```text
# Reusable fault injection for diesel generators
target @component.type
where type = "generator"
& is_backup = false
set {
    status = failure
    values.temperature
    ?values.rpm
}
```

#### `operational_drill.scene`
```text
# Inject thermal runaway on Generator 1 at 1.0h for 2.0h
event:thermal_runaway @Generator1 at=1.0 for=2.0 set {
    values.temperature = 142.5
    values.rpm = 3600
}
```

### Example 2: Subzero Antarctic Blizzard

#### `antarctic_blizzard.event`
```text
# Extreme atmospheric injection
target @external.weather
set {
    temperature = -62.5
    wind_speed = 38.0
    irradiance = 0.0
    visibility = 250.0
}
```

#### `storm_scenario.scene`
```text
# Blizzard strikes at hour 5.0 and permanently alters the climate baseline
event:antarctic_blizzard at=5.0 for=inf
```

### Example 3: Targeted Sensor Network Severance

#### `sever_data_links.event`
```text
# Disables data telemetry routing
target @connection.type
where @component(target).type = "sensor"
set status = failure
```

#### `telemetry_blackout.scene`
```text
# Cuts all sensor data connections at hour 0.5 for 1 hour
event:sever_data_links @data at=0.5 for=1.0
```
