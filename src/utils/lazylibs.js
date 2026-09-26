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
 *
 * ÇAĞRI NOKTALARI:
 *   · landcover.js (facade) dgLcAnalyze → await dgEnsureGeoTIFF()
 *   · dash.js drawChart                 → await dgEnsureChart()
 *
 * ÇEVRİMDIŞI: sw.js bu iki vendor dosyasını PRECACHE'te tutmaya DEVAM eder
 * (CORE_ASSETS); aynı-köken script isteği network-first→PRECACHE rotasından
 * servis edilir, yani çevrimdışı LULC/panel davranışı değişmez.
 *
 * QA NOTU: scripts/lulc-qa.mjs vm bağlamında GeoTIFF'i önceden yükler ve
 * dgEnsureGeoTIFF tanımlı değildir; facade'taki çağrı `window.dgEnsureGeoTIFF`
 * VARSA yapılır — QA bu sayede etkilenmez. */

let DG_GEO_PROMISE=null;
let DG_CHART_PROMISE=null;

function dgLoadVendorScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=src;
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
/* NEDEN: 8 dosya (lc-config, lc-geo, lc-stac, lc-engine, lc-osm, lc-patches,
 * ui/lc-report, landcover facade) her ziyaretçide senkron iniyordu; oysa
 * yalnız "🌿 Yüzey Örtüsü Analizi"ne basan kullanıcı gerekiyor. İlk yüklemede
 * 8 istek ve ~20 KB (gzip) azaldı.
 *
 * SIRA ŞART: zincir birbirinin global'lerini çağrı anında çözer ama facade
 * (landcover.js) YÜKLEME ANINDA lc-* global'lerine dokunur → sıralı yüklenmeli.
 * Dinamik eklenen script'lerde async=false yürütme sırasını belge sırasına
 * sabitler (indirmeler paralel, yürütme sıralı).
 *
 * ?v= KULLANILMIYOR: sw.js network-first + PRECACHE zaten tazelik sağlıyor
 * (depodaki sürüm politikası notu: "?v= artık ZORUNLU DEĞİL"). CORE_ASSETS
 * sorgusuz yolları tuttuğu için çevrimdışı davranış değişmez. */
const DG_LULC_CHAIN=[
  "src/services/lc-config.js",
  "src/services/lc-geo.js",
  "src/services/lc-stac.js",
  "src/services/lc-engine.js",
  "src/services/lc-osm.js",
  "src/services/lc-patches.js",
  "src/ui/lc-report.js",
  "src/services/landcover.js"
];

let DG_LULC_PROMISE=null;

function dgLoadScriptOrdered(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=src;
    s.async=false;           /* yürütme sırası belge sırası olsun */
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error(src+" yüklenemedi"));
    document.head.appendChild(s);
  });
}

function dgEnsureLulc(){
  if(window.DG_LANDCOVER)return Promise.resolve();
  if(!DG_LULC_PROMISE){
    DG_LULC_PROMISE=DG_LULC_CHAIN
      .reduce((z,src)=>z.then(()=>dgLoadScriptOrdered(src)),Promise.resolve())
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
