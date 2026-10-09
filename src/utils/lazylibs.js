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
  "src/services/lc-geo.js",
  "src/services/lc-stac.js",
  "src/domain/surface/merge-tile-results.js",
  "src/adapters/surface/result-exports.js",
  "src/application/surface/analyze-source.js",
  "src/adapters/surface/process-landcover-tile.js",
  "src/services/lc-engine.js",
  "src/services/lc-osm.js",
  "src/domain/surface/patch-geometry.js", "src/domain/surface/group-patch-cells.js", "src/domain/surface/measure-patch-components.js", "src/domain/surface/query-green-patches.js",
  "src/services/lc-patches.js",
  /* UYDU HASSASİYET (0054 · 2026-10-03): lc-validate eşik/metrics çekirdeği
   * + lc-s2 Sentinel-2 spektral kanıt + ui/lc-sens basit kaydırıcı paneli
   * (0053'teki üç adımlı workbench kullanıcı isteğiyle kaldırıldı). */
  "src/services/lc-validate.js",
  "src/services/lc-s2.js",
  "src/ui/lc-report.js",
  "vendor/polygon-clipping-0.15.7.js",
  "src/services/lc-review.js",
  "src/ui/lc-sens.js",
  "src/domain/surface/quality-gates.js",
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
