"use strict";

/* Candidate ring/line overlap with a park, including legacy sampling and bbox guard. */
function dgParkSegmentsIntersectLatLon(a1, a2, b1, b2) {
  const refLat = (a1[0] + a2[0] + b1[0] + b2[0]) / 4;
  const cosLat = Math.cos(refLat * Math.PI / 180);
  const project = point => ({
    x: point[1] * 111320 * cosLat,
    y: point[0] * 110540
  });
  const a = project(a1);
  const b = project(a2);
  const c = project(b1);
  const d = project(b2);
  return window.DG_PARK_SEGMENTS.segmentsIntersect(a, b, c, d);
}

function dgParkRingTouchesPark(ring, parkRings, parkBounds, parkHoles = []) {
  if (!ring || ring.length < 3) return false;
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const point of ring) {
    if (point[0] < minLat) minLat = point[0];
    if (point[0] > maxLat) maxLat = point[0];
    if (point[1] < minLon) minLon = point[1];
    if (point[1] > maxLon) maxLon = point[1];
  }

  const buffer = 0.0005;
  if (maxLat < parkBounds.minLat - buffer || minLat > parkBounds.maxLat + buffer ||
      maxLon < parkBounds.minLon - buffer || minLon > parkBounds.maxLon + buffer) return false;

  const contains = window.DG_PARK_CONTAINMENT.pointInPark;
  for (const point of ring) if (contains(point[0], point[1], parkRings, parkHoles)) return true;
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  if (contains(centerLat, centerLon, parkRings, parkHoles)) return true;

  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    if (contains((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, parkRings, parkHoles)) return true;
  }

  const parkOuter = Array.isArray(parkRings) ? parkRings : (parkRings.outer || []);
  for (const parkRing of parkOuter) {
    for (let i = 0; i < parkRing.length - 1; i++) {
      for (let j = 0; j < ring.length - 1; j++) {
        if (dgParkSegmentsIntersectLatLon(parkRing[i], parkRing[i + 1], ring[j], ring[j + 1])) return true;
      }
    }
  }
  return false;
}

function dgParkLineTouchesPark(line, parkRings, parkBounds, parkHoles = []) {
  if (!line || line.length < 2) return false;
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const point of line) {
    if (point[0] < minLat) minLat = point[0];
    if (point[0] > maxLat) maxLat = point[0];
    if (point[1] < minLon) minLon = point[1];
    if (point[1] > maxLon) maxLon = point[1];
  }

  const buffer = 0.0005;
  if (maxLat < parkBounds.minLat - buffer || minLat > parkBounds.maxLat + buffer ||
      maxLon < parkBounds.minLon - buffer || minLon > parkBounds.maxLon + buffer) return false;

  const contains = window.DG_PARK_CONTAINMENT.pointInPark;
  for (const point of line) if (contains(point[0], point[1], parkRings, parkHoles)) return true;

  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const midLat = (a[0] + b[0]) / 2;
    const dy = (b[0] - a[0]) * 110540;
    const dx = (b[1] - a[1]) * 111320 * Math.cos(midLat * Math.PI / 180);
    const length = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(length / 5));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const lat = a[0] + (b[0] - a[0]) * t;
      const lon = a[1] + (b[1] - a[1]) * t;
      if (contains(lat, lon, parkRings, parkHoles)) return true;
    }
  }

  const parkOuter = Array.isArray(parkRings) ? parkRings : (parkRings.outer || []);
  for (const parkRing of parkOuter) {
    for (let i = 0; i < parkRing.length - 1; i++) {
      for (let j = 0; j < line.length - 1; j++) {
        if (dgParkSegmentsIntersectLatLon(parkRing[i], parkRing[i + 1], line[j], line[j + 1])) return true;
      }
    }
  }
  return false;
}

window.DG_PARK_OVERLAP = Object.freeze({
  segmentsIntersectLatLon: dgParkSegmentsIntersectLatLon,
  ringTouchesPark: dgParkRingTouchesPark,
  lineTouchesPark: dgParkLineTouchesPark
});
