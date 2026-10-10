"use strict";

/* OSM impervious geometry collection rules used by park grid planning. */
function dgParkIsClosedLine(line) {
  return (
    line &&
    line.length > 2 &&
    Math.abs(line[0][0] - line[line.length - 1][0]) < 1e-7 &&
    Math.abs(line[0][1] - line[line.length - 1][1]) < 1e-7
  );
}

function dgParkCollectImperviousGeometry(el, sinks, helpers) {
  if (el.type === "relation") {
    const rings = helpers.extractRings(el);
    if (!rings) return;

    if (Array.isArray(rings)) {
      rings.forEach(ring => {
        if (ring && ring.length >= 3) sinks.rings.push(ring);
      });
    } else if (rings.outer) {
      rings.outer.forEach(ring => {
        if (ring && ring.length >= 3) sinks.rings.push(ring);
      });
    }
    return;
  }

  if (!el.geometry) return;

  const points = el.geometry.map(point => [point.lat, point.lon]);
  if (points.length < 2) return;

  const tags = el.tags || {};
  const surface = String(tags.surface || "").toLowerCase().trim();
  const hardSurfaces = new Set([
    "asphalt",
    "concrete",
    "paving_stones",
    "sett",
    "concrete:plates",
    "concrete:lanes",
    "cobblestone",
    "bricks",
    "metal"
  ]);

  const isArea =
    !!tags.building ||
    tags.amenity === "parking" ||
    tags.amenity === "bicycle_parking" ||
    tags.amenity === "motorcycle_parking" ||
    !!tags["area:highway"] ||
    tags.landuse === "highway" ||
    ((tags.leisure === "pitch" || tags.leisure === "track" || tags.leisure === "playground") &&
      hardSurfaces.has(surface));

  if (dgParkIsClosedLine(points)) {
    if (isArea) {
      sinks.rings.push(points);
    }
    return;
  }

  let width = 0;
  if (tags.highway) {
    const taggedWidth = parseFloat(String(tags.width || "").replace(",", "."));
    if (Number.isFinite(taggedWidth) && taggedWidth > 0 && taggedWidth < 30) {
      width = taggedWidth / 2;
    } else {
      const lanes = parseFloat(String(tags.lanes || "").replace(",", "."));
      if (Number.isFinite(lanes) && lanes > 0 && lanes < 10) {
        width = Math.max(1.25, (lanes * 3.0) / 2);
      } else {
        width = helpers.roadHalfWidth(tags.highway);
      }
    }
  } else if (hardSurfaces.has(surface)) {
    width = 3;
  } else {
    width = 2;
  }

  sinks.lines.push({ pts: points, w: width });

  if (
    tags.highway &&
    !/^(footway|path|cycleway|steps|pedestrian|bridleway|track)$/.test(
      String(tags.highway).toLowerCase()
    )
  ) {
    sinks.blockLines.push({ pts: points, w: Math.max(1, width) });
  }
}

function dgParkCollectPedestrianGridBlocker(el, sinks, helpers) {
  if (!el || !el.geometry || !el.tags || !el.tags.highway) return;

  const highway = String(el.tags.highway).toLowerCase();
  if (!/^(footway|path|cycleway|steps|pedestrian|bridleway|track)$/.test(highway)) return;

  const points = el.geometry.map(point => [point.lat, point.lon]);
  if (points.length < 2) return;

  const width = parseFloat(String(el.tags.width || "").replace(",", "."));
  let halfWidth;
  if (Number.isFinite(width) && width > 0 && width < 30) {
    halfWidth = width / 2;
  } else {
    const lanes = parseFloat(String(el.tags.lanes || "").replace(",", "."));
    if (Number.isFinite(lanes) && lanes > 0 && lanes < 10) {
      halfWidth = Math.max(1.25, (lanes * 3.0) / 2);
    } else {
      halfWidth = helpers.roadHalfWidth(highway);
    }
  }

  sinks.blockLines.push({ pts: points, w: Math.max(1, halfWidth) });
}

window.DG_PARK_IMPERVIOUS_GEOMETRY = Object.freeze({
  isClosedLine: dgParkIsClosedLine,
  collectImperviousGeometry: dgParkCollectImperviousGeometry,
  collectPedestrianGridBlocker: dgParkCollectPedestrianGridBlocker
});
