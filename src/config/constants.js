"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const QUOTA_MB=500;

/* Fotoğraf önizlemesi (2026-09-24, kullanıcı isteği: "fotoğraflar küçük şekilde
 * görünsün"). Listelerde 40×40 kapak görseli, tıklayınca yeni sekmede tam boy.
 * loading="lazy" şart: moderasyon listesi 300 satıra kadar çıkıyor, hepsi aynı
 * anda yüklenirse hem mobil veri hem sayfa açılışı şişer. */
const dgThumb=(url,px)=>{
  if(!url)return "—";
  const s=Number(px)||40;
  return `<a href="${esc(url)}" target="_blank" rel="noopener" title="Fotoğrafı yeni sekmede aç">`+
    `<img class="dg-thumb" src="${esc(url)}" alt="Ölçüm fotoğrafı" loading="lazy" decoding="async" width="${s}" height="${s}"></a>`;
};

/* =========================================================
   HARİTA ALTLIK ATIFLARI — LİSANS ZORUNLULUĞU (2026-09-24)
   OSM verisi ODbL 1.0: "© OpenStreetMap contributors" atfı ŞART ve görünür
   olmalı. OpenTopoMap CC-BY-SA (OSM atfı da gerekir), Esri World Imagery kendi
   kaynak zincirini ister. Eskiden bu atıflar YALNIZ altlık değiştirildiğinde
   (switchBaseLayer) ve eksik metinle basılıyordu; ilk yüklenen 4 haritada hiç
   yoktu → lisans ihlali. Artık tek kaynaktan (buradan) besleniyor.
========================================================= */
const DG_ATTR={
  osm:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  sat:'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics, and the GIS User Community',
  topo:'&copy; <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA) &middot; Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
};

/* PNG/raster çıktılar için düz metin sürümü (canvas fillText HTML render etmez).
 * Park geometrisi OSM'den türetildiği için vektör çıktıda da OSM atfı gerekir. */
const DG_ATTR_TEXT={
  osm:"\u00a9 OpenStreetMap contributors (ODbL)",
  sat:"Tiles \u00a9 Esri \u2014 Source: Esri, Maxar, GeoEye, Earthstar Geographics, and the GIS User Community",
  topo:"\u00a9 OpenTopoMap (CC-BY-SA) \u00b7 \u00a9 OpenStreetMap contributors (ODbL)"
};