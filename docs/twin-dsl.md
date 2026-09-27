# Twin DSL

The Twin Domain-Specific Language (DSL) comprises three specific file extensions:
* `hierarchy.twin`
* `connection.twin`
* `spec.twin`

## hierarchy.twin
Defines the topological nesting of the station. Uses a tab/indent-based structure.
```
Station Alpha
    Power Block A
        Generator 1 (power_generator)
```

## connection.twin
Defines routing and connections between components. 
```
connect Power Block A.Generator 1 to Water Block.Pump 1 (power_cable)
```

## spec.twin
Defines physical specs, tolerances, and outputs for types or specific instances. Uses the `@` symbol for lifecycle ratings.
```
type power_generator
    rating@output power 500kW
```
