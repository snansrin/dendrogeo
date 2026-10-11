"use strict";
/* DendroGeo · ui/park-panel.js — PARK MODU + SONUÇ PANELİ (Faz 4)
 * gridplan.js'ten birebir taşındı: park modu aç/kapa, harita tıklama
 * bağlama, park çizimi + bilgi paneli (drawPark), temizleme, parklar arası
 * geçiş, greenOnly/refHa kontrolleri. Stilleri css/park-panel.css'tedir
 * (eski ensurePngUiStyles CSS-in-JS enjeksiyonu Faz 4'te gerçek dosyaya
 * taşındı; fonksiyon ve drawPark içindeki çağrısı kaldırıldı — tek fark bu).
 * Bağımlılıklar (çağrı anında global): park-state.*, park-geometry.*,
 * park-query.*, grid-engine.*, $, esc, toast, L, map. */

function setGreenOnly(v){
  DG_GREEN_ONLY=!!v;
  if(PARK_POLY&&PARK_POLY.length&&DG_GRID_SESSION.getCells().length){
    buildGrid();
  }
}

window.setGreenOnly=setGreenOnly;

/* Reference-area helpers are intentionally local to the active gridplan module.
 * gridplan_core.js is an older parallel implementation and is not loaded by index.html. */
const DG_PARK_REFERENCE_AREA=window.DG_PARK_REFERENCE_AREA_UI.create({
 getElement:()=>$("refBadge"),getReference:()=>PARK_REF_HA,
 setReference:value=>{PARK_REF_HA=value;},getPark:()=>PARK_POLY,getAreaHa:()=>parkAreaHa()
});
function setRefHa(value){return DG_PARK_REFERENCE_AREA.set(value);}
function renderRefBadge(){return DG_PARK_REFERENCE_AREA.render();}

/* =========================================================
   PARK MODE
========================================================= */

const DG_PARK_MODE_CONTROLLER=window.DG_PARK_MODE_CONTROLLER_UI.create({
 getMode:()=>PARK_MODE,setMode:value=>{PARK_MODE=value;},
 getButton:()=>$("parkModeBtn"),getHint:()=>$("parkModeHint"),
 bindClick:()=>bindParkClick(),clearCandidates:()=>{PARK_CANDS=[];},
 clear:()=>clearPark(),getMap:()=>map,notify:(...args)=>toast(...args)
});
function toggleParkMode(){return DG_PARK_MODE_CONTROLLER();}

const DG_PARK_CLICK_CONTROLLER=window.DG_PARK_CLICK_CONTROLLER_UI.create({
 isBound:()=>PARK_CLICK_BOUND,setBound:value=>{PARK_CLICK_BOUND=value;},getMap:()=>map,
 getMode:()=>PARK_MODE,isReviewActive:()=>window._dgSensGuard,
 detect:(lat,lng)=>dgDetectAt(lat,lng),logError:(...args)=>console.error(...args),
 notify:(...args)=>toast(...args)
});
function bindParkClick(){return DG_PARK_CLICK_CONTROLLER();}

/* =========================================================
   DRAW PARK (MODERN UI)
========================================================= */

async function drawPark(park){
  PARK_SELECTED_AREA_M2=Number.isFinite(Number(park?.area)) ? Number(park.area) : null;

  /*
   * queryPark artık sadece park geometrisini getiriyor.
   * clearPark() güvenle çalışabilir; su/yüzey verisi
   * yüzey analizinde tek sorguyla yüklenecek.
   */
  clearPark();
  clearGrid();

  /* PARK KİMLİĞİ (2026-09-24): algılanan park public.parks'a yazılır / oradan
   * okunur. clearPark() oturum kimliğini sıfırladığı için kayıt BURADA (sonra)
   * başlatılır; await ise aşağıda, ağır OSM yüzey sorgusuyla paralel yürür. */
  const parkRegPromise=(typeof dgOnParkDrawn==="function")
    ? dgOnParkDrawn(park)
    : Promise.resolve(null);

  const parkRings=park&&park.rings;

  const validOuter=Array.isArray(parkRings)
    ? parkRings
    : (
      parkRings &&
      Array.isArray(parkRings.outer)
        ? parkRings.outer
        : null
    );

  if(!validOuter || !validOuter.some(r=>Array.isArray(r)&&r.length>=4)){
    console.error("DENDROGEO · Geçersiz park geometrisi:",park);
    return toast("Park geometrisi geçersiz veya eksik.","err","🌳");
  }

  PARK_POLY=validOuter;

  PARK_HOLES=
    Array.isArray(parkRings)
      ? []
      : (
        parkRings &&
        Array.isArray(parkRings.inner)
          ? parkRings.inner.filter(r=>Array.isArray(r)&&r.length>=4)
          : []
      );

  window.DG_PARK_BOUNDARY_LAYER_UI.render({
   leaflet:L,map,outer:PARK_POLY,holes:PARK_HOLES,onCreated:layer=>{PARK_LAYER=layer;}
  });

  /*
   * OSM hard-exclusion geometry MUST be loaded before the grid can be
   * considered valid. Previously queryDetailedCoverage() existed but was
   * never called from drawPark(), which meant buildings, roads, parking
   * and water arrays stayed empty and the grid could be drawn over them.
   */
  const coverageOk=await queryDetailedCoverage();
  if(!coverageOk){
    console.warn("DENDROGEO QC: OSM detailed coverage could not be loaded.");
    toast("⚠ OSM bina/yol/su geometrisi alınamadı; grid bilimsel olarak eksik olabilir.","warn","🗺️");
  }

  /* Su katmanı yüzey sorgusundan sonra refreshWaterLayer() ile çizilir. */

  /* =====================================================
     PARK BOUNDS (manuel, L.layerGroup getBounds yok)
  ===================================================== */

  window.DG_PARK_BOUNDARY_LAYER_UI.fit({leaflet:L,map,outer:PARK_POLY,holes:PARK_HOLES});

  const haTotal =
    parkAreaHa().toFixed(1);

  /* Kimlik satırı hazır mı? (kayıt başarısızsa null → kart uyarı gösterir) */
  const parkRow=await parkRegPromise;
  const parkProjects=(typeof PROJ_LIST!=="undefined"&&PROJ_LIST&&parkRow)
    ? PROJ_LIST.filter(p=>p.park_id===parkRow.id)
    : [];

  const alt=window.DG_PARK_CANDIDATE_SELECT_UI.render({
    candidates:PARK_CANDS,selected:park,escape:esc,formatArea:value=>value.toFixed(1)
  });

  $("parkInfo").style.display="block";

  $("parkInfo").innerHTML=window.DG_PARK_INFO_PANEL_UI.render({
    name:park.name,escape:esc,hectares:haTotal,
    parkIdChip:dgParkIdChip(parkRow),
    registerRetryMarkup:!parkRow?`<div class="dg-png-card"><button class="dg-png-btn red sm" onclick="dgRetryRegister()">🔄 Yeniden dene</button></div>`:"",
    alternateSelector:alt,
    projectOptionsMarkup:dgProjectOptionsForPark(parkRow?parkRow.id:null,true)
  });

  dgParkMountMenus();
  renderRefBadge();

  toast(
    (typeof dgCf==="function"?dgCf("✓ Park algılandı: "):"✓ Park algılandı: ")+
    ((parkRow&&parkRow.name)||park.name||"")+
    " · "+haTotal+" ha"+
    (parkRow?" · "+(typeof dgCf==="function"?dgCf("kimlik #"):"kimlik #")+parkRow.id:""),
    "ok",
    "🌳"
  );
}

/* =========================================================
   CLEAR
========================================================= */

const DG_PARK_RESET_CONTROLLER=window.DG_PARK_RESET_CONTROLLER_UI.create({
 clearMenus:()=>{const menus=document.getElementById("surfaceParkTools");if(menus)menus.replaceChildren();dgEditorClearMenus("park");},
 getMap:()=>map,layers:[
  {get:()=>PARK_LAYER,clear:()=>{PARK_LAYER=null;}},
  {get:()=>WATER_LAYER,clear:()=>{WATER_LAYER=null;}},
  {get:()=>IMP_LAYER,clear:()=>{IMP_LAYER=null;}}
 ],
 resetGeometry:()=>{PARK_POLY=null;PARK_HOLES=[];PARK_SELECTED_AREA_M2=null;},
 resetIdentity:()=>{if(typeof dgResetParkIdentity==="function")dgResetParkIdentity();},
 cleanupReview:()=>{if(window.DG_LC_SENS&&typeof window.DG_LC_SENS.cleanup==="function")window.DG_LC_SENS.cleanup();},
 resetSurface:()=>{WATER_RINGS=[];WATER_LINES=[];IMP_RINGS=[];IMP_LINES=[];GRID_BLOCK_LINES=[];}
});
function clearPark(){return DG_PARK_RESET_CONTROLLER();}

function switchPark(i){
  const p=PARK_CANDS[i];

  if(p){
    drawPark(p);
  }
}

window.toggleParkMode=toggleParkMode;
window.dgToggleParkMode=toggleParkMode;

window.bindParkClick=bindParkClick;

window.clearPark=clearPark;

const DG_CHOOSE_NEW_PARK_CONTROLLER=window.DG_CHOOSE_NEW_PARK_CONTROLLER_UI.create({
 isBusy:()=>window._dgLandCoverBusy||window.DG_LC_SENS?.state?.saving||window.DG_LC_SENS?.state?.exporting,
 getSave:()=>window.DG_LC_SENS?.state?.record&&typeof dgSensSave==="function"?()=>dgSensSave():null,
 clearPark:()=>clearPark(),clearGrid:()=>clearGrid(),
 clearAnalysis:()=>{if(window.DG_LANDCOVER?.clear)window.DG_LANDCOVER.clear();},
 hideInfo:()=>{const info=$("parkInfo");if(info){info.style.display="none";info.innerHTML="";}},
 getMode:()=>PARK_MODE,toggleMode:()=>toggleParkMode(),bindClick:()=>bindParkClick(),
 resizeMap:()=>map?.invalidateSize({pan:false}),
 scrollMap:()=>document.getElementById("map")?.scrollIntoView({block:"nearest"}),
 notify:()=>toast(_tgrSafeNewPark(),"info","📍")
});
async function dgChooseNewPark(){return DG_CHOOSE_NEW_PARK_CONTROLLER();}
function _tgrSafeNewPark(){return typeof dgCf==="function"?dgCf("Haritada yeni parkın içine dokunun."):"Haritada yeni parkın içine dokunun.";}
window.dgChooseNewPark=dgChooseNewPark;

/* Relocate the existing controls, keeping their IDs, values and event handlers. */
function dgParkMountMenus(){
 return window.DG_PARK_MENU_UI.mount({
  document,clearMenus:dgEditorClearMenus,arrangeMenus:dgEditorArrangeMenus,
  translate:value=>typeof dgCf==="function"?dgCf(value):value,
  escape:value=>typeof esc==="function"?esc(value):value,
  editorUi:window.DG_EDITOR_UI
 });
}
function dgEditorClearMenus(owner){return window.DG_PARK_MENU_UI.clear({document,owner});}
function dgEditorArrangeMenus(){return window.DG_PARK_MENU_UI.arrange({document});}
window.DG_PARK_MENU_UI.bindDismissal(document);
