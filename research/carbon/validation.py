"""Paired measurement and local AGB evaluation, with no model fitting/writes."""
import json
import math
import sys
from reference import calculate, positive


def metrics(pairs):
    if not pairs:
        raise ValueError("At least one independently paired reference is required")
    errors = [predicted - observed for predicted, observed in pairs]
    return {"n": len(pairs), "bias": sum(errors) / len(errors),
            "mae": sum(abs(e) for e in errors) / len(errors),
            "rmse": math.sqrt(sum(e*e for e in errors) / len(errors))}


def unique_pairs(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError("Nonempty matched rows are required")
    ids = [r.get("id") for r in rows]
    if any(not isinstance(i, str) or not i.strip() for i in ids) or len(set(ids)) != len(ids):
        raise ValueError("Pairs require unique nonempty string tree ids")


def evaluate_local(rows):
    unique_pairs(rows)
    pairs, groups = [], {}
    for row in rows:
        if row.get("independent") is not True or not str(row.get("reference_source", "")).strip():
            raise ValueError("Each AGB reference requires independent=true and a documented source")
        kind = row.get("reference_kind")
        if kind not in ("measured_dry_agb", "independent_structural_estimate"):
            raise ValueError("Declare measured dry AGB or an independent structural estimate; not another allometric output")
        reference = positive(row.get("reference_agb_kg"), "reference_agb_kg")
        prediction = calculate(row)["agb"]
        pair = (prediction, reference)
        pairs.append(pair)
        # Preserve heterogeneous reference methods rather than pooling silently.
        groups.setdefault(kind + ":" + row["grp"], []).append(pair)
    return {"schema": "dendrogeo-local-agb-evaluation/1", "units": "kg oven-dry AGB",
            "overall": metrics(pairs), "groups": {k: metrics(v) for k, v in groups.items()},
            "status": "descriptive paired comparison; no automatic validated/pass designation",
            "limitations": "reference uncertainty, representativeness, species and size coverage require investigator review",
            "production_equation_modified": False}


def evaluate_repeats(rows):
    unique_pairs(rows)
    result = {}
    for field, unit in (("girth_cm", "cm"), ("height_m", "m")):
        pairs = [(positive(r["repeat"][field], field), positive(r["initial"][field], field)) for r in rows]
        summary = metrics(pairs)
        summary.update(unit=unit, technical_error_of_measurement=math.sqrt(
            sum((a-b)**2 for a, b in pairs) / (2 * len(pairs))))
        result[field] = summary
    return {"schema": "dendrogeo-repeat-measurement-evaluation/1", "metrics": result,
            "limitations": "paired differences only; dates, observer independence and instrument checks must be documented; temporal growth can confound repeat error",
            "production_measurements_modified": False}


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        if payload.get("mode") not in ("local_agb", "repeat_measurements"):
            raise ValueError("mode must be local_agb or repeat_measurements")
        result = evaluate_local(payload["rows"]) if payload["mode"] == "local_agb" else evaluate_repeats(payload["rows"])
        print(json.dumps(result, allow_nan=False))
    except (ValueError, TypeError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
