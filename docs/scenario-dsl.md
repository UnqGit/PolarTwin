# Scenario DSL

The Scenario DSL controls runtime behavior using `.scene` and `.event` files.

## Event Files (`.event`)
Event files define a reusable sequence of overrides.
```
where component="Generator 1" set is_active=false
```

## Scene Files (`.scene`)
Scene files sequence multiple `.event` payloads along a timeline to represent a full scenario.
```
at 0h0m0s do "Fail Generator"
at 2h30m0s do "Fail Generator" for 1h
```

## Semantics
The DSL uses LIFO (Last-In-First-Out) stacking for conflicting state targets. A temporary event (e.g., `for 1h`) pushes its payload to the state stack. Once the duration expires, the stack pops and restores the previous active state underneath it. Infinite events (`for=inf` or implicit bounds) override the baseline entirely.
