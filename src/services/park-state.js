"use strict";
/* DendroGeo · services/park-state.js — PARK/GRID PAYLAŞILAN STATE (Faz 4)
 * gridplan.js'in üst düzey let/const bildirimleri birebir buraya taşındı.
 * YÜKLEME SIRASI: park zincirinin İLK dosyasıdır (park-state → osm-client →
 * park-geometry → park-query → grid-engine → ui/park-panel → ui/park-export).
 * Klasik script'lerde üst düzey let global lexical kapsamda yaşar; diğer
 * park modülleri bu isimleri çağrı anında çözer (eski tek-dosya semantiği). */

/* ↓ Aşağıdaki not eski gridplan.js'in başlık yorumuydu (Faz 4'te dosya yedi
 * modüle bölündü); sürüm-numarası politikası tüm modüller için geçerli: */
/* DendroGeo · gridplan.js (eski) — örneklem ızgarası planlayıcı (UI köprüsü)
 *
 * SÜRÜM NUMARALARI HAKKINDA: bu dosyanın sürümü index.html'deki ?v=NNN sorgu
 * dizesidir. Eskiden burada ayrıca bir sürüm ibaresi duruyordu ve üç ayrı
 * sürüm numarası (dosya içi yorum, ?v=, sw.js CACHE_VERSION) elle senkron
 * tutulmak zorundaydı — dosya içi ibare kaldırıldı ki tek kaynak ?v= olsun.
 *
 * sw.js r32'den beri uygulama JS/CSS'i network-first ile yükleniyor ve
 * controllerchange'te tek seferlik reload yapıyor; yani ?v= artırımı artık
 * ZORUNLU DEĞİL, yalnızca önbelleği deterministik kırmak için kullanışlı.
 *
 * Arazi örtüsü / raster analizi bu dosyada DEĞİL, src/services/landcover.js
 * içindedir (native 10 m COG motoru). Bu modül ızgara üretimi, park
 * geometrisi, waypoint planlaması ve raporlama katmanıdır. */
  
let PARK_POLY=null;

let PARK_HOLES=[];

let PARK_LAYER=null;

let PARK_MODE=false;

let PARK_CLICK_BOUND=false;

let PARK_CANDS=[];

let WATER_RINGS=[];

let WATER_LINES=[];

let WATER_LAYER=null;

let IMP_RINGS=[];

let IMP_LINES=[];

let IMP_LAYER=null;

let GRID_BLOCK_LINES=[];

const GRID_CELLS=[];

let GRID_LAYER=null;

let WP_AUTO_LAYER=null;

const SELECTED_CELLS=new Set();

let LAST_WP_ROWS=[];

let PARK_REF_HA=null;

/* Grid yalnızca LULC yeşil alanında kurulsun mu? (kullanıcı isteği 2026-09-20:
 * "sadece yeşil alanda grid çizimi yaptıralım, ona göre waypoint seçeriz")
 * Analiz yapılmamışsa otomatik olarak etkisizdir. */
let DG_GREEN_ONLY=true;

let PARK_SELECTED_AREA_M2=null;

const WATER_CLEARANCE_M=1;

const IMP_CLEARANCE_M=1;
