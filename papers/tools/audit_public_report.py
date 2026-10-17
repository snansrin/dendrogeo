"""Read-only checks of a frozen public DGR package for manuscript preparation.

No database, network, publication, relicensing, or report-file writes occur.
Run from the repository root; output is an editorial evidence file, not a
certificate of ecological accuracy or journal acceptance.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path


def audit(report_dir):
    report_dir = Path(report_dir)
    load = lambda name: json.loads((report_dir / name).read_text(encoding="utf-8"))
    manifest, meta, data = (load(n) for n in ("manifest.json", "metadata.json", "data.json"))
    errors, warnings, verified = [], [], []
    if manifest["report_id"] != report_dir.name or meta["identifier"] != report_dir.name:
        errors.append("Report identifiers disagree")
    if manifest["result_hash"] != meta["resultHash"]:
        errors.append("Manifest and metadata result hashes disagree")
    names = set()
    for item in manifest["files"]:
        name = item["name"]
        if Path(name).name != name or name in names:
            errors.append("Unsafe or duplicate manifest filename")
            continue
        names.add(name)
        path = report_dir / name
        actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
        if actual != item["sha256"]:
            errors.append("File hash mismatch: " + name)
        else:
            verified.append({"name": name, "bytes": path.stat().st_size, "sha256": actual})
    rows = data["rows"]
    csv_path = report_dir / "olcum.csv"
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        csv_rows = list(csv.DictReader(handle))
    if len(rows) != meta["sampleSize"] or len(csv_rows) != len(rows):
        errors.append("JSON, metadata and CSV record counts disagree")
    for field in ("id", "point_id"):
        if len({row[field] for row in rows}) != len(rows):
            errors.append("Duplicate " + field)
    residuals = []
    for row in rows:
        for field in ("girth_cm", "dbh_cm", "height_m"):
            if not isinstance(row.get(field), (int, float)) or not math.isfinite(row[field]) or row[field] <= 0:
                errors.append("Invalid positive measurement: " + field)
        if not (-90 <= row["lat"] <= 90 and -180 <= row["lon"] <= 180):
            errors.append("Invalid geographic coordinates")
        if not math.isfinite(row["carbon_kg"]) or row["carbon_kg"] < 0:
            errors.append("Invalid carbon estimate")
        residuals.append(abs(row["dbh_cm"] - row["girth_cm"] / math.pi))
    if max(residuals, default=0) > 1e-8:
        errors.append("DBH is inconsistent with girth / pi")
    if {int(row["NOKTA"]) for row in csv_rows} != {row["point_id"] for row in rows}:
        errors.append("CSV and JSON point identifiers disagree")
    geometry_files = {}
    for name in ("park.geojson", "surface.geojson"):
        geo = load(name)
        features = geo.get("features", [])
        rings, points = 0, 0
        if geo.get("type") != "FeatureCollection" or not features:
            errors.append("Missing GeoJSON FeatureCollection: " + name)
        for feature in features:
            geom = feature.get("geometry") or {}
            if geom.get("type") == "Point":
                points += 1
                xy = geom.get("coordinates", [])
                if len(xy) < 2 or not (-180 <= xy[0] <= 180 and -90 <= xy[1] <= 90):
                    errors.append("Invalid GeoJSON point: " + name)
                continue
            polygons = [geom.get("coordinates", [])] if geom.get("type") == "Polygon" else geom.get("coordinates", [])
            if geom.get("type") not in ("Polygon", "MultiPolygon"):
                errors.append("Unsupported geometry: " + name)
                continue
            for polygon in polygons:
                for ring in polygon:
                    rings += 1
                    if len(ring) < 4 or ring[0] != ring[-1]:
                        errors.append("Unclosed/short ring: " + name)
                    if any(len(p) < 2 or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90) for p in ring):
                        errors.append("Invalid GeoJSON coordinates: " + name)
        geometry_files[name] = {"features": len(features), "point_features": points, "rings": rings}
    missing_acc = sum(r.get("acc_m") is None for r in rows)
    warnings.extend([
        "These checks do not establish sampling representativeness or field accuracy.",
        "The source QA label is an internal report status, not independent ground truth.",
        "Revisions 0024, 0025 and 0026 are not independent surveys.",
        "Pantropical allometry is not locally calibrated for Ankara urban trees.",
    ])
    previous_revisions = []
    for revision in ("DGR-2026-0024", "DGR-2026-0025"):
        path = report_dir.parent / revision / "olcum.csv"
        if path.exists():
            previous_revisions.append({"report": revision, "same_measurement_csv": hashlib.sha256(path.read_bytes()).hexdigest() == hashlib.sha256(csv_path.read_bytes()).hexdigest()})
    return {
        "schema": "dendrogeo-manuscript-evidence/1",
        "source_report": report_dir.name,
        "source_doi": meta.get("doi"),
        "source_generated_at": data["generated_at"],
        "source_code_commit": data["provenance"].get("git_commit"),
        "source_license": meta["license"],
        "integrity_passed": not errors,
        "errors": errors,
        "verified_artifacts": verified,
        "records": len(rows),
        "csv_records": len(csv_rows),
        "period": data["period"],
        "gps_accuracy_present": len(rows) - missing_acc,
        "gps_accuracy_missing": missing_acc,
        "max_dbh_formula_residual_cm": max(residuals, default=0),
        "geometry_structure": geometry_files,
        "boundary_location": "data.json: lulc.review.outer and lulc.review.holes; latitude-longitude pairs",
        "geojson_coordinate_order": "longitude-latitude; the EPSG:32636 metadata describes analysis, not these stored geographic coordinates",
        "reported_geofence_outside": data["geofence"]["outside_rows"],
        "reported_qa": meta["qaState"],
        "reported_density_lookup": data["qa"]["species"]["dev_rho"],
        "satellite_scene_ids": [s["id"] for s in data["lulc"]["review"].get("scenes", [])],
        "revision_deduplication": previous_revisions,
        "limitations": warnings,
        "missing_source_protocol": [field for field in ("sampling", "instruments") if not data.get("study", {}).get(field)],
        "journal_submission_ready": False,
        "readiness_note": "Author declarations, journal eligibility, data licensing, deposit scope and field-method confirmation require separate review. File integrity is not submission approval.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report_dir", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = audit(args.report_dir)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8", newline="\n")
    print(json.dumps({"report": result["source_report"], "integrity_passed": result["integrity_passed"], "verified_files": len(result["verified_artifacts"]), "records": result["records"], "errors": result["errors"]}, ensure_ascii=False))
    return 0 if result["integrity_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
