"use strict";

/* Metric point-to-line calculations used by park surface and road rules. */
function dgParkPointToSegmentDistanceM(lat, lon, a, b) {
  const refLat = lat * Math.PI / 180;
  const ax = (a[1] - lon) * 111320 * Math.cos(refLat);
  const ay = (a[0] - lat) * 110540;
  const bx = (b[1] - lon) * 111320 * Math.cos(refLat);
  const by = (b[0] - lat) * 110540;
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) return Math.sqrt(ax * ax + ay * ay);

  const denominator = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, (-ax * dx - ay * dy) / denominator));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.sqrt(px * px + py * py);
}

function dgParkPointNearImperviousLine(lat, lon, lines) {
  for (const line of (lines || [])) {
    if (!line || !Array.isArray(line.pts) || line.pts.length < 2) continue;
    const width = Number.isFinite(Number(line.w)) ? Math.max(0, Number(line.w)) : 1;

    for (let i = 0; i < line.pts.length - 1; i++) {
      if (dgParkPointToSegmentDistanceM(lat, lon, line.pts[i], line.pts[i + 1]) <= width) return true;
    }
  }
  return false;
}

function dgParkPointNearAnyLine(lat, lon, lines, maxDistanceM) {
  for (const line of (lines || [])) {
    if (!Array.isArray(line) || line.length < 2) continue;
    for (let i = 0; i < line.length - 1; i++) {
      if (dgParkPointToSegmentDistanceM(lat, lon, line[i], line[i + 1]) <= maxDistanceM) return true;
    }
  }
  return false;
}

window.DG_PARK_LINE_DISTANCE = Object.freeze({
  pointToSegmentDistanceM: dgParkPointToSegmentDistanceM,
  pointNearImperviousLine: dgParkPointNearImperviousLine,
  pointNearAnyLine: dgParkPointNearAnyLine
});
