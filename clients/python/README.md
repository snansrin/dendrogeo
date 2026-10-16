# dendrogeo-client

Read-only Python client for public, immutable DendroGeo reports. It uses the Python standard library and verifies report artifacts against manifest.json before decoding them.

    from dendrogeo_client import DendroGeoClient
    client = DendroGeoClient()
    report = client.get_report("DGR-2026-0026")
    geojson = client.get_artifact("DGR-2026-0026", "park.geojson")

The default endpoint is https://dendrogeo.org/rapor/. A test server or mirror can be supplied with DendroGeoClient(base_url=...). Only names listed in the report manifest can be downloaded. The client is read-only and cannot publish, edit, or access private data.

Client code is MIT licensed. Each report states its own data license and source terms in metadata.json.
