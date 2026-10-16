"use strict";
/* Build the park result panel markup without owning park or DOM state. */
(function(root){
 function render({name,escape,hectares,parkIdChip,registerRetryMarkup,alternateSelector,projectOptionsMarkup}){
  return (

    `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">`+
      `<b style="font-size:1.15rem">🌳 ${escape(name||"İsimsiz Park")}</b>`+
      `<span class="dg-png-badge">`+
        `${hectares} ha`+
      `</span>`+
      parkIdChip+
      `<span id="refBadge" class="dg-png-ref" style="display:none"></span>`+
      alternateSelector+
    `</div>`+

    registerRetryMarkup+

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
            `<select aria-label="Çalışma projesi" id="gridProject" class="dg-png-select">`+
              /* Yalnız bu parka bağlı projeler: waypoint/grid yanlış parka
               * yazılmasın. Parkın projesi yoksa eski liste yedek olarak
               * gösterilir (şema eski/park bağı yokken araç kilitlenmesin). */
              projectOptionsMarkup+
            `</select>`+
          `</div>`+

          `<div class="dg-png-field">`+
            `<label class="dg-png-label">GRID BOYUTU</label>`+
            `<select aria-label="Grid boyutu" id="gridSize" class="dg-png-select">`+
              `<option value="10">10 × 10 m · Hassas</option>`+
              `<option value="20" selected>20 × 20 m · Standart</option>`+
              `<option value="50">50 × 50 m · Hızlı</option>`+
            `</select>`+
          `</div>`+

          `<div class="dg-png-field">`+
            `<label class="dg-png-label">REFERANS ALAN (HA)</label>`+
          `<input aria-label="Referans alan (ha)" id="refHa" type="number" step="0.1" placeholder="örn. 50.8" class="dg-png-input" data-park-change="referenceArea">`+
          `</div>`+
        `</div>`+

        `<label class="dg-png-option" style="margin:2px 0 8px">`+
          `<span class="dg-png-icon">🌿</span>`+
          `<span class="dg-png-copy">`+
            `<strong>Sadece yeşil alan</strong>`+
            `<span>Grid'i arazi örtüsü analizinin yeşil alanlarıyla kısıtla</span>`+
          `</span>`+
          `<input type="checkbox" class="dg-switch" id="chkGreenOnly" checked data-park-change="greenOnly">`+
          `<span class="dg-png-switch"></span>`+
        `</label>`+

        `<div class="dg-png-field"><label class="dg-png-label" for="gridClearance">SU / SERT ZEMİN MESAFESİ (M)</label><input id="gridClearance" class="dg-png-input" type="number" min="1" max="20" step="1" value="3"></div><button id="gridBuildBtn" class="dg-png-btn primary" data-park-action="buildGrid">`+
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

        `<button id="landCoverBtn" class="dg-png-btn primary" data-park-action="landCoverAnalysis">`+
          `🌿 Yüzey Örtüsü Analizi`+
        `</button>`+

        `<div class="dg-png-sub" style="font-size:.68rem">`+
          `Park polygonu + 10 m raster (ESA WorldCover 2021 v200 birincil, IO LULC 2020 çapraz) ile coverage-weighted zonal analiz.`+
        `</div>`+
      `</div>`+

      `<div id="parkLayerTools" class="dg-png-card">`+
        `<div class="dg-png-head">`+
          `<div>`+
            `<div class="dg-png-kicker">3 · KATMANLAR</div>`+
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
            `<input type="checkbox" class="dg-switch" id="togGrid" checked data-park-change="gridVisibility">`+
            `<span class="dg-png-switch"></span>`+
          `</label>`+

          `<label class="dg-png-option">`+
            `<span class="dg-png-icon">📍</span>`+
            `<span class="dg-png-copy">`+
              `<strong>Waypoint'ler</strong>`+
              `<span>Ölçüm noktalarını göster</span>`+
            `</span>`+
            `<input type="checkbox" class="dg-switch" id="togWp" checked data-park-change="waypointVisibility">`+
            `<span class="dg-png-switch"></span>`+
          `</label>`+

        `</div>`+

        `<button class="dg-png-btn red sm" data-park-action="clearGrid">`+
          `✕ Tümünü Temizle`+
        `</button>`+
      `</div>`+

    `</div>`+

    `<div id="landCoverReport" class="dg-png-result" style="display:none"></div>`+
    /* 0054 · 🛰 UYDU HASSASİYET PANELİ: yüzey analizi bitince köprü
     * (park-export.js) buraya lc-sens'i monte eder — rapor barlarının
     * hemen altında sınıf başına hassasiyet kaydırıcıları + uydu görüntüsü
     * üzerinde aday işaretleme + tek dokunuşla kalıcı onay. */
    `<div id="acceptedParkSurface" class="dg-png-result" hidden></div>`+
    `<div id="lcSens" class="dg-png-result" style="display:none"></div>`+
    `<div id="gridSummary" class="dg-png-result" style="display:none"></div>`
  );
 }
 root.DG_PARK_INFO_PANEL_UI=Object.freeze({render});
})(window);
