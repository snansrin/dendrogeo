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

window.dgEnsureGeoTIFF=dgEnsureGeoTIFF;
window.dgEnsureChart=dgEnsureChart;
