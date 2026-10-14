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
      /* Use one selector per tag family. The former way+relation pairs issued
       * nearly thirty overlapping bbox scans and often exhausted the shared
       * 20 s Overpass budget before returning grid-critical geometry. */
      const query =
        `[out:json][timeout:45];(`+
        `nwr["natural"="water"](${bbox});`+
        `nwr["water"](${bbox});`+
        `nwr["landuse"~"reservoir|basin|highway"](${bbox});`+
        `nwr["waterway"="riverbank"](${bbox});`+
        `nwr["leisure"~"swimming_pool|pitch|track|playground"](${bbox});`+
        `nwr["amenity"~"fountain|parking|bicycle_parking|motorcycle_parking"](${bbox});`+
        `nwr["building"](${bbox});`+
        `nwr["building:part"](${bbox});`+
        `way["highway"](${bbox});`+
        `way["area:highway"](${bbox});`+
        `nwr["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"](${bbox});`+
        `nwr["man_made"~"pier|bridge"](${bbox});`+
        `nwr["bridge"="yes"](${bbox});`+
        `);out geom;`;

      let json=null;
      try{json=await queryOsm(query,"yüzey+su");}catch(error){}
      if(!json){
        const recovery=`[out:json][timeout:30];(nwr["natural"="water"](${bbox});nwr["waterway"="riverbank"](${bbox});nwr["landuse"~"reservoir|basin"](${bbox});nwr["building"](${bbox});nwr["building:part"](${bbox});way["highway"](${bbox});way["area:highway"](${bbox}););out geom;`;
        try{json=await queryOsm(recovery,"yüzey+su");}catch(error){}
      }
      if (boundary !== JSON.stringify(getParkPolygon())) {
        return {stale: true, boundary, bbox: {minLat, minLon, maxLat, maxLon}, pad, json: null};
      }
      return {stale: false, boundary, bbox: {minLat, minLon, maxLat, maxLon}, pad, json};
    };
  }
};
