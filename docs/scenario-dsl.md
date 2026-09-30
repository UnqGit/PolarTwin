# Scenario DSL

The Scenario Domain-Specific Language (DSL) controls runtime behavior and fault injections using `.scene` and `.event` files. It compiles into an AST (Abstract Syntax Tree) executed by the Simulation Engine.

## Semantics and LIFO Stacking

> [!IMPORTANT]
> The DSL uses **LIFO (Last-In-First-Out) stacking** for conflicting state targets. 
> A temporary event (e.g., `for 1h`) pushes its payload to the state stack. Once the duration expires, the stack pops and restores the previous active state underneath it. Infinite events override the baseline entirely.

## Syntax Definitions

### Event Files (`.event`)
Event files define a reusable, granular override targeting specific component attributes.

**Syntax Example:**
```text
where component="Generator 1" set is_active=false
where type="battery" set charge_rate=0.5
```

### Scene Files (`.scene`)
Scene files sequence multiple `.event` payloads along a global timeline to represent a full scenario.

**Syntax Example:**
```text
at 0h0m0s do "Fail Generator"
at 2h30m0s do "Fail Generator" for 1h
at 4h0m0s do "Extreme Blizzard" for 12h
```

### Pipeline
1. **Parser**: The raw string is tokenized (handling regex pattern matching).
2. **AST**: Converted to internal Python dataclasses (`SceneEventData`).
3. **Scheduler**: Sorted chronologically in the engine.
4. **Execution**: Placed onto the `EventStack` at runtime.
