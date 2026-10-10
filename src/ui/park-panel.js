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

  const alt=
    PARK_CANDS.length>1
      ?
      `<select id="parkAlt" onchange="switchPark(+this.value)" style="font-size:.8rem;padding:4px 8px;border-radius:6px;border:1px solid var(--line)">`+
      PARK_CANDS
        .map(
          (c,i)=>
            `<option value="${i}"${c===park?" selected":""}>`+
            `${esc(c.name||"Alan "+(i+1))} · ${(c.area/10000).toFixed(1)} ha`+
            `</option>`
        )
        .join("")+
      `</select>`
      :
      "";

  $("parkInfo").style.display="block";

  $("parkInfo").innerHTML=

    `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">`+
      `<b style="font-size:1.15rem">🌳 ${esc(park.name||"İsimsiz Park")}</b>`+
      `<span class="dg-png-badge">`+
        `${haTotal} ha`+
      `</span>`+
      dgParkIdChip(parkRow)+
      `<span id="refBadge" class="dg-png-ref" style="display:none"></span>`+
      alt+
    `</div>`+

    (!parkRow?`<div class="dg-png-card"><button class="dg-png-btn red sm" onclick="dgRetryRegister()">🔄 Yeniden dene</button></div>`:"")+

    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">`+

      `<div id="parkGridTools" class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">1 · GRID & WAYPOINT</div>`+
            `<div class="dg-png-title">🔲 Grid sistemi</div>`+
            `<div class="dg-png-sub">Ölçüm alanını otomatik böl</div>`+
          `</div>`+
        `</div>`+

        `<div class="dg-png-fields">`+
          `<div class="dg-png-field">`+
            `<label class="dg-png-label">PROJE</label>`+
            `<select id="gridProject" class="dg-png-select">`+
              /* Yalnız bu parka bağlı projeler: waypoint/grid yanlış parka
               * yazılmasın. Parkın projesi yoksa eski liste yedek olarak
               * gösterilir (şema eski/park bağı yokken araç kilitlenmesin). */
              dgProjectOptionsForPark(parkRow?parkRow.id:null,true)+
            `</select>`+
          `</div>`+

          `<div class="dg-png-field">`+
            `<label class="dg-png-label">GRID BOYUTU</label>`+
            `<select id="gridSize" class="dg-png-select">`+
              `<option value="10">10 × 10 m · Hassas</option>`+
              `<option value="20" selected>20 × 20 m · Standart</option>`+
              `<option value="50">50 × 50 m · Hızlı</option>`+
            `</select>`+
          `</div>`+

          `<div class="dg-png-field">`+
            `<label class="dg-png-label">REFERANS ALAN (HA)</label>`+
            `<input id="refHa" type="number" step="0.1" placeholder="örn. 50.8" class="dg-png-input" onchange="setRefHa(this.value)">`+
          `</div>`+
        `</div>`+

        `<label class="dg-png-option" style="margin:2px 0 8px">`+
          `<span class="dg-png-icon">🌿</span>`+
          `<span class="dg-png-copy">`+
            `<strong>Sadece yeşil alan</strong>`+
            `<span>Grid'i arazi örtüsü analizinin yeşil alanlarıyla kısıtla</span>`+
          `</span>`+
          `<input type="checkbox" id="chkGreenOnly" checked onchange="setGreenOnly(this.checked)">`+
          `<span class="dg-png-switch"></span>`+
        `</label>`+

        `<div class="dg-png-field"><label class="dg-png-label" for="gridClearance">SU / SERT ZEMİN MESAFESİ (M)</label><input id="gridClearance" class="dg-png-input" type="number" min="1" max="20" step="1" value="3"></div><button id="gridBuildBtn" class="dg-png-btn primary" onclick="buildGrid()">`+
          `🔲 Grid Oluştur`+
        `</button>`+
      `</div>`+

      `<div id="parkSurfaceAction" class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">2 · YÜZEY ANALİZİ</div>`+
            `<div class="dg-png-title">🌿 Arazi örtüsü</div>`+
            `<div class="dg-png-sub">Bina · yol · otopark · saha · su</div>`+
          `</div>`+
          `<span class="dg-png-badge blue">10 m WorldCover 2021 · IO LULC çapraz</span>`+
        `</div>`+

        `<button id="landCoverBtn" class="dg-png-btn primary" onclick="runLandCoverAnalysis()">`+
          `🌿 Yüzey Örtüsü Analizi`+
        `</button>`+

        `<div class="dg-png-sub" style="font-size:.68rem">`+
          `Park polygonu + 10 m raster (ESA WorldCover 2021 v200 birincil, IO LULC 2020 çapraz) ile coverage-weighted zonal analiz.`+
        `</div>`+
      `</div>`+

      `<div id="parkRasterExport" class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">3 · RAPOR PNG</div>`+
            `<div class="dg-png-title">🖼️ Harita çıktısı</div>`+
            `<div class="dg-png-sub">Park şeklinde yüksek çözünürlük</div>`+
          `</div>`+
        `</div>`+

        `<div class="dg-png-field">`+
          `<label class="dg-png-label">ALTLIK</label>`+
          `<select id="pngBg" class="dg-png-select">`+
            `<option value="vector">Vektör · Temiz beyaz</option>`+
            `<option value="osm">OSM · Sokak</option>`+
            `<option value="sat">Uydu</option>`+
            `<option value="topo">Topoğrafik</option>`+
          `</select>`+
        `</div>`+

        `<div class="dg-png-field">`+
          `<label class="dg-png-label">GÖRÜNÜM KATMANLARI</label>`+
          `<div class="dg-png-options">`+

            `<label class="dg-png-option">`+
              `<span class="dg-png-icon">🔲</span>`+
              `<span class="dg-png-copy">`+
                `<strong>Grid hücreleri</strong>`+
                `<span>Analiz hücrelerini göster</span>`+
              `</span>`+
              `<input type="checkbox" id="chkPngGrid" checked>`+
              `<span class="dg-png-switch"></span>`+
            `</label>`+

            `<label class="dg-png-option">`+
              `<span class="dg-png-icon">📍</span>`+
              `<span class="dg-png-copy">`+
                `<strong>Waypoint'ler</strong>`+
                `<span>Ölçüm noktaları</span>`+
              `</span>`+
              `<input type="checkbox" id="chkPngWp" checked>`+
              `<span class="dg-png-switch"></span>`+
            `</label>`+

            `<label class="dg-png-option">`+
              `<span class="dg-png-icon">💧</span>`+
              `<span class="dg-png-copy">`+
                `<strong>Su / sert zemin</strong>`+
                `<span>Yapısal yüzeyler</span>`+
              `</span>`+
              `<input type="checkbox" id="chkPngCover" checked>`+
              `<span class="dg-png-switch"></span>`+
            `</label>`+

          `</div>`+
        `</div>`+

        `<button class="dg-png-btn ghost" onclick="downloadParkImage()">`+
          `🖼️ PNG İndir`+
        `</button>`+
      `</div>`+

      `<div id="parkLayerTools" class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">4 · KATMANLAR</div>`+
            `<div class="dg-png-title">🗺️ Görünürlük</div>`+
            `<div class="dg-png-sub">Harita üzerindeki katmanlar</div>`+
          `</div>`+
        `</div>`+

        `<div class="dg-png-options">`+

          `<label class="dg-png-option">`+
            `<span class="dg-png-icon">🔲</span>`+
            `<span class="dg-png-copy">`+
              `<strong>Grid hücreleri</strong>`+
              `<span>Harita üzerinde göster</span>`+
            `</span>`+
            `<input type="checkbox" id="togGrid" checked onchange="toggleGridVis()">`+
            `<span class="dg-png-switch"></span>`+
          `</label>`+

          `<label class="dg-png-option">`+
            `<span class="dg-png-icon">📍</span>`+
            `<span class="dg-png-copy">`+
              `<strong>Waypoint'ler</strong>`+
              `<span>Ölçüm noktalarını göster</span>`+
            `</span>`+
            `<input type="checkbox" id="togWp" checked onchange="toggleWpVis()">`+
            `<span class="dg-png-switch"></span>`+
          `</label>`+

        `</div>`+

        `<button class="dg-png-btn red sm" onclick="clearGrid()">`+
          `✕ Tümünü Temizle`+
        `</button>`+
      `</div>`+

    `</div>`+

    `<div id="landCoverReport" class="dg-png-result" style="display:none"></div>`+
    /* 0054 · 🛰 UYDU HASSASİYET PANELİ: yüzey analizi bitince köprü
     * (park-export.js) buraya lc-sens'i monte eder — rapor barlarının
     * hemen altında sınıf başına hassasiyet kaydırıcıları + uydu görüntüsü
     * üzerinde aday işaretleme + tek dokunuşla kalıcı onay. */
    `<div id="lcSens" class="dg-png-result" style="display:none"></div>`+
    `<div id="gridSummary" class="dg-png-result" style="display:none"></div>`;

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
 const host=document.getElementById("surfaceParkTools");if(!host)return;
 dgEditorClearMenus("park");
 host.replaceChildren();
 const nav=document.createElement("nav");nav.className="dg-editor-menubar";nav.setAttribute("aria-label",typeof dgCf==="function"?dgCf("Harita menüsü"):"Harita menüsü");
 for(const [id,label,icon,description] of [["parkGridTools","Grid & Waypoint","grid","Grid oluşturma ve waypoint araçları"],["parkLayerTools","Katmanlar","layers","Haritada gösterilecek katmanlar"]]){
  const controls=document.getElementById(id);if(!controls)continue;
  const menu=document.createElement("details");menu.className="dg-editor-menu";menu.setAttribute("data-menu-owner","park");menu.setAttribute("data-menu-order",id==="parkGridTools"?"30":"40");
  const title=typeof dgCf==="function"?dgCf(label):label,subtitle=typeof dgCf==="function"?dgCf(description):description,safeTitle=typeof esc==="function"?esc(title):title,safeSubtitle=typeof esc==="function"?esc(subtitle):subtitle;
  const editorUi=typeof window!=="undefined"?window.DG_EDITOR_UI:null;
  const summary=document.createElement("summary");summary.innerHTML=editorUi?.menuLabel(icon,safeTitle)||safeTitle+" ⌄";
  const body=document.createElement("div");body.className="dg-editor-menu-body";body.innerHTML=editorUi?.panelHead(icon,safeTitle,safeSubtitle)||"";body.append(controls);
  if(id==="parkGridTools"){const summary=document.getElementById("gridSummary");if(summary)body.append(summary);}
  menu.append(summary,body);menu.addEventListener("toggle",()=>{if(menu.open)(document.getElementById("surfaceMenuBar")||nav).querySelectorAll("details[open]").forEach(other=>{if(other!==menu)other.open=false;});});nav.append(menu);
 }
 host.append(nav);dgEditorArrangeMenus();
}
if(typeof document.addEventListener==="function"){
 document.addEventListener("pointerdown",e=>{if(!e.target.closest?.("#surfaceEditorMenu"))document.querySelectorAll("#surfaceEditorMenu details[open]").forEach(menu=>{menu.open=false;});});
 document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;document.querySelectorAll("#surfaceEditorMenu details[open]").forEach(menu=>{menu.open=false;menu.querySelector("summary")?.focus();});});
}

/* Presentation only: move menu nodes without cloning their controls. */
function dgEditorClearMenus(owner){
 const bar=document.getElementById("surfaceMenuBar");if(!bar?.append)return;
 bar.querySelectorAll('[data-menu-owner="'+owner+'"]').forEach(menu=>menu.remove());
}
function dgEditorArrangeMenus(){
 const bar=document.getElementById("surfaceMenuBar");if(!bar?.append)return;
 for(const id of ["surfaceParkTools","surfaceBrushTools"]){
  document.getElementById(id)?.querySelectorAll(".dg-editor-menu").forEach(menu=>bar.append(menu));
 }
 [...bar.children].sort((a,b)=>Number(a.dataset.menuOrder)-Number(b.dataset.menuOrder)).forEach(menu=>bar.append(menu));
}
