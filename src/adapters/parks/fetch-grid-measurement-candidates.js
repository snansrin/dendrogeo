"use strict";

/* Fetch approved measurements inside the grid's geographic bounding box. */
function dgFetchGridMeasurementCandidates(client, bounds, limit = 5000) {
  return client
    .from("measurements")
    .select("lat,lon", { count: "exact" })
    .eq("status", "Onaylı")
    .gte("lat", bounds.minLat)
    .lte("lat", bounds.maxLat)
    .gte("lon", bounds.minLon)
    .lte("lon", bounds.maxLon)
    .limit(limit);
}

window.DG_GRID_MEASUREMENT_STORE = Object.freeze({ fetchCandidates: dgFetchGridMeasurementCandidates });
