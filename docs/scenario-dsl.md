# Scenario DSL

The Scenario Domain-Specific Language (DSL) controls runtime behavior and fault injections using `.scene` and `.event` files. It compiles into an AST (Abstract Syntax Tree) executed by the Simulation Engine.

## Semantics and LIFO Stacking

> [!IMPORTANT]
> The DSL uses **LIFO (Last-In-First-Out) stacking** for conflicting state targets.
> A temporary event (e.g., `for=1h`) pushes its payload to the state stack. Once the duration expires, the stack pops and restores the previous active state underneath it. Infinite events (`for=inf`) never pop off and override the baseline entirely.

## 1. Event Files (`.event`)

Event files define reusable, granular overrides (like functions) targeting specific component attributes or system types.

### Targets
The `target` clause defines what this event acts upon. Valid targets include:
- `@component.name` or `@component.type`
- Combined component selectors: `@component.type | @component.name`
- Connections: `@connection`, `@connection.source`, `@connection.target`, `@connection.type`
- Multi-field connections: `@connection.(source & target)`
- Externals: `@external`, `@external.network`, `@external.weather`, `@external.supplies`

### Where Clauses
The `where` clause filters the target. You can chain multiple conditions using `&`.
```text
target @component.type
where type="battery"
& status="active"
```

### Set Blocks
The `set` block defines the payload and variables of the event. It can include:
- **Fixed fields**: Hardcoded values (`status=failure`)
- **Required fields**: Fields the scene file must provide (e.g., `values.temperature`)
- **Optional fields**: Prefixed with `?` (e.g., `?values.voltage`)
- **Open-ended fields**: Using the `fields` keyword allows scenes to pass arbitrary keys.

```text
target @component.type
where type="battery"
set {
    status=failure
    values.temperature
    ?values.voltage
    fields
}
```

## 2. Scene Files (`.scene`)

Scene files sequence multiple `.event` instances along a global timeline. They treat events as invokable functions.

### Syntax and Selectors
You invoke an event by its name, attach a selector (like a specific component name), a start time (`at`), and a duration (`for`).
The selector (e.g., `@Generator1`) resolves against the `where` filters of the event.

```text
event:fail_generator @Generator1 at=0.0 for=inf
```

### Overriding Variables (Set Block)
If an event defines required/optional fields, you pass them by opening a `set` block in the scene:
```text
event:set_component @Generator1 at=2.5 for=1.0 set {
    values.temperature = 120
    custom_field = "test"  # Allowed because of the 'fields' keyword
}
```

### The `inf` Keyword
Setting `for=inf` means the event duration is infinite. It pushes to the LIFO stack and never pops, effectively overriding the baseline simulation state permanently for the remainder of the scenario.

## 3. Execution & The Inspector

During simulation, events unfold chronologically based on their `at` time.
- **Unwinding**: When a temporary event's duration expires, it is removed from the LIFO stack. The component's state automatically unwinds and reverts to the state defined by the event beneath it (or the baseline).
- **Inspector Editing**: When the simulation is paused or running, the UI Inspector allows you to push ad-hoc events directly to the engine, utilizing the exact same LIFO stacking mechanism without writing DSL.
