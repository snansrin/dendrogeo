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
  if(PARK_POLY&&PARK_POLY.length&&GRID_CELLS.length){
    buildGrid();
  }
}

window.setGreenOnly=setGreenOnly;

/* Reference-area helpers are intentionally local to the active gridplan module.
 * gridplan_core.js is an older parallel implementation and is not loaded by index.html. */
function setRefHa(v){
  const n=parseFloat(v);
  PARK_REF_HA=Number.isFinite(n)&&n>0?n:null;
  renderRefBadge();
}

function renderRefBadge(){
  const el=$("refBadge");
  if(!el) return;
  if(!(PARK_REF_HA>0) || !PARK_POLY){
    el.style.display="none";
    el.textContent="";
    return;
  }
  const ha=parkAreaHa();
  if(!(ha>0)){
    el.style.display="none";
    el.textContent="";
    return;
  }
  const dev=Math.abs(((ha-PARK_REF_HA)/PARK_REF_HA)*100);
  el.style.display="inline-flex";
  el.textContent="Referans: "+PARK_REF_HA.toFixed(2)+" ha · Sapma: %"+dev.toFixed(1);
  el.style.background=dev<3?"rgba(22,163,74,.12)":"rgba(245,158,11,.14)";
  el.style.color=dev<3?"#16a34a":"#b45309";
}

/* =========================================================
   PARK MODE
========================================================= */

function toggleParkMode(){
  PARK_MODE=!PARK_MODE;

  const b=$("parkModeBtn");
  const hint=$("parkModeHint");

  if(b){
    b.textContent=
      "🌳 Park Analizi Modu: "+
      (PARK_MODE?"AÇIK":"KAPALI");

    b.classList.toggle("blue",!PARK_MODE);
    b.setAttribute(
      "aria-pressed",
      PARK_MODE?"true":"false"
    );
  }

  if(hint){
    hint.textContent=
      PARK_MODE
        ?"Şimdi haritada parkın içine tıkla."
        :"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
  }

  bindParkClick();

  if(!PARK_MODE){
    PARK_CANDS=[];
    clearPark();
    return;
  }

  if(!map){
    PARK_MODE=false;
    if(b){
      b.textContent="🌳 Park Analizi Modu: KAPALI";
      b.classList.add("blue");
      b.setAttribute("aria-pressed","false");
    }
    if(hint){
      hint.textContent=
        "Harita henüz hazır değil; tekrar deneyin.";
    }
    return;
  }

  toast(
    "🌳 Park Analizi modu açıldı. Haritada bir parkın içine tıklayın.",
    "ok",
    "🌳"
  );
}

function bindParkClick(){
  if(
    PARK_CLICK_BOUND ||
    !map
  ){
    return;
  }

  PARK_CLICK_BOUND=true;

  map.on(
    "click",
    async e=>{
      if(!PARK_MODE)return;

      /* 2026-09-24: tıklama artık dgDetectAt'e gider (park-registry.js).
       * Tek yol olmasının sebebi: aynı fonksiyon "konumumdan algıla" ve
       * geri doldurma aracı tarafından da kullanılıyor; park bulunamazsa
       * elle park oluşturma teklifini de o veriyor. Eskiden burada sadece
       * "Park bulunamadı" toast'ı vardı ve kullanıcı kilitli kalıyordu. */
      try{
        await dgDetectAt(e.latlng.lat,e.latlng.lng);
      }catch(err){
        console.error(
          "DENDROGEO · Park tıklama hatası:",
          err
        );

        toast(
          "Park analizi başarısız: "+
          (err?.message||String(err)),
          "err",
          "🌳"
        );
      }
    }
  );
}

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

  PARK_LAYER=
    L.layerGroup().addTo(map);

  L.polygon(
    PARK_POLY,
    {
      color:"#2b6cb0",
      weight:2.5,
      dashArray:"6,6",
      fillColor:"#3b82f6",
      fillOpacity:.10,
      interactive:false
    }
  ).addTo(PARK_LAYER);

  PARK_HOLES.forEach(r=>{
    L.polygon(
      r,
      {
        color:"#2b6cb0",
        weight:1.5,
        fillColor:"#ffffff",
        fillOpacity:.85,
        interactive:false
      }
    ).addTo(PARK_LAYER);
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

  const parkBounds = L.latLngBounds(PARK_POLY);

  if(PARK_HOLES && PARK_HOLES.length){
    PARK_HOLES.forEach(ring=>{
      ring.forEach(p=>{
        parkBounds.extend(p);
      });
    });
  }

  if(parkBounds.isValid()){
    map.fitBounds(
      parkBounds,
      {
        padding:[30,30]
      }
    );
  }

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

    /* 0 · PARK KİMLİĞİ + PROJE: karşılaştırmanın park bazında toplanabilmesi
     * için ölçümler parka bağlı bir projede olmalı. Kart, algılama akışının
     * 3. adımına (proje oluştur/bağla) köprüdür. */
    `<div class="dg-png-card" style="margin-bottom:12px">`+
      `<div class="dg-png-head">`+
        `<div>`+
          `<div class="dg-png-kicker">0 · PARK KİMLİĞİ</div>`+
          `<div class="dg-png-title">🌳 ${esc((parkRow&&parkRow.name)||park.name||"İsimsiz Park")}</div>`+
          `<div class="dg-png-sub">`+
            (parkRow
              ? `kimlik #${parkRow.id} · ${esc(parkRow.osm_key||"")} · ${parkProjects.length} proje bağlı`
              : `kimlik sunucuya yazılamadı — ölçüm girmeden önce 🔄 gerekir`)+
          `</div>`+
        `</div>`+
        (parkRow
          ? `<button class="dg-png-btn ghost sm" onclick="dgShowProjectStep()">📁 Proje oluştur / bağla</button>`
          : `<button class="dg-png-btn red sm" onclick="dgRetryRegister()">🔄 Yeniden dene</button>`)+
      `</div>`+
    `</div>`+

    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">`+

      `<div class="dg-png-card">`+
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

        `<button class="dg-png-btn primary" onclick="buildGrid()">`+
          `🔲 Grid Oluştur`+
        `</button>`+
      `</div>`+

      `<div class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">2 · YÜZEY ANALİZİ</div>`+
            `<div class="dg-png-title">🌿 Arazi örtüsü</div>`+
            `<div class="dg-png-sub">Bina · yol · otopark · saha · su</div>`+
          `</div>`+
          `<span class="dg-png-badge blue">10 m LULC · 2020</span>`+
        `</div>`+

        `<button id="landCoverBtn" class="dg-png-btn primary" onclick="runLandCoverAnalysis()">`+
          `🌿 Yüzey Örtüsü Analizi`+
        `</button>`+

        `<div class="dg-png-sub" style="font-size:.68rem">`+
          `Park polygonu + 10 m UTM LULC rasterı ile coverage-weighted zonal analiz.`+
        `</div>`+
      `</div>`+

      `<div class="dg-png-card">`+
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

      `<div class="dg-png-card">`+
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
    `<div id="gridSummary" class="dg-png-result" style="display:none"></div>`;

  renderRefBadge();

  toast(
    "✓ Park algılandı: "+
    ((parkRow&&parkRow.name)||park.name||"")+
    " · "+haTotal+" ha"+
    (parkRow?" · kimlik #"+parkRow.id:""),
    "ok",
    "🌳"
  );
}

/* =========================================================
   CLEAR
========================================================= */

function clearPark(){
  if(
    PARK_LAYER &&
    map
  ){
    map.removeLayer(
      PARK_LAYER
    );

    PARK_LAYER=null;
  }

  if(
    WATER_LAYER &&
    map
  ){
    map.removeLayer(
      WATER_LAYER
    );

    WATER_LAYER=null;
  }

  if(
    IMP_LAYER &&
    map
  ){
    map.removeLayer(
      IMP_LAYER
    );

    IMP_LAYER=null;
  }

PARK_POLY=null;
  PARK_HOLES=[];
  PARK_SELECTED_AREA_M2=null;

  /* Oturumun aktif park kimliği de düşer (proje bağı DB'de kalır; ölçüm
   * kapısı PROJ_LIST üzerinden okur). */
  if(typeof dgResetParkIdentity==="function")dgResetParkIdentity();

  WATER_RINGS=[];
  WATER_LINES=[];

  IMP_RINGS=[];
  IMP_LINES=[];

  GRID_BLOCK_LINES=[];

}

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
