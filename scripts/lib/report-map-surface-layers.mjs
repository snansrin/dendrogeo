import { hex2rgb } from './png.mjs';
import { fillRing } from './report-map-primitives.mjs';
import { restoreOutsideRings } from './report-map-clipping.mjs';
import { fillSurfacePolygon } from './report-map-surface-fill.mjs';

/* Draw the map's accepted surface layers in their established order. */
export function drawReportMapSurfaceLayers({
  canvas, outer, outers = null, surfaceFeatures = [], holes = [], wruns = [],
  project, classFor, contextTone, noDataTone, frameTone,
  padding, top, mapHeight, frameInset=12
}) {
  const ring = outer.map(([lat, lon]) => project(lon, lat));
  fillRing(canvas, ring, noDataTone);                       /* base: no-data tone */
  for (const hole of holes)
    fillRing(canvas, hole.map(([lat, lon]) => project(lon, lat)), contextTone);
  for (const run of wruns)                                  /* contiguous cell overlay */
    canvas.rect(project(run.lo0, run.la1)[0], project(run.lo0, run.la1)[1],
      project(run.lo1, run.la0)[0], project(run.lo1, run.la0)[1],
      hex2rgb((classFor(run.key) && classFor(run.key).color) || '#94a3b8'));
  for (const feature of surfaceFeatures) for (const polygon of feature.geometry.coordinates) {
    const rings = polygon.map(ringPoints => ringPoints.map(([lon, lat]) => project(lon, lat)));
    fillSurfacePolygon(canvas, rings, hex2rgb(classFor(feature.properties.class)?.color || '#94a3b8'));
  }

  /* Restore pixels outside all park components after the class overlays. */
  const allRings = [
    ...(outers || [outer]).map(points => points.map(([lat, lon]) => project(lon, lat))),
    ...holes.map(points => points.map(([lat, lon]) => project(lon, lat)))
  ];
  restoreOutsideRings(canvas, allRings, Math.min(canvas.h - 1, top + mapHeight), contextTone);

  /* The thin frame follows clipping so the context repaint cannot erase it. */
  const frame = {
    left: padding - frameInset, top: top - frameInset,
    right: canvas.w - padding + frameInset, bottom: top + mapHeight + frameInset
  };
  canvas.line(frame.left, frame.top, frame.right, frame.top, frameTone);
  canvas.line(frame.left, frame.bottom, frame.right, frame.bottom, frameTone);
  canvas.line(frame.left, frame.top, frame.left, frame.bottom, frameTone);
  canvas.line(frame.right, frame.top, frame.right, frame.bottom, frameTone);
  return { ring, frame };
}
