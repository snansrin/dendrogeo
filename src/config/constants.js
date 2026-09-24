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
