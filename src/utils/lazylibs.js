"use strict";
/* DendroGeo · utils/lazylibs.js — TEMBEL VENDOR YÜKLEYİCİ (Faz 7)
 *
 * NEDEN: geotiff-2.1.3.js (317 KB) ve chart.js-4.5.1.js (208 KB) eskiden
 * index.html <head>'inde SENKRON yükleniyordu; oysa GeoTIFF'i yalnız LULC
 * analizi (park seçip "Yüzey Örtüsü Analizi"ne basan kullanıcı), Chart.js'i
 * yalnız giriş yapmış panel (karbon trendi grafiği) kullanıyor. Landing
 * ziyaretçisi ~525 KB'ı boşa indiriyordu.
 *
 * NASIL: bu iki vendor dosyası artık head'de tag'li DEĞİL. İhtiyaç anında
 * dgEnsureGeoTIFF() / dgEnsureChart() <script> enjekte eder ve yüklemeyi
 * Promise olarak döner (aynı anda çok çağıran olursa tek enjeksiyon — promise
 * paylaşılır; hata olursa promise sıfırlanır, sonraki çağrı yeniden dener).
 */
function dgRuntimeBuild(){try{return JSON.parse(document.getElementById("dgRuntimeBuild")?.textContent||'"current"');}catch(e){return "current";}}
function dgRuntimeScriptUrl(src){return src+(src.includes("?")?"&":"?")+"v="+encodeURIComponent(dgRuntimeBuild());}
let DG_GEO_PROMISE=null;
let DG_CHART_PROMISE=null;

function dgLoadVendorScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=dgRuntimeScriptUrl(src);
    s.async=true;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error(src+" yüklenemedi"));
    document.head.appendChild(s);
  });
}

function dgEnsureGeoTIFF(){
  if(window.GeoTIFF)return Promise.resolve();
  if(!DG_GEO_PROMISE){
    DG_GEO_PROMISE=dgLcLoadWithRetry("vendor/geotiff-2.1.3.js","GeoTIFF")
      .catch(err=>{DG_GEO_PROMISE=null;throw err;});
  }
  return DG_GEO_PROMISE;
}

function dgEnsureChart(){
  if(window.Chart)return Promise.resolve();
  if(!DG_CHART_PROMISE){
    DG_CHART_PROMISE=dgLcLoadWithRetry("vendor/chart.js-4.5.1.js","Chart")
      .catch(err=>{DG_CHART_PROMISE=null;throw err;});
  }
  return DG_CHART_PROMISE;
}

function dgLcLoadWithRetry(src,globalName){
  return dgLoadVendorScript(src).then(()=>{
    if(!window[globalName])throw new Error(src+" yüklendi ama "+globalName+" global'i oluşmadı");
  });
}

/* =========================================================
   LULC ZİNCİRİ — TEMBEL MODÜL YÜKLEME (2026-09-25 · Faz 8)
========================================================= */
const DG_LULC_CHAIN=[
  "src/services/lc-config.js",
  "src/domain/surface/classify-landcover-code.js",
  "src/domain/surface/compare-source-class-areas.js",
  "src/domain/surface/geometry-bounds.js",
  "src/domain/surface/utm-projection.js",
  "src/domain/surface/clip-polygon-rect.js",
  "src/domain/surface/clip-polygon-convex.js",
  "src/domain/surface/projected-geometry-area.js",
  "src/services/lc-geo.js",
  "src/domain/surface/stac-fetch-policy.js",
  "src/adapters/surface/open-raster-range.js",
  "src/adapters/surface/sign-stac-assets.js",
  "src/domain/surface/select-stac-tiles.js",
  "src/domain/surface/resolve-raster-window.js",
  "src/services/lc-stac.js",
  "src/domain/surface/merge-tile-results.js",
  "src/adapters/surface/result-exports.js",
  "src/application/surface/analyze-source.js",
  "src/adapters/surface/process-landcover-tile.js",
  "src/services/lc-engine.js",
  "src/adapters/surface/load-osm-landcover-evidence.js",
  "src/domain/surface/extract-osm-water-polygons.js",
  "src/application/surface/refine-water-by-osm.js",
  "src/domain/surface/osm-road-policy.js",
  "src/application/surface/refine-hard-by-osm.js",
  "src/services/lc-osm.js",
  "src/domain/surface/patch-geometry.js", "src/domain/surface/group-patch-cells.js", "src/domain/surface/measure-patch-components.js", "src/domain/surface/query-green-patches.js",
  "src/services/lc-patches.js",
  "src/domain/surface/validation-sampling.js",
  "src/domain/surface/build-validation-confusion-matrix.js",
  "src/domain/surface/build-validation-stratum-weights.js",
  "src/domain/surface/calculate-validation-class-proportions.js",
  "src/domain/surface/calculate-validation-area-estimates.js",
  "src/domain/surface/calculate-validation-class-accuracy.js",
  "src/domain/surface/validation-accuracy-metrics.js",
  "src/domain/surface/validation-spectral-rules.js",
  "src/application/surface/build-validation-agreement.js",
  "src/domain/surface/build-validation-campaign-csv-rows.js",
  "src/application/surface/serialize-validation-campaign-csv.js",
  "src/application/surface/serialize-validation-campaign-json.js",
  "src/domain/surface/apply-validation-campaign-corrections.js",
  "src/domain/surface/build-validation-corrected-geojson.js",
  "src/application/surface/serialize-validation-campaign.js",
  "src/adapters/surface/validation-campaign-store.js",
  "src/application/surface/validation-campaign-archive.js",
  "src/application/surface/validation-campaign-save-queue.js",
  "src/application/surface/handle-validation-campaign-save-failure.js",
  "src/domain/surface/select-validation-campaign.js",
  "src/domain/surface/select-surface-brush-cells.js",
  "src/domain/surface/create-surface-cell-decision.js",
  "src/application/surface/surface-brush-history.js",
  "src/application/surface/migrate-legacy-brush-masks.js",
  "src/domain/surface/surface-geometry-overlap.js",
  /* UYDU HASSASİYET (0054 · 2026-10-03): lc-validate eşik/metrics çekirdeği
   * + lc-s2 Sentinel-2 spektral kanıt + ui/lc-sens basit kaydırıcı paneli
   * (0053'teki üç adımlı workbench kullanıcı isteğiyle kaldırıldı). */
  "src/services/lc-validate.js",
  "src/domain/surface/select-sentinel-scenes.js",
  "src/domain/surface/sentinel-temporal-windows.js",
  "src/domain/surface/sentinel-raster-grid.js",
  "src/domain/surface/sentinel-spectral-evidence.js",
  "src/application/surface/build-sentinel-profile.js",
  "src/adapters/surface/load-sentinel-scene-bands.js",
  "src/application/surface/read-sentinel-scene-windows.js",
  "src/domain/surface/index-sentinel-scene-cells.js",
  "src/application/surface/collect-sentinel-scene-observations.js",
  "src/domain/surface/merge-sentinel-annual-evidence.js",
  "src/application/surface/prepare-sentinel-annual-evidence.js",
  "src/application/surface/find-sentinel-annual-scenes.js",
  "src/application/surface/read-sentinel-annual-scene-windows.js",
  "src/domain/surface/index-sentinel-annual-scene-cells.js",
  "src/application/surface/collect-sentinel-annual-evidence.js",
  "src/services/lc-s2.js",
  "src/domain/surface/normalize-landcover-report-result.js",
  "src/domain/surface/build-landcover-report-model.js",
  "src/ui/render-landcover-report-rows.js",
  "src/ui/render-landcover-report-metadata.js",
  "src/ui/compose-landcover-report.js",
  "src/ui/lc-report.js",
  "vendor/polygon-clipping-0.15.7.js",
  "src/contracts/surface-review.js",
  "src/adapters/surface/review-store.js",
  "src/domain/surface/review-geometry.js",
  "src/domain/surface/snap-surface-review-coordinate.js",
  "src/adapters/surface/project-surface-review-ring.js",
  "src/adapters/surface/unproject-surface-review-geometry.js",
  "src/application/surface/build-surface-review-park-geometry.js",
  "src/application/surface/build-surface-review-cell-geometry.js",
  "src/adapters/surface/osm-review-objects.js",
  "src/adapters/surface/review-worker.js",
  "src/application/surface/prepare-review.js",
  "src/application/surface/merge-review-features.js",
  "src/domain/surface/measure-grid-point-distance.js",
  "src/domain/surface/find-grid-interior-point.js",
  "src/domain/surface/build-grid-line-mask.js",
  "src/domain/surface/clean-grid-geometry.js",
  "src/adapters/surface/clip-grid-geometry.js",
  "src/domain/surface/validate-surface-grid-options.js",
  "src/application/surface/prepare-surface-grid-domain.js",
  "src/application/surface/erode-surface-grid-domain.js",
  "src/application/surface/build-surface-sampling-grid-cells.js",
  "src/application/surface/run-surface-sampling-grid.js",
  "src/domain/surface/select-surface-review-features.js",
  "src/application/surface/prepare-surface-review-feature-masks.js",
  "src/application/surface/resolve-surface-review-cell.js",
  "src/application/surface/resolve-surface-review-parts.js",
  "src/domain/surface/summarize-surface-review-parts.js",
  "src/services/lc-review.js",
  "src/domain/surface/find-surface-object-at-point.js",
  "src/domain/surface/create-selected-object-boundary.js",
  "src/ui/surface-object-preview.js",
  "src/application/surface/handle-surface-object-pick.js",
  "src/application/surface/apply-surface-object-boundary.js",
  "src/domain/surface/surface-boundary-point-policy.js",
  "src/domain/surface/prepare-surface-boundary.js",
  "src/ui/surface-boundary-drawing-preview.js",
  "src/application/surface/surface-boundary-drawing-session.js",
  "src/application/surface/finish-surface-boundary-drawing.js",
  "src/domain/surface/build-cell-decision-popup-model.js",
  "src/ui/render-cell-decision-popup.js",
  "src/application/surface/apply-surface-cell-decision.js",
  "src/application/surface/undo-surface-cell-decision.js",
  "src/application/surface/reset-surface-corrections.js",
  "src/domain/surface/classify-surface-scan-audit.js",
  "src/ui/render-surface-scan-audit.js",
  "src/domain/surface/classify-surface-vegetation-tiers.js",
  "src/domain/surface/build-surface-vegetation-parts.js",
  "src/ui/render-surface-vegetation-features.js",
  "src/domain/surface/evaluate-surface-acceptance-gate.js",
  "src/domain/surface/create-surface-acceptance-draft.js",
  "src/application/surface/build-surface-result-snapshot.js",
  "src/application/surface/accept-surface-analysis.js",
  "src/ui/render-surface-accepted-result.js",
  "src/adapters/surface/surface-brush-pointer-session.js",
  "src/domain/surface/validate-surface-brush-stroke.js",
  "src/application/surface/commit-surface-brush-stroke.js",
  "src/application/surface/undo-surface-brush-stroke.js",
  "src/application/surface/update-surface-brush-config.js",
  "src/domain/surface/build-surface-editor-view-model.js",
  "src/ui/render-surface-scan-panel.js",
  "src/ui/render-surface-sensitivity-controls.js",
  "src/ui/render-surface-review-actions.js",
  "src/ui/compose-surface-editor-panel.js",
  "src/domain/surface/is-surface-raw-view-transition-allowed.js",
  "src/domain/surface/capture-surface-edit-view-snapshot.js",
  "src/application/surface/prepare-surface-raw-view-transition.js",
  "src/application/surface/restore-surface-edit-view-cache.js",
  "src/application/surface/switch-surface-raw-view.js",
  "src/adapters/surface/load-surface-water-objects.js",
  "src/application/surface/apply-auto-surface-water-objects.js",
  "src/domain/surface/build-surface-scan-summary.js",
  "src/application/surface/complete-surface-scan.js",
  "src/application/surface/run-surface-scan.js",
  "src/domain/surface/create-surface-review-record.js",
  "src/application/surface/load-local-surface-review-draft.js",
  "src/domain/surface/select-surface-review-source.js",
  "src/domain/surface/normalize-surface-review-record.js",
  "src/application/surface/load-surface-review-record.js",
  "src/domain/surface/surface-water-footprint-policy.js",
  "src/domain/surface/classify-surface-water-outside-cell.js",
  "src/domain/surface/select-surface-water-outside-parts.js",
  "src/domain/surface/count-unresolved-surface-water-parts.js",
  "src/domain/surface/requires-surface-water-scan.js",
  "src/application/surface/build-surface-review-parts.js",
  "src/domain/surface/summarize-surface-review-areas.js",
  "src/domain/surface/build-adjusted-surface-summary.js",
  "src/application/surface/render-surface-review-geometry.js",
  "src/domain/surface/build-surface-boundary-geojson.js",
  "src/domain/surface/build-surface-toolbar-model.js",
  "src/ui/render-surface-editor-menu-label.js",
  "src/ui/render-surface-editor-panel-head.js",
  "src/ui/render-surface-editor-menus.js",
  "src/ui/render-surface-editor-tool-rail.js",
  "src/adapters/surface/surface-right-pan-session.js",
  "src/application/surface/select-surface-draw-type.js",
  "src/application/surface/select-surface-brush-type.js",
  "src/application/surface/return-surface-to-hand-mode.js",
  "src/application/surface/update-surface-opacity.js",
  "src/application/surface/select-surface-scan-period.js",
  "src/application/surface/update-surface-sensitivity.js",
  "src/application/surface/focus-surface-class.js",
  "src/application/surface/toggle-surface-candidates.js",
  "src/application/surface/select-surface-basemap.js",
  "src/domain/surface/select-surface-object-features.js",
  "src/application/surface/toggle-surface-objects.js",
  "src/application/surface/start-surface-object-pick.js",
  "src/application/surface/cancel-surface-object-pick.js",
  "src/application/surface/apply-and-accept-surface-object-boundary.js",
  "src/domain/surface/summarize-surface-edit-impact.js",
  "src/application/surface/build-surface-report-model.js",
  "src/ui/render-surface-area-bars.js",
  "src/ui/render-surface-current-report.js",
  "src/ui/render-surface-accepted-report.js",
  "src/domain/surface/build-surface-layer-render-key.js",
  "src/domain/surface/is-surface-layer-render-current.js",
  "src/ui/handle-surface-display-layer-click.js",
  "src/ui/render-surface-display-polygons.js",
  "src/application/surface/refresh-surface-review-layer.js",
  "src/domain/surface/build-surface-repartition-input.js",
  "src/domain/surface/is-surface-repartition-current.js",
  "src/application/surface/commit-surface-repartition-result.js",
  "src/adapters/surface/clear-surface-review-layers.js",
  "src/application/surface/repartition-surface-review.js",
  "src/domain/surface/classify-surface-review-data-change.js",
  "src/application/surface/reset-surface-review-data-change.js",
  "src/application/surface/prepare-surface-review-session.js",
  "src/ui/mount-surface-review-map-host.js",
  "src/application/surface/finish-surface-review-mount.js",
  "src/domain/surface/build-surface-export-data.js",
  "src/domain/surface/prepare-surface-export-map-frame.js",
  "src/ui/render-surface-export-layer-dialog.js",
  "src/ui/draw-surface-export-map-layers.js",
  "src/ui/render-surface-export-infographic.js",
  "src/ui/lc-sens.js",
  "src/domain/surface/quality-gates.js",
  "src/contracts/surface-analysis.js",
  "src/application/surface/run-analysis.js",
  "src/services/landcover.js"
];

let DG_LULC_PROMISE=null;
let DG_LULC_LOADED=0; // Resume after a failed download; classic const/let modules cannot execute twice.

function dgLoadScriptOrdered(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=dgRuntimeScriptUrl(src);
    s.async=false;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error(src+" yüklenemedi"));
    document.head.appendChild(s);
  });
}

function dgEnsureLulc(){
  if(window.DG_LANDCOVER)return Promise.resolve();
  if(!DG_LULC_PROMISE){
    DG_LULC_PROMISE=DG_LULC_CHAIN.slice(DG_LULC_LOADED)
      .reduce((z,src)=>z.then(()=>dgLoadScriptOrdered(src)).then(()=>{DG_LULC_LOADED++;}),Promise.resolve())
      .then(()=>{
        if(!window.DG_LANDCOVER)throw new Error("LULC zinciri yüklendi ama DG_LANDCOVER facade oluşmadı");
      })
      .catch(err=>{DG_LULC_PROMISE=null;throw err;});
  }
  return DG_LULC_PROMISE;
}

window.dgEnsureGeoTIFF=dgEnsureGeoTIFF;
window.dgEnsureChart=dgEnsureChart;
window.dgEnsureLulc=dgEnsureLulc;

/* 2026-10-03 · saha ölçeği düzeltmeleri ayrı dosyada tutulur. Dosya DOM ve
 * ana servisler hazır olduktan sonra bir kez yüklenir; LULC'nin kendisi hâlâ
 * tembel yüklenir. Böylece 77/300 waypoint UX'i ve GPS yardımı ilk anda hazır,
 * yüzey patch'i ise dgEnsureLulc tamamlanınca devreye girer. */
let DG_FIELD_UX_PROMISE=null;
function dgEnsureFieldUx(){
  if(window.DG_FIELD_UX)return Promise.resolve();
  if(!DG_FIELD_UX_PROMISE){
    DG_FIELD_UX_PROMISE=dgLoadVendorScript("src/services/field-ux.js")
      .catch(err=>{DG_FIELD_UX_PROMISE=null;throw err;});
  }
  return DG_FIELD_UX_PROMISE;
}
window.dgEnsureFieldUx=dgEnsureFieldUx;
const dgBootFieldUx=()=>dgEnsureFieldUx().catch(err=>console.warn("DENDROGEO · saha UX yüklenemedi:",err));
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",dgBootFieldUx,{once:true});else dgBootFieldUx();
