"use strict";

/* Loads one complete OSM coverage response for the currently selected park.
 * Geometry classification and cache mutation remain in the service layer. */
window.DG_PARK_COVERAGE_FETCH_APPLICATION = {
  create({getParkPolygon, queryOsm}) {
    return async function fetchDetailedCoverage() {
      const parkPolygon = getParkPolygon();
      if (!parkPolygon || !parkPolygon.length) return null;

      const boundary = JSON.stringify(parkPolygon);
      let minLat = 90;
      let maxLat = -90;
      let minLon = 180;
      let maxLon = -180;

      parkPolygon.forEach(ring => ring.forEach(point => {
        if (point[0] < minLat) minLat = point[0];
        if (point[0] > maxLat) maxLat = point[0];
        if (point[1] < minLon) minLon = point[1];
        if (point[1] > maxLon) maxLon = point[1];
      }));

      const pad = 0.0005;
      const bbox = `${minLat-pad},${minLon-pad},${maxLat+pad},${maxLon+pad}`;
      const query =
        `[out:json][timeout:90];(`+
        `way["natural"="water"](${bbox});`+
        `relation["natural"="water"](${bbox});`+
        `way["water"](${bbox});`+
        `relation["water"](${bbox});`+
        `way["landuse"~"reservoir|basin"](${bbox});`+
        `relation["landuse"~"reservoir|basin"](${bbox});`+
        `way["leisure"="swimming_pool"](${bbox});`+
        `relation["leisure"="swimming_pool"](${bbox});`+
        `way["amenity"="fountain"](${bbox});`+
        `relation["amenity"="fountain"](${bbox});`+
        `way["waterway"="riverbank"](${bbox});`+
        `relation["waterway"="riverbank"](${bbox});`+

        `way["building"](${bbox});`+
        `relation["building"](${bbox});`+
        `way["building:part"](${bbox});`+
        `relation["building:part"](${bbox});`+
        `way["highway"](${bbox});`+
        `way["area:highway"](${bbox});`+
        `relation["area:highway"](${bbox});`+
        `way["landuse"="highway"](${bbox});`+
        `relation["landuse"="highway"](${bbox});`+
        `way["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
        `relation["amenity"~"parking|bicycle_parking|motorcycle_parking"](${bbox});`+
        `way["leisure"~"pitch|track|playground"](${bbox});`+
        `relation["leisure"~"pitch|track|playground"](${bbox});`+
        `way["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"](${bbox});`+
        `relation["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"](${bbox});`+
        `way["man_made"~"pier|bridge"](${bbox});`+
        `relation["man_made"~"pier|bridge"](${bbox});`+
        `);out geom;`;

      const json = await queryOsm(query, "yüzey+su");
      if (boundary !== JSON.stringify(getParkPolygon())) {
        return {stale: true, boundary, bbox: {minLat, minLon, maxLat, maxLon}, pad, json: null};
      }
      return {stale: false, boundary, bbox: {minLat, minLon, maxLat, maxLon}, pad, json};
    };
  }
};
