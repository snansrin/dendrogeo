/* Present precomputed report results without changing scientific calculations. */
export function createReportResultsPresentation({esc, trNum, sw}) {
  return function renderResults({spRows, bars, ciTxt, snap, govdeAralikTxt, L, parkHa, covHa, clsHa, diffHa, deltaPct}) {
    return `<p><b>5.1 Karbon stoku.</b> Çizelge 1 tür bazlı özet istatistikleri, Şekil 1 ise karbon paylarının dağılımını vermektedir.</p>
<div class="tscroll"><table><caption>Çizelge 1. Türlere göre ağaç envanteri ve karbon stoku.</caption><thead><tr><th>Tür</th><th>Grup</th><th>n</th><th>Ort. DBH (cm)</th><th>Ort. boy (m)</th><th>Karbon (kg)</th><th>Pay</th></tr></thead><tbody>${spRows}</tbody></table></div>
<div class="fig"><div class="sans" style="font-size:.78rem"><b>Şekil 1 — Tür bazlı karbon stoku payları</b> <span class="qnote">(bar rengi taksonomik grubu gösterir: ${sw('#2f9e44')} ibreli · ${sw('#e8590c')} yapraklı · ${sw('#8a928c')} diğer)</span></div>${bars}</div>
<div class="ci">📐 Toplam karbon stoku: <b>${ciTxt}</b> · Monte Carlo n=${snap.mc.N}, tohum=${snap.mc.SEED}, model CV=%${snap.mc.MODEL_CV * 100} (korele). ${'Aralık, belirtilen model ve girdi belirsizliklerini kapsar; parkın ölçülmeyen ağaçlarından kaynaklanan örnekleme belirsizliğini kapsamaz.'}</div>
<p class="qnote"><b>Ölçüm notu:</b> Ham saha değişkeni göğüs çevresidir; DBH = çevre / π ile türetilmiştir (değişken tanımları: §4.6 veri sözlüğü). ${govdeAralikTxt ? ` <b>Türetilmiş DBH aralığı:</b> ${govdeAralikTxt}. Ham çevre değerleri korunmuş, yalnız matematiksel çevre→çap dönüşümü uygulanmıştır (§9 sınırlılıklar).` : ''}</p>
${L ? `<p><b>5.2 Arazi örtüsü.</b> Sınıf alanları Çizelge 2'de sunulmuştur; mekânsal dağılım §6'da (Şekil 2) gösterilmektedir.</p>
<div class="tscroll"><table class="summary"><caption>Çizelge 2. Park sınırı içindeki yüzey sınıflarının alanları.</caption><thead><tr><th>Sınıf</th><th>Alan (ha)</th><th>Pay</th></tr></thead><tbody>${L.classes.map((c) => `<tr><td class="tr">${esc(c.label)}</td><td>${trNum(c.ha, 2)}</td><td>%${trNum(c.pct, 1)}</td></tr>`).join('')}</tbody></table></div>
<p><b>5.3 Alan dengesi.</b> Çizelge 3, park geometrisi ile raster kapsama alanının karşılaştırmasını verir; bu karşılaştırma sonuçların üretilmesinden önce hesaplama bütünlüğünün kontrol edildiğini belgeler.</p>
<div class="tscroll"><table class="summary"><caption>Çizelge 3. Park alanı ve sınıflandırılmış yüzey alanı dengesi.</caption><thead><tr><th>Büyüklük</th><th>Değer</th></tr></thead><tbody>
<tr><td class="tr">Park geometrisi alanı</td><td>${trNum(parkHa, 2)} ha</td></tr>
<tr><td class="tr">Analiz edilen alan (raster kapsama)</td><td>${covHa != null ? trNum(covHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Sınıflandırılan alan</td><td>${clsHa != null ? trNum(clsHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Alan farkı</td><td>${diffHa != null ? (diffHa >= 0 ? '+' : '') + trNum(diffHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Alan farkı (%)</td><td>${deltaPct != null ? trNum(deltaPct, 3) + ' %' : '—'}</td></tr>
</tbody></table></div>` : ''}

`;
  };
}
