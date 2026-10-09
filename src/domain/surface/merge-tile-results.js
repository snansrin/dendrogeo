"use strict";
/* DendroGeo · domain/surface/merge-tile-results.js
 * Pure aggregation of independently processed raster tiles. This module owns
 * only result merging: it does not fetch data, classify pixels, or project
 * geometry. The public service name remains exposed by lc-engine.js as a
 * compatibility adapter for the existing classic-script API.
 */
function dgSurfaceMergeTileResults(parts){
  const outGroupCounts={},outGroupAreas={},outRawCounts={},outRawAreas={};
  const runs=[];
  const cells=[];
  let assigned=0,classified=0,masked=0,maskedCount=0,sourceCells=0;
  for(const p of parts){
    assigned+=p.assignedAreaM2;
    classified+=p.classifiedAreaM2;
    masked+=p.maskedAreaM2;
    maskedCount+=p.maskedCount||0;
    sourceCells+=p.sourceCells;
    for(const [k,v] of Object.entries(p.groupCounts||{}))outGroupCounts[k]=(outGroupCounts[k]||0)+v;
    for(const [k,v] of Object.entries(p.groupAreas||{}))outGroupAreas[k]=(outGroupAreas[k]||0)+v;
    for(const [k,v] of Object.entries(p.rawCounts||{}))outRawCounts[k]=(outRawCounts[k]||0)+v;
    for(const [k,v] of Object.entries(p.rawAreas||{}))outRawAreas[k]=(outRawAreas[k]||0)+v;
    runs.push(...(p.runs||[]));
    if(cells.length<10000)cells.push(...(p.cells||[]));
  }
  return{
    assignedAreaM2:assigned,
    classifiedAreaM2:classified,
    maskedAreaM2:masked,
    maskedCount,
    sourceCells,
    groupCounts:outGroupCounts,
    groupAreas:outGroupAreas,
    rawCounts:outRawCounts,
    rawAreas:outRawAreas,
    runs,
    cells
  };
}

window.DG_SURFACE_TILE_MERGER=Object.freeze({merge:dgSurfaceMergeTileResults});
