"use strict";

/* Render the park identity admin table from its prepared overview model. */
function dgRenderParkAdminHTML({ element, rows, overview, showEmpty, formatHectares, distance, escapeHTML, translate, translateFormat, translatePlain }) {
  const { projByPark, measByPark, emptyRows, shown, dupGroups, unnamed } = overview;
  const dupHTML = dupGroups.length
    ? `<div class="alert warn" style="margin-bottom:10px"><b>⚠ ${dupGroups.length} ${translate("çift kimlik adayı var")}</b> ${translate("— aynı park iki satırda duruyorsa karşılaştırma bölünür.")}`+
      dupGroups.map(group => {
        const meters = (group[0].centroid_lat && group[1].centroid_lat)
          ? Math.round(distance(+group[0].centroid_lat, +group[0].centroid_lon, +group[1].centroid_lat, +group[1].centroid_lon))
          : null;
        const osmOne = group.find(park => park.source !== "manual") || group[1];
        const other = group.find(park => park.id !== osmOne.id) || group[0];
        return `<div style="margin-top:6px;font-size:.82rem">🌳 <b>${escapeHTML(group[0].name)}</b>: `+
          group.map(park => `#${park.id} (${escapeHTML(park.osm_key||"?")} · ${formatHectares(park.area_m2)} · ${projByPark[park.id]||0} proje · ${measByPark[park.id]||0} kayıt)`).join("  ↔  ")+
          (meters!==null?` · aradaki mesafe <b>${meters} m</b>`:"")+` <button class="btn sm amber" onclick="dgParkMergeInto(${other.id},${osmOne.id})">🔀 #${other.id} → #${osmOne.id} birleştir</button></div>`;
      }).join("")+`</div>`
    : (rows.length?`<div class="alert ok" style="margin-bottom:10px">✓ Çift kimlik yok — her park tek satırda.</div>`:"");
  const unnamedHTML = unnamed.length
    ? `<div class="alert info" style="margin-bottom:10px">ℹ ${unnamed.length} ${translate("parkın adı yok (OSM elemanında ad etiketi yoktu):")} `+
      unnamed.map(park=>`#${park.id}`).join(", ")+` ${translate("— ✏️ ile ad ver (örn. projenin adı).")}</div>`
    : "";

  element.innerHTML = dupHTML+unnamedHTML+
    (emptyRows.length
      ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><button class="btn sm ghost" onclick="dgParkAdminToggleEmpty()">`+
        (showEmpty?translate("🙈 Boş parkları gizle"):translateFormat("🫥 Boş parkları göster ({n})",{n:emptyRows.length}))+`</button><span class="dg-tree-meta">Yalnız sorgulanmış, projesi/kaydı olmayan parklar; temizlemek için gösterip 🗑️ kullan.</span></div>`
      : "")+
    `<div class="tblwrap dg-parkadmin-wrap"><table class="dg-cards"><thead><tr><th scope='col'>ID</th><th scope='col'>Park Adı</th><th scope='col'>Kimlik</th><th scope='col'>Şehir</th><th scope='col'>Alan</th><th scope='col'>Proje</th><th scope='col'>Kayıt</th><th scope='col'>Kaynak</th><th scope='col'>İşlem</th></tr></thead><tbody>`+
    (shown.map(park=>{
      const others=shown.filter(other=>other.id!==park.id);
      const isDup=dupGroups.some(group=>group.some(other=>other.id===park.id));
      return `<tr${isDup?' class="dg-dup"':''}><td data-label="ID" class="mono">${park.id}</td>`+
        `<td data-label="Park Adı"><b>${escapeHTML(park.name)}</b>${isDup?' <span class="badge admin">çift?</span>':""}</td>`+
        `<td data-label="Kimlik" class="mono dg-key">${escapeHTML(park.osm_key||"—")}</td><td data-label="Şehir">${escapeHTML(park.city||"—")}</td>`+
        `<td data-label="Alan">${formatHectares(park.area_m2)}</td><td data-label="Proje">${projByPark[park.id]||0}</td><td data-label="Kayıt">${measByPark[park.id]||0}</td>`+
        `<td data-label="Kaynak">${escapeHTML(park.source||"—")}</td><td data-label="İşlem"><div class="dg-act">`+
        `<button class="btn sm blue" onclick="dgParkRename(${park.id})" title="Yeniden adlandır">✏️</button>`+
        `<button class="btn sm ghost" onclick="dgBackfillGeom(${park.id})" title="OSM sınırını geom_json'a yaz → konum çiti tam poligonla çalışır">🛰</button>`+
        `<select id="parkMergeSel${park.id}" class="dg-png-select dg-merge-sel"><option value="">→ birleştir…</option>${others.map(other=>`<option value="${other.id}">#${other.id} ${escapeHTML(other.name)}</option>`).join("")}</select>`+
        `<button class="btn sm amber" onclick="dgParkMergeFromSelect(${park.id})" title="Bu parkı seçilene taşı">🔀</button><button class="btn sm red" onclick="dgParkDelete(${park.id})" title="Sil">🗑️</button>`+
        `</div></td></tr>`;
    }).join("")||`<tr><td colspan=9>Henüz park kimliği yok — Canlı Harita → 🌳 Park Algılama ile oluştur.</td></tr>`)+
    `</tbody></table></div>`+
    (emptyRows.length&&!showEmpty?`<div class="dg-tree-meta" style="margin-top:8px">🫥 ${emptyRows.length} ${translatePlain("boş park (projesi/kaydı yok) gizlendi — yalnız sorgulanmışlar.")}</div>`:"")+ 
    `<div class="dg-parkadmin-note">🔀 = bu parkı seçtiğin hedefin içine taşır (projeler + ölçümler + adlar), kaynak kimlik silinir. ✏️ = adı düzeltir; proje adları otomatik yeniden kurulur ("park - etiket"). 🗑️ = yalnız yanlış kimlikse; bağ kopar, veri silinmez.</div>`;
}

window.DG_PARK_ADMIN_RENDERER = Object.freeze({ render: dgRenderParkAdminHTML });
