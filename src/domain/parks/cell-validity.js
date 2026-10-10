"use strict";

/* Grid-cell eligibility across park, green-cover, water, and hard-surface rules. */
function dgParkIsCellValid(s0, s1, w0, w1, dependencies) {
  if (!dependencies.cellInsidePark(s0, s1, w0, w1)) return false;

  const centerLat = (s0 + s1) / 2;
  const landcover = dependencies.landcover;
  if (
    dependencies.greenOnly &&
    landcover &&
    typeof landcover.isGreen === "function" &&
    landcover.hasGreen &&
    landcover.hasGreen()
  ) {
    if (!landcover.isGreen(centerLat, (w0 + w1) / 2)) return false;
  }

  const cellRect = dependencies.ringBBox(
    [
      [s0, w0],
      [s0, w1],
      [s1, w1],
      [s1, w0]
    ],
    centerLat
  );

  for (const ring of dependencies.waterRings || []) {
    if (dependencies.geometryIntersectsRect(ring, cellRect, centerLat, dependencies.waterClearanceM)) return false;
  }

  for (const line of dependencies.waterLines || []) {
    if (dependencies.geometryLineIntersectsRect(line, cellRect, centerLat, dependencies.waterClearanceM)) return false;
  }

  for (const ring of dependencies.imperviousRings || []) {
    if (dependencies.geometryIntersectsRect(ring, cellRect, centerLat, dependencies.imperviousClearanceM)) return false;
  }

  /* Linear impervious features keep their stored half-width when present. */
  for (const line of dependencies.imperviousLines || []) {
    if (!line || !Array.isArray(line.pts) || line.pts.length < 2) continue;
    const buffer = Number.isFinite(line.w) ? Math.max(0, line.w) : dependencies.imperviousClearanceM;
    if (dependencies.geometryLineIntersectsRect(line.pts, cellRect, centerLat, buffer)) return false;
  }

  for (const line of dependencies.gridBlockLines || []) {
    if (!line || !Array.isArray(line.pts) || line.pts.length < 2) continue;
    const buffer = Number.isFinite(line.w) ? Math.max(0, line.w) : dependencies.imperviousClearanceM;
    if (dependencies.geometryLineIntersectsRect(line.pts, cellRect, centerLat, buffer)) return false;
  }

  return true;
}

window.DG_PARK_CELL_VALIDITY = Object.freeze({ isCellValid: dgParkIsCellValid });
