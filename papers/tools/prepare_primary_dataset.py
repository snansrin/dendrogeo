"""Stage only the rights-holder-authorized tree tables; never publish or relicense source files."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from audit_public_report import audit

OBS = [
    ("point_id", "point_id", "Local point identifier", "", "identifier"),
    ("species_label", "species", "Recorded Turkish tree label", "", "field label"),
    ("tree_group", "grp", "Recorded broadleaf or conifer group", "", "field label"),
    ("girth_cm", "girth_cm", "Circumference under the documented 1.30 m tape protocol", "cm", "observation"),
    ("height_m", "height_m", "Recorded tree height; source report records 0.1 m resolution", "m", "observation"),
    ("latitude", "lat", "Latitude recorded with civilian GNSS according to source report", "decimal degrees", "location"),
    ("longitude", "lon", "Longitude recorded with civilian GNSS according to source report", "decimal degrees", "location"),
    ("horizontal_accuracy_m", "acc_m", "Source-reported accuracy where present; blank is unknown", "m", "location metadata"),
    ("record_date", "date", "Date stored in the public source row", "YYYY-MM-DD", "record metadata"),
]
DERIVED = [
    ("point_id", "point_id", "Join key to tree-observations.csv", "", "identifier"),
    ("dbh_cm", "dbh_cm", "Full-precision stored diameter derived as girth divided by pi", "cm", "derived"),
    ("carbon_kg", "carbon_kg", "Stored allometric carbon estimate; not a direct measurement", "kg C", "derived"),
    ("volume_m3", "volume_m3", "Stored volume estimate using a fixed form factor", "m3", "derived"),
]


def stage(source, output):
    source, output = Path(source), Path(output)
    evidence = audit(source)
    if not evidence["integrity_passed"]:
        raise ValueError("Source package failed integrity checks")
    data = json.loads((source / "data.json").read_text(encoding="utf-8"))
    output.mkdir(parents=True, exist_ok=True)
    for filename, columns in [("tree-observations.csv", OBS), ("derived-estimates.csv", DERIVED)]:
        with (output / filename).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle, lineterminator="\n")
            writer.writerow([col[0] for col in columns])
            writer.writerows([[row.get(col[1]) for col in columns] for row in data["rows"]])
    with (output / "data-dictionary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["table", "field", "source_json_field", "definition", "unit", "kind"])
        for table, columns in [("tree-observations.csv", OBS), ("derived-estimates.csv", DERIVED)]:
            writer.writerows([[table, col[0], "rows[]." + col[1], *col[2:]] for col in columns])
    metadata = {
        "title": "Georeferenced tree measurements for Goksu Park in Ankara September to October 2026 snapshot",
        "version": "0.1.0-author-review",
        "publication_status": "local deposit candidate; not submitted or deposited",
        "doi": None,
        "rights_holder_authorization": {
            "date": "2026-10-17", "license": "CC-BY-4.0",
            "scope": "New tables derived from rights-holder-owned field observations and estimates only",
            "source_report_unchanged": True,
        },
        "license": {"id": "CC-BY-4.0", "url": "https://creativecommons.org/licenses/by/4.0/"},
        "proposed_creators": [
            {"name": "Nagihan Şirin", "orcid": "https://orcid.org/0009-0003-7372-0973", "country": "Türkiye", "email": "nagihan@dendrogeo.org", "affiliation": "Department of Landscape Architecture, Faculty of Agriculture, Ankara University", "role": "doctoral researcher", "authorship_agreement_reported": True},
            {"name": "Sinan Şirin", "orcid": "https://orcid.org/0009-0009-6303-5140", "country": "Türkiye", "email": "sinan@dendrogeo.org", "affiliation": "Independent software development for DendroGeo", "role": "system developer"},
        ],
        "author_order_affiliations_and_contributions_confirmed": False,
        "funding": "No external funding; supported through the authors own resources",
        "corresponding_author": {"name": "Sinan Şirin", "email": "sinan@dendrogeo.org"},
        "competing_interests": "No influencing relationships reported; Sinan Şirin is the platform developer",
        "source_report": evidence["source_report"], "source_report_doi": evidence["source_doi"],
        "source_snapshot_sha256": next(f["sha256"] for f in evidence["verified_artifacts"] if f["name"] == "data.json"),
        "source_report_orcid_note": "Authors supplied corrected ORCID ownership on 17 October 2026; the frozen source report is preserved unchanged.",
        "records": len(data["rows"]), "measurement_period": data["period"],
        "ongoing_collection": True,
        "coverage_note": "Fixed snapshot of 36 public records; Göksu fieldwork continues. This is not a complete park census.",
        "transformations": ["Select documented source fields", "Rename columns with explicit source mapping", "Separate observations and model outputs", "No filtering or taxonomic harmonization", "No numeric rerounding"],
        "excluded": ["photographs", "photo paths", "database row IDs", "OSM geometries", "reviewed surface geometries", "map imagery", "original report artifacts"],
        "pending": ["author institutions and declarations", "field instrument details beyond published protocol", "reviewer access and actual deposit identifier", "human manuscript approval"],
    }
    (output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    (output / "LICENSE.txt").write_text(
        "CC BY 4.0 applies to the newly staged tree-observations.csv, derived-estimates.csv, data-dictionary.csv and their new documentation only.\n"
        "Rights-holder authorization supplied 17 October 2026. Attribution, a link to the licence and indication of changes are required.\n"
        "Licence terms: https://creativecommons.org/licenses/by/4.0/\n"
        "Legal code: https://creativecommons.org/licenses/by/4.0/legalcode.en\n"
        "This does not relicense the original CC BY-NC report or any third-party imagery, maps or spatial databases.\n",
        encoding="utf-8", newline="\n")
    (output / "README.md").write_text(
        "# Göksu Park tree data deposit candidate\n\n"
        "This local author-review package contains a fixed snapshot of 36 public tree records from 28 September to 1 October 2026. Fieldwork is ongoing.\n\n"
        "tree-observations.csv contains field observations and location metadata. derived-estimates.csv contains the separately identified stored model outputs. Join on point_id. Blank horizontal_accuracy_m values are unknown, not zero. See data-dictionary.csv for source mappings.\n\n"
        "The source report is DGR-2026-0026, DOI 10.5281/zenodo.23404310. It remains unchanged under its original licence. The new, narrowly scoped tables have CC BY 4.0 rights-holder authorization; see LICENSE.txt. OSM-derived geometry, imagery and photographs are excluded.\n\n"
        "This is not a registered dataset deposit or journal submission. No dataset DOI exists yet. Confirm authorship, affiliations, methods and declarations before upload.\n",
        encoding="utf-8", newline="\n")
    filenames = ["tree-observations.csv", "derived-estimates.csv", "data-dictionary.csv", "metadata.json", "LICENSE.txt", "README.md"]
    manifest = {"schema": "dendrogeo-primary-data-candidate/1", "source_report": evidence["source_report"], "files": [{"name": n, "sha256": hashlib.sha256((output / n).read_bytes()).hexdigest()} for n in filenames]}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    return {"records": len(data["rows"]), "files": len(filenames), "published": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(stage(args.source, args.output)))
