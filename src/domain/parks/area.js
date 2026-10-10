"use strict";

/* Geodesic area for the existing [LON,LAT] park ring convention. */
function dgParkRingGeodesicArea(ring) {
  const R = 6378137;
  let total = 0;

  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    const l1 = p1[1] * Math.PI / 180;
    const l2 = p2[1] * Math.PI / 180;
    const f1 = p1[0] * Math.PI / 180;
    const f2 = p2[0] * Math.PI / 180;
    total += (l2 - l1) * (2 + Math.sin(f1) + Math.sin(f2));
  }

  return Math.abs(total * R * R / 2);
}

function dgParkPolyArea(rings) {
  if (!rings) return 0;

  if (!Array.isArray(rings) && rings.outer) {
    let outerArea = 0;
    let innerArea = 0;
    for (const ring of rings.outer) {
      if (ring && ring.length >= 3) outerArea += dgParkRingGeodesicArea(ring);
    }
    for (const ring of (rings.inner || [])) {
      if (ring && ring.length >= 3) innerArea += dgParkRingGeodesicArea(ring);
    }
    return Math.max(0, outerArea - innerArea);
  }

  let total = 0;
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    total += dgParkRingGeodesicArea(ring);
  }
  return total;
}

window.DG_PARK_AREA = Object.freeze({
  ringGeodesicArea: dgParkRingGeodesicArea,
  polyArea: dgParkPolyArea
});
