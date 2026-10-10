"use strict";

/* OSM way/relation coordinate cleanup and ring assembly; arrays are [LAT,LON]. */
function dgParkCloseRing(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
    ring.push([first[0], first[1]]);
  }
  return ring.length >= 4 ? ring : null;
}

function dgParkJoinWaysToRings(ways) {
  const rings = [];
  const remaining = ways.slice();
  const equal = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

  while (remaining.length) {
    const chain = remaining.shift().slice();
    let merged = true;
    let guard = ways.length * ways.length + 100;

    while (merged && guard-- > 0) {
      merged = false;
      for (let i = 0; i < remaining.length; i++) {
        const way = remaining[i];
        const head = chain[0];
        const tail = chain[chain.length - 1];

        if (equal(tail, way[0])) {
          chain.push(...way.slice(1));
          merged = true;
        } else if (equal(tail, way[way.length - 1])) {
          chain.push(...way.slice().reverse().slice(1));
          merged = true;
        } else if (equal(head, way[way.length - 1])) {
          chain.unshift(...way.slice(0, -1));
          merged = true;
        } else if (equal(head, way[0])) {
          chain.unshift(...way.slice().reverse().slice(0, -1));
          merged = true;
        }

        if (merged) {
          remaining.splice(i, 1);
          break;
        }
      }
    }

    if (chain.length > 2) {
      if (!equal(chain[0], chain[chain.length - 1])) chain.push([chain[0][0], chain[0][1]]);
      rings.push(chain);
    }
  }

  return rings;
}

function dgParkExtractRings(element) {
  if (!element || typeof element !== "object") return null;

  if (element.type === "way" && Array.isArray(element.geometry)) {
    const ring = element.geometry
      .filter(point => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
      .map(point => [Number(point.lat), Number(point.lon)]);
    const closed = dgParkCloseRing(ring);
    return closed ? [closed] : null;
  }

  if (element.type === "relation" && Array.isArray(element.members)) {
    const validMember = member => member && Array.isArray(member.geometry) && member.geometry.length >= 2;
    const collect = role => element.members
      .filter(member => member.role === role && validMember(member))
      .map(member => member.geometry
        .filter(point => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
        .map(point => [Number(point.lat), Number(point.lon)]))
      .filter(way => way.length >= 2);

    const outer = dgParkJoinWaysToRings(collect("outer"));
    const inner = dgParkJoinWaysToRings(collect("inner"));
    if (!outer.length) return null;
    return {
      outer: outer.filter(ring => Array.isArray(ring) && ring.length >= 4),
      inner: inner.filter(ring => Array.isArray(ring) && ring.length >= 4)
    };
  }

  return null;
}

window.DG_PARK_OSM_RINGS = Object.freeze({
  extractRings: dgParkExtractRings,
  joinWaysToRings: dgParkJoinWaysToRings
});
