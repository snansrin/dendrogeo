"""Independent reference implementation. No production-code imports or writes.

Equation: Chave et al. (2014), doi:10.1111/gcb.12629.
Root ratio, carbon fraction and volume factor reproduce DendroGeo's fixed policy;
matching this calculation does not establish local ecological applicability.
"""
import json
import math
from pathlib import Path
import sys

POLICY_PATH = Path(__file__).with_name("density-policy-v1.json")


def positive(value, label):
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise ValueError(f"{label}: a finite numeric value is required")
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{label}: must be finite and positive")
    return float(value)


def load_policy():
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))


def calculate(row, policy=None):
    policy = policy or load_policy()
    species, group = row.get("species"), row.get("grp")
    if policy["species_groups"].get(species) != group or group not in policy["defaults_kg_m3"]:
        raise ValueError("Unknown species or inconsistent measurement group")
    girth = positive(row.get("girth_cm"), "girth_cm")
    height = positive(row.get("height_m"), "height_m")
    diameter = girth / math.pi
    if diameter > 400:
        raise ValueError("Derived diameter exceeds the locked protocol limit")
    specific = policy["species_kg_m3"].get(species)
    density = specific if specific is not None else policy["defaults_kg_m3"][group]
    agb = 0.0673 * ((density / 1000) * diameter ** 2 * height) ** 0.976
    roots = agb * 0.26
    biomass = agb + roots
    return {"dbh_cm": diameter, "density_kg_m3": density,
            "density_source": "species" if specific is not None else "group",
            "agb": agb, "bhb": roots, "bio": biomass, "c_agb": agb * 0.47,
            "c_bhb": roots * 0.47, "total_carbon": biomass * 0.47,
            "vol": math.pi * (diameter / 200) ** 2 * height * 0.5}


def calculate_rows(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError("A non-empty rows array is required")
    policy = load_policy()
    return [calculate(row, policy) for row in rows]


def main():
    # stdin and stdout only: callers choose any file paths/redirection explicitly.
    try:
        payload = json.load(sys.stdin)
        print(json.dumps({"schema": "dendrogeo-carbon-reference/1",
                          "scope": "arithmetic verification; not independent field validation",
                          "rows": calculate_rows(payload["rows"])}, allow_nan=False))
    except (ValueError, TypeError, KeyError) as error:
        print(str(error), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
