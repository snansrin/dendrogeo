"use strict";
/* DendroGeo · services/lc-config.js — LULC yapılandırması + paylaşılan state (Faz 5)
 * landcover.js'ten birebir taşındı: STAC uçları, kaynak tanımları
 * (primary=ESA WorldCover 2021 v200, cross=IO LULC 2020), sınıf/kod
 * haritaları, renk paleti, limitler ve DG_LC_LAYER/DG_LC_LAST durumu.
 * YÜKLEME SIRASI: lc-config → lc-geo → lc-stac → lc-engine → lc-osm →
 * lc-patches → ui/lc-report → landcover (facade). */

/* DendroGeo · 10 m Land Cover Engine v3
 * Native UTM COG + STAC + polygon/cell coverage analysis.
 *
 * The application does NOT query a live imagery service for classification.
 * It reads the published annual categorical land-cover COG that matches the
 * native 10 m UTM tiling grid, then computes each raster-cell intersection
 * with the selected park polygon.
 */

/* ---------------------------------------------------------------------------
 * ÇİFT KAYNAKLI ARAZİ ÖRTÜSÜ MOTORU (v4)
 *
 * BİRİNCİL: ESA WorldCover 2021 (v200) — 10 m, Sentinel-1 + Sentinel-2 füzyonu,
 *   11 tematik sınıf. Park ölçeğinde en güvenilir tematik ürün: ağaç / çayır /
 *   yapılı / su ayrımını io-lulc'dan belirgin biçimde daha iyi yapar.
 *   COG'lar EPSG:4326'dır → hücreler metrede anizotropiktir (~7,1 x 9,3 m,
 *   enleme bağlı). Bu yüzden hücreler analiz UTM'sine köşelerinden
 *   projekte edilir ve alanlar TAM dışbükey kesişimle hesaplanır.
 *
 * ÇAPRAZ: IO LULC yıllık 2020 — 10 m, UTM karoları. Bağımsız ikinci görüş;
 *   grup başına UZLAŞMA yüzdesi raporlanır (belirsizlik göstergesi).
 *   Bu kaynakta 2020 dışındaki yılların karışması QA hatasına yol açtığı
 *   için (bkz. dgLcFindTiles yıl filtresi) sonuçlar yıl süzgecinden geçer.
 * ------------------------------------------------------------------------- */
const DG_LC_STAC="https://planetarycomputer.microsoft.com/api/stac/v1";

const DG_LC_SOURCES={
  primary:{
    key:"primary",
    collection:"esa-worldcover",
    year:2021,
    assetKeys:["map","data"],
    label:"ESA WorldCover 10 m · 2021 (v200)",
    citation:"ESA WorldCover 10 m 2021 v200, CC BY 4.0",
  },
  cross:{
    key:"cross",
    collection:"io-lulc-annual-v02",
    year:2020,
    assetKeys:["data","lulc"],
    label:"IO LULC 10 m · 2020 (çapraz doğrulama)",
    citation:"Impact Observatory 10m Annual LULC v02, CC BY 4.0",
  },
};

/* Geriye dönük uyumluluk için eski sabitler */
const DG_LC_COLLECTION=DG_LC_SOURCES.cross.collection;

const DG_LC_YEAR=DG_LC_SOURCES.cross.year;

const DG_LC_SAS="https://planetarycomputer.microsoft.com/api/sas/v1/token/";

/* ESA WorldCover sınıf kodları → DendroGeo rapor grupları */
const DG_ESA_CODES={
  10:"Ağaç",20:"Çalı",30:"Çayır",40:"Tarım",50:"Yapılı",60:"Çıplak",
  70:"Kar/buz",80:"Su",90:"Otsu sulak",95:"Mangrov",100:"Yosun",
};

const DG_ESA_GROUP={
  10:"green",20:"green",30:"green",40:"green",95:"green",100:"green",
  50:"hard",60:"bare",70:"other",80:"water",90:"water",
};

const DG_LC_PIXEL_M=10;

const DG_LC_MAX_TILES=12;

const DG_LC_MAX_READ_PIXELS=2500000;

const DG_LC_RENDER_LIMIT=6000;

const DG_LC_CODES={
  1:"Su",
  2:"Ağaç",
  4:"Taşkın vejetasyon",
  5:"Tarım",
  7:"Yapılı alan",
  8:"Çıplak zemin",
  9:"Kar/buz",
  10:"Bulut",
  11:"Mera/rangeland"
};

/* Harita + rapor renk paleti (kullanıcı tercihi, 2026-09-20):
 *   yeşil = AÇIK yeşil · su = mavi · sert zemin = gri · çıplak = kahverengi
 * Harita katmanları ŞEFFAF çizilir (fillOpacity .38 / opacity .50). */
const DG_LC_CLASSES=[
  {key:"green",label:"Yeşil alan",emoji:"🌿",codes:[2,4,5,11],color:"#4ade80"},
  {key:"water",label:"Su",emoji:"💧",codes:[1],color:"#3b82f6"},
  {key:"hard",label:"Sert zemin",emoji:"🧱",codes:[7],color:"#64748b"},
  {key:"bare",label:"Çıplak zemin",emoji:"🟫",codes:[8],color:"#8b5a2b"},
  {key:"other",label:"Diğer",emoji:"⬜",codes:[],color:"#94a3b8"}
];

let DG_LC_LAYER=null;

let DG_LC_LAST=null;
