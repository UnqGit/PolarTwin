# Twin DSL (Static Modeling)

The Twin Domain-Specific Language (DSL) strictly defines the static, physical properties of a station. It comprises three interconnected file extensions.

## 1. Hierarchy Definition (`hierarchy.twin`)
Defines the topological nesting and physical structure of the station. Uses a strict tab/indent-based structure to represent parent-child relationships (e.g., Campuses -> Buildings -> Rooms -> Racks -> Components).

**Example:**
```text
Station Alpha
    Power Block A
        Generator 1 (power_generator)
        Battery Bank 1 (battery_storage)
    Living Quarters
        HVAC Unit (thermal_regulator)
```

## 2. Connection Routing (`connection.twin`)
Defines logical and physical routing between components across the hierarchy.

**Example:**
```text
connect Power Block A.Generator 1 to Living Quarters.HVAC Unit (power_cable)
connect Comm Array.Dish to Core Switch (data_link)
```

## 3. Specifications (`spec.twin`)
Defines physical specs, tolerances, capacities, and I/O logic for generic component types or specific instances. Uses the `@` symbol for lifecycle ratings.

**Example:**
```text
type power_generator
    rating@output power 500kW
    rating@input fuel 10L/h
    tolerance@temperature -50C to 80C
```
