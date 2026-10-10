"use strict";

/* Preserve waypoint preflight order and defer state reads until they are needed. */
function dgResolveGridWaypointReadiness({ cells, mode, selectedCells, source, getCurrentSource, getProjectId, select }) {
  if (!cells.length) return { ok: false, reason: "grid-missing" };
  if (source !== getCurrentSource()) return { ok: false, reason: "surface-stale" };
  const projectId = getProjectId();
  if (!projectId) return { ok: false, reason: "project-missing" };
  const targetCells = select(cells, mode, selectedCells);
  if (mode === "manual" && !selectedCells.size) return { ok: false, reason: "manual-selection-missing" };
  if (!targetCells.length) return { ok: false, reason: "target-cells-missing" };
  return { ok: true, targetCells, projectId };
}

window.DG_GRID_WAYPOINT_READINESS = Object.freeze({ resolve: dgResolveGridWaypointReadiness });
