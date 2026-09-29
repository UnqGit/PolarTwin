def _update_field(c, field: str, new_val: float):
    obj = c.value.get(field)
    if isinstance(obj, dict):
        obj["value"] = new_val
    else:
        # Upgrade scalar to dict to preserve its value as max (since scalar acts as capacity in this engine)
        c.value[field] = {
            "value": new_val,
            "max": float(obj) if obj is not None else float("inf")
        }
