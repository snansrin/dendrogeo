"""Read-only sensitivity and design diagnostics; never replaces production MC.

First-order derivatives of the frozen power equation are used for measurement
and density sensitivity. These standard deviations are NOT a new MC interval.
Sampling inference is available only for an explicitly declared complete SRS
of individual trees from a known finite frame (IPCC 2019, vol. 1, ch. 3).
"""
import json
import math
import sys
from reference import calculate_rows, positive


def nonnegative(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError(f"{label}: a finite nonnegative number is required")
    return float(value)


def sampling_component(rows, calculated, design):
    if not design:
        return {"status": "not_estimated", "reason": "no supported probability design supplied"}
    if (design.get("type") != "srs_without_replacement" or design.get("unit") != "tree"
            or design.get("equal_probability") is not True or design.get("complete_response") is not True
            or not str(design.get("sampling_frame", "")).strip()):
        raise ValueError("Sampling requires an explicit equal-probability, complete-response tree SRS and frame")
    population = design.get("population_size")
    n = len(rows)
    if isinstance(population, bool) or not isinstance(population, int) or population < n or n < 2:
        raise ValueError("SRS requires integer population_size >= n and at least two sampled trees")
    identifiers = [row.get("id") for row in rows]
    if any(not isinstance(i, str) or not i.strip() for i in identifiers) or len(set(identifiers)) != n:
        raise ValueError("SRS requires unique nonempty string tree ids")
    values = [r["total_carbon"] for r in calculated]
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / (n - 1)
    total_variance = population ** 2 * (1 - n / population) * variance / n
    return {"status": "conditional_design_estimate", "target": "sampling-frame total, kg C",
            "n": n, "population_size": population, "estimated_frame_total_kg_c": population * mean,
            "std_kg_c": math.sqrt(total_variance), "frame": design["sampling_frame"],
            "limitations": "researcher-declared design; excludes measurement, density and model errors"}


def diagnose(payload):
    rows = payload["rows"]
    calculated = calculate_rows(rows)
    settings = payload.get("settings", {})
    girth_sd = nonnegative(settings.get("girth_sd_cm", 0.5), "girth_sd_cm")
    height_sd = nonnegative(settings.get("height_sd_m", 0.25), "height_sd_m")
    model_cv = nonnegative(settings.get("model_cv", 0.22), "model_cv")
    carbon = [r["total_carbon"] for r in calculated]
    measurement_variance = sum((2 * 0.976 * c / row["girth_cm"] * girth_sd) ** 2
                               + (0.976 * c / row["height_m"] * height_sd) ** 2
                               for c, row in zip(carbon, rows))
    density = {"status": "not_estimated", "reason": "no empirical density CV supplied"}
    if settings.get("density_cv") is not None:
        cv = nonnegative(settings["density_cv"], "density_cv")
        correlation = settings.get("density_correlation")
        terms = [0.976 * c * cv for c in carbon]
        if correlation not in ("independent", "shared"):
            raise ValueError("Explicit density_correlation must be independent or shared")
        density = {"status": "user_supplied_sensitivity", "std_kg_c": math.sqrt(sum(t*t for t in terms))
                   if correlation == "independent" else sum(terms), "cv": cv, "correlation": correlation}
    return {"schema": "dendrogeo-uncertainty-diagnostic/1", "production_results_modified": False,
            "target": "sum of supplied trees, kg C (except the separate sampling component)",
            "method": "first-order sensitivity; not a replacement confidence interval",
            "assumed_settings": {"girth_sd_cm": girth_sd, "height_sd_m": height_sd, "model_cv": model_cv},
            "measurement": {"std_kg_c": math.sqrt(measurement_variance), "correlation": "independent inputs and trees"},
            "density": density, "model": {"std_kg_c": sum(carbon) * model_cv, "correlation": "shared across trees"},
            "sampling": sampling_component(rows, calculated, payload.get("sampling_design")),
            "density_assignments": {key: sum(r["density_source"] == key for r in calculated)
                                    for key in ("species", "group")},
            "limitation": "components have distinct assumptions and targets; they are not combined into a total interval"}


if __name__ == "__main__":
    try:
        print(json.dumps(diagnose(json.load(sys.stdin)), allow_nan=False))
    except (ValueError, TypeError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
