/* Geometry work stays off the interaction thread. No credentials or network reads. */
(function(){
 self.window=self;
 const version=new URL(self.location.href).searchParams.get('v')||'current';
 importScripts(...['../core/surface-display.js','../../vendor/polygon-clipping-0.15.7.js','../services/park-geometry.js','../services/lc-geo.js','../contracts/surface-review.js','../adapters/surface/review-store.js','../domain/surface/review-geometry.js','../domain/surface/snap-surface-review-coordinate.js','../adapters/surface/project-surface-review-ring.js','../adapters/surface/unproject-surface-review-geometry.js','../application/surface/build-surface-review-park-geometry.js','../application/surface/build-surface-review-cell-geometry.js','../adapters/surface/osm-review-objects.js','../adapters/surface/review-worker.js','../application/surface/prepare-review.js','../application/surface/merge-review-features.js','../domain/surface/measure-grid-point-distance.js','../domain/surface/find-grid-interior-point.js','../domain/surface/build-grid-line-mask.js','../domain/surface/clean-grid-geometry.js','../adapters/surface/clip-grid-geometry.js','../domain/surface/validate-surface-grid-options.js','../application/surface/prepare-surface-grid-domain.js','../application/surface/erode-surface-grid-domain.js','../application/surface/build-surface-sampling-grid-cells.js','../application/surface/run-surface-sampling-grid.js','../domain/surface/select-surface-review-features.js','../application/surface/prepare-surface-review-feature-masks.js','../application/surface/resolve-surface-review-cell.js','../application/surface/resolve-surface-review-parts.js','../domain/surface/summarize-surface-review-parts.js','../services/lc-review.js'].map(p=>p+'?v='+encodeURIComponent(version)));
 self.onmessage=async event=>{
  try{const d=event.data;
   if(d.job==='grid'){self.postMessage(await dgSurfaceGrid(d));return;}
   if(d.job==='merge'){const features=dgSurfaceMergeSync(d.parts,d.epsg);self.postMessage({features,displayFeatures:d.display?dgSurfaceDisplaySync(d.parts,d.epsg,d.park,features):features});return;}
   const park=dgSurfacePark(d.outer,d.holes,d.epsg),geometries={};
   const objects=d.objects||dgSurfaceObjects(d.elements||[],d.epsg);
   const features=[...(d.useObjects!==false?objects:[]),...d.features];
   for(const c of d.cells)geometries[c.row+':'+c.col]=dgSurfaceCell(c,park,d.epsg);
   const parts=dgSurfaceResolved(d.cells,c=>c.classKey,geometries,features,d.epsg,park);
   for(const p of parts)p.wgs=dgSurfaceUnproject(p.geom,d.epsg);
   self.postMessage({park,geometries,objects,parts});
  }catch(e){self.postMessage({error:String(e.message||e)});}
 };
})();
