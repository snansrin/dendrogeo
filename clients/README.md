# DendroGeo research clients

The R and Python clients are read-only tools for retrieving publicly released DGR artifacts. They never access Supabase, private records, or unpublished analyses. Both clients read public static report packages and verify each downloaded file against that report's SHA-256 manifest before returning it.

Only reports that are already public can be read. A report's license and reuse conditions come from its metadata.json; client software is MIT-licensed. External map, raster, and field-data rights remain governed by their source and consent terms.

## Python

From the repository root, install with pip install ./clients/python and run python -m unittest discover -s clients/python/tests -v.

Example:

    from dendrogeo_client import DendroGeoClient
    report = DendroGeoClient().get_report("DGR-2026-0026")
    print(report["metadata"]["license"])
    print(report["data"]["result_hash"])

## R

Install with R CMD INSTALL clients/r/dendrogeo. Requires R 4.1 or later and httr2, jsonlite, and digest.

    report <- dendrogeo::dgr_get("DGR-2026-0026")
    report$metadata$license
    report$data$result_hash

## Stability

The DGR identifier format and report metadata schema are versioned separately from the client packages. The clients reject malformed identifiers, unknown artifact paths, mismatched report IDs, and SHA-256 mismatches. The public Pages URL is a read-only distribution endpoint, not a general-purpose API or service-level agreement.

