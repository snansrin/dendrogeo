/* Report HTML composition. The injected presentation functions keep this layer
 * independent from data access, snapshot calculation, and publication I/O. */
export function createReportDocumentRenderer(dependencies) {
  const { fmtT, fmtDateTr, esc, trNum, epsgLabel, SITE_ORIGIN, DGR_TITLE_DEF, renderSpeciesPresentation, createReportQaPresentation, qaStateOf, QA_STATE, renderInventoryDetails, renderQaTable, explainReportQa, renderEvaluationPresentation, renderLimitationsPresentation, renderHistoryPresentation, renderCitationPresentation, renderMethodPresentation, renderDocumentHead, renderCoverPresentation, renderStudyPresentation, renderOverviewPresentation, renderSourcesPresentation, REPORT_DATA_DICTIONARY, renderResultsPresentation, renderMapPresentation, renderProvenancePresentation, renderReferencesPresentation, renderReportDataAccess, REPORT_SHARE_SCRIPT } = dependencies;
  return function renderReport(snap, { id, hash, version = 1, meta = null }) {
  const t = snap.totals, P = snap.park;
  const M = Object.assign({}, snap.provenance || {}, meta || {});
  const doi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(String(M.doi || '')) ? String(M.doi) : null;
  const verTxt = String(version).includes('.') ? String(version) : version + '.0';
  const L = (snap.lulc && !snap.lulc.error) ? snap.lulc : null;
  const GQ = snap.geometry_qa || null;
  const GJ = (GQ && GQ.geom_json_bbox_ignored) || null;
  /* §2 saha sınırı kaynağı: GQ.source'a esc() tümüyle uygulanıyordu → <code>
   * etiketi de kaçıyordu (v2'den beri sessiz kozmetik hata; ekranda
   * "&lt;code&gt;way/…&lt;/code&gt;" görünüyordu). Etiket dışarıda kurulur,
   * yalnız DEĞERLER kaçırılır. */
  const srcTxt = GQ
    ? (GQ.source.includes('geom_json')
      ? 'uygulamada çizilen park poligonundan (parks.geom_json)'
      : 'OpenStreetMap <code>' + esc(P.osm_key || '—') + '</code> geometrisinden')
    : 'OpenStreetMap <code>' + esc(P.osm_key || '—') + '</code> geometrisinden';
  const INV = snap.qa && snap.qa.species ? snap.qa.species : null;
  const G = snap.gps || {};
  const knotN = (GQ && GQ.self_intersections != null) ? GQ.self_intersections : null;
  const knotted = knotN != null && knotN > 0;
  const ciTxt = `${fmtT(t.ci.mean)} t [%95 GA: ${fmtT(t.ci.lo)}–${fmtT(t.ci.hi)}]`;
  const engine = M.engine || 'DendroGeo LC Engine';
  const engineVer = M.engine_version || null;
  const appVer = M.app_version || null;
  const git = M.git_commit || null;
  const resolutionLabel = L?.review ? "Uydu 10/20 m + vektör sınır" : L?.accepted ? "Kayıtlı alan toplamları" : "10 m";
  const dataset = (L && L.source) || 'ESA WorldCover 10 m · 2021 (v200)';
  const dataYear = (L && L.year) || 2021;
  const epsg = epsgLabel((L && L.epsg) || M.epsg || null);
  const genTr = fmtDateTr(snap.generated_at);
  /* QR (kullanıcı standardı md. 15): basılı PDF bile dijital kayda bağlansın
   * diye kalıcı rapor adresinin QR'ı künyede taşınır. SVG, publishPark
   * tarafından ÜRETİM ANINDA (async) hazırlanıp meta.qr_uri ile iner →
   * sayfada dış istek YOK, çevrimdışı/PDF'te çalışır. Üretim başarısızsa
   * hücre hiç basılmaz (rapor QR'sız da geçerlidir; adres metni kalır). */
  const REPORT_URL = SITE_ORIGIN + '/rapor/' + id + '/';
  const qrUri = (M && M.qr_uri) || null;
  const subject = `${P.name} Ağaç Envanteri, Karbon Stoku ve Arazi Örtüsü Analizi`;
  const titleMain = `${esc(P.name)} (${esc(P.city)}): Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku`;

  const {bars, spRows} = renderSpeciesPresentation(snap.species);

  /* ---- QA/QC sayıları (gerçek değerler; uydurma yok) ---- */
  const NR = (snap.rows && snap.rows.length) || t.n; /* kayıt düzeyi QA tabanı */
  const nPhoto = (snap.qa && snap.qa.photos) ? snap.qa.photos.n_with : (snap.rows || []).filter((r) => r.photo !== false && r.photo != null ? r.photo : true).length;
  const parkHa = (P.area_m2 || 0) / 10000;
  const covHa = (L && L.coverage_m2) ? L.coverage_m2 / 10000 : null;
  const clsHa = (L && L.classified_m2) ? L.classified_m2 / 10000 : null;
  const diffHa = (covHa != null) ? covHa - parkHa : null;
  const deltaPct = (L && L.areaDeltaPct != null) ? L.areaDeltaPct : (L?.review && parkHa > 0 && covHa != null ? Math.abs(covHa - parkHa) / parkHa * 100 : null);
  /* ---- Çizelge 4 satırları + üç hâlli durum (0031) + ℹ️ beyan (0032) ----
   * QA durumu TABLODAN türetilir (elle sayılmaz) → rozet ile Çizelge 4 asla
   * çelişmez. ⛔ = kritik hata (blok), ⚠ = inceleme, ✓ = geçerli,
   * ℹ️ = BEYAN (0032): bilgilendirme kalemi, kalite hükmü DEĞİLDİR ve
   * 🟢/🟡/🔴 durumunu ETKİLEMEZ (ör. ρ kaynağı).
   * Gövde formu (boy/çap) ve karbon yeniden hesap bandı YALNIZ ⚠ üretir;
   * DBH geçerlilik kontrolü ile saklı–yeniden hesap tutarsızlığı sistemikse
   * ⛔ üretebilir.
   * 0032 · hücre sınıfları: .qst = sonuç (tek satır, renkli), .qd = ayrıntı
   * (orantılı yazı, kelime ortasından KIRILMAZ) → tablo masaüstü/mobil/PDF
   * üçünde de düzenli görünür. Kontrol kolonu class="tr" olarak KALIR
   * (test/report-v2.test.mjs bu işareti kilitler). */
  const qaPresentation = createReportQaPresentation({qaStateOf, QA_STATE});
  const qaRow = qaPresentation.row;
  const {tN, DB, HD, govdeAralikTxt, hdDetail, devDetail} = renderInventoryDetails(INV);

  const qaRows = renderQaTable({qaRow, P, GQ, knotted, knotN, L, parkHa, covHa, deltaPct, dataset, dataYear, resolutionLabel, INV, nPhoto, NR, G, hdDetail, devDetail, snap, hash});

  /* Üç hâlli rapor QA durumu: Çizelge 4'ün kendisinden türetilir.
   * FINAL: saha çevresi korunur ve DBH=C/π ile türetilir; Göksu benzeri gerçek
   * saha verisi artık ⛔ BLOKLU değil 🟡 İNCELEME / 🟢 GEÇERLİ olur. */
  const {QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates} = qaPresentation.summary();
  const {AGAC_DEGER_TEMIZ, QA_WHY} = explainReportQa({INV, G, snap, nPhoto, NR});

  const evalParas = renderEvaluationPresentation({snap, L, t, ciTxt});

  const limItems = renderLimitationsPresentation({L, knotted, knotN, t, G, INV, HD, DB, govdeAralikTxt, tN});

  const histRows = renderHistoryPresentation({M, snap, id});

  const {AU, citePlain, bib, jsonld} = renderCitationPresentation({snap, P, id, hash, verTxt, doi, L, dataYear});

  const {dbhcTxt, hbRows, gnssTxt, photoTxt, lulcMethod} = renderMethodPresentation({snap, G, NR, nPhoto, L, dataset, epsg, deltaPct});

  return `<!doctype html>
<html lang="tr">
<head>
${renderDocumentHead({id, P, t, dataset, ciTxt, hash, L, jsonld})}
</head>
<body>
<div class="wrap">
${renderCoverPresentation({id, verTxt, snap, titleMain, L, QA_ST_CLASS, QA_ST_LABEL, QA_ST, subject, P, genTr, engine, engineVer, appVer, dataYear, resolutionLabel, t, parkHa, AU, qrUri, REPORT_URL, hash})}
${renderStudyPresentation(snap)}
<p class="stmt">Bu rapor, DendroGeo analiz sistemi tarafından belirlenen yöntem, veri kaynakları ve kalite kontrol prosedürleri doğrultusunda oluşturulmuştur. Rapor bir akreditasyon veya sertifikasyon belgesi değildir; bulgular, beyan edilen veri kaynakları ve çözümleme sürümü kapsamında geçerlidir.</p>

${renderOverviewPresentation({P, t, ciTxt, L, dataset, srcTxt, parkHa, GJ, knotted, knotN, snap})}
<h2><span class="no">3</span>Veri Kaynakları</h2>
${renderSourcesPresentation({L, dataset, dataYear, t})}

<h2><span class="no">4</span>Yöntem</h2>
<p><b>4.1 Saha protokolü.</b> ${dbhcTxt} Ağaç boyu ${hbRows > 0 ? 'sahada ölçülmüş (kayıt çözünürlüğü 0,1 m)' : '—'}; konum sivil GNSS alıcısıyla kaydedilmiş${gnssTxt}; her kayıt için sahada çekilmiş fotoğraf kanıtı ${photoTxt}.</p>
<p><b>4.2 Biyokütle ve karbon.</b> Hesaplama zinciri: <b>göğüs çevresi C (cm) → DBH çapı D=C/π (cm) → boy H (m) → odun yoğunluğu (ρ) → AGB → BGB → karbon → belirsizlik.</b> Toprak üstü biyokütle (AGB), Chave ve ark. (2014) pantropikal allometrik denklemiyle hesaplanmıştır: AGB = 0.0673·(ρ·D²·H)^0.976. Burada <b>D, mezurayla ölçülen çevrenin π'ye bölünmesiyle türetilmiş DBH çapıdır</b>; ham çevre hiçbir aşamada doğrudan D olarak kullanılmaz. Toprak altı biyokütle AGB×0.26, karbon stoku ise toplam biyokütlenin 0.47 katsayısı ile çarpımıdır. Odun yoğunluğu yalnız kilitli DendroGeo yoğunluk tablosundan çözülür.</p>
<p><b>4.3 Belirsizlik.</b> Girdi belirsizlikleri (§4.1) ve allometrik model belirsizliği (%22 değişim katsayısı) Monte Carlo yöntemiyle (n=${snap.mc.N}, sabit tohum=${snap.mc.SEED}) yayılmıştır; model hatası kayıtlar arasında korele kabul edilmiştir, zira aynı denklem tüm kayıtlarda ortak yönde sapma üretir. Aralık sınırları Monte Carlo dağılımının 2,5 ve 97,5 yüzdelikleridir. Bu aralık model ve girdi belirsizlikleri koşulunda hesaplanmıştır; olasılıklı örnekleme tasarımına dayalı park geneli güven aralığı değildir.</p>
${lulcMethod || '<p><b>4.4 Arazi örtüsü sınıflandırması.</b> Bu sürümde arazi örtüsü çözümlemesi yer almamaktadır' + (snap.lulc && snap.lulc.error ? ` (teknik not: ${esc(snap.lulc.error)})` : '') + (knotted ? ` Saptanan neden: sınır poligonundaki ${knotN} kendini kesen segment çifti (düğüm), poligon alanı ile raster kapsama alanını %0,5 eşiğinin üzerinde ayrıştırmaktadır. Sınır düzeltilip yeniden yayımlandığında çözümleme üretilir; bu raporun kimliği değişmez, yeni çözümleme yeni DGR kimliği alır.` : '') + (GJ ? ` Saptanan neden: uygulamada çizili sınır kaydı bir dikdörtgen (${GJ.ring_points} nokta; jeodezik alanı ${trNum(GJ.ring_area_m2 / 10000, 2)} ha) olup künye alanından (${trNum(parkHa, 2)} ha) belirgin biçimde büyüktür; alan dengesi eşiği bu nedenle aşılmıştır. Sınır kaydı düzeltilip (veya OSM poligonuna dönülüp) yeniden yayımlandığında çözümleme üretilir; bu raporun kimliği değişmez, yeni çözümleme yeni DGR kimliği alır.` : '') + '.</p>'}
<p><b>4.5 Doğrulama zinciri.</b> (i) Her kayıt moderatör onayı gerektirir (${snap.moderation.approved}/${snap.moderation.approved} kayıt 'Onaylı' durumundadır; zaman damgalı onay kaydı ${snap.moderation.reviewed}/${snap.moderation.approved}); (ii) ölçüm konumunun park poligonu içinde olması veritabanı tetiği ile zorunlu kılınmıştır (trg_geo_fence; zorunluluk, 0007 geçişinden sonraki kayıtlara uygulanır, önceki kayıtlar için kayıt düzeyindeki denetim sonucu §7'de beyan edilir); (iii) arazi örtüsü çözümlemesinde raster/park alan farkı %0,5 eşiğini aşarsa sonuç yayınlanmaz; (iv) yayınlanan sayfanın içerik bütünlüğü SHA-256 hash'i ile açılışta canlı doğrulanır (§7).</p>
${REPORT_DATA_DICTIONARY}
<h2><span class="no">5</span>Nicel Sonuçlar</h2>
${renderResultsPresentation({spRows, bars, ciTxt, snap, govdeAralikTxt, L, parkHa, covHa, clsHa, diffHa, deltaPct})}
<h2><span class="no">6</span>Harita</h2>
${renderMapPresentation({L, P, id, epsg})}

<h2><span class="no">7</span>Kalite Kontrol ve Doğrulama</h2>
<p>Sonuçlar üretilmeden önce hesaplamanın bütünlüğü aşağıdaki kontrollerle doğrulanmıştır (Çizelge 4). Kontroller otomatiktir. Rapor QA durumu üç hâllidir: <b>🔴 BLOKLU</b> — kritik veri hatası vardır, karbon sonucu bilimsel iletişimde kullanılmamalıdır; <b>🟡 İNCELEME</b> — veri geçerlidir, bazı istatistiksel kontroller inceleme uyarısı vermektedir; <b>🟢 GEÇERLİ</b> — tüm kritik kontroller geçmiştir. <b>Bu raporun QA durumu: ${QA_ST_LABEL}</b>${QA_BLOCKED ? ` — kritik hata: ${QA_WHY}. Karbon toplamı bu nedenle GEÇİCİDİR ve hata giderilmeden bilimsel iletişimde KULLANILMAMALIDIR.` : (QA_REVIEW ? ` — inceleme kalemleri: ${QA_WHY}. Bu uyarılar birer inceleme kalemidir; veri hatası hükmü DEĞİLDİR ve karbon sonucunun geçerliliğini ortadan kaldırmaz.${AGAC_DEGER_TEMIZ ? ' Bu rapordaki inceleme kalemlerinin HİÇBİRİ ağaç ölçüm değerleriyle (DBH, boy, tür, karbon) ilgili DEĞİLDİR: envanter kontrollerinin tümü geçerlidir; kalan kalem/kalemler ölçülemeyen veya kaydedilmeyen üst veri alanlarıdır (ör. GNSS alıcı doğruluğu accuracy_m boş bırakılmışsa bu kontrol koşamaz).' : ''}` : '')}${qaStates.includes('info') ? ' Çizelge 4’te ayrıca <b>ℹ️ BEYAN</b> işaretli bilgilendirme satırları bulunabilir: bunlar bir kalite hükmü DEĞİLDİR ve rapor durumunu etkilemez.' : ''} Karbon hesabı, sahada ölçülen göğüs çevresinden D=C/π ile türetilen yuvarlanmamış DBH (cm) değerleri kullanılarak gerçekleştirilmiştir; rapor tablolarında DBH 1 ondalık basamakla gösterilir.</p>
<!-- 0032 · Çizelge 4 düzeni: sabit kolon genişlikleri (colgroup) + .qd ayrıntı hücresi.
     Eski hâlde ayrıntı kolonu monospace ve overflow-wrap:anywhere idi; uzun Türkçe
     cümleler kelime ortasından kırılıp tabloyu şekilsiz gösteriyordu. -->
<div class="tscroll"><table class="qa"><colgroup><col class="ck"><col class="cs"><col class="cd"></colgroup><thead><tr><th>Kontrol</th><th>Sonuç</th><th>Ayrıntı</th></tr></thead><tbody>${qaRows}</tbody></table></div>
<div class="verify">
 <b>Rapor kimliği:</b> <code>${id}</code> · sürüm ${verTxt} · yayın ${snap.generated_at.slice(0, 10)}<br>
 <b>İçerik hash'i:</b> <code>sha256:${hash}</code><br>
 <span id="dgVerify" class="sans">⏳ içerik bütünlüğü hesaplanıyor…</span><br>
 ${(snap.geofence.outside_rows || 0) === 0
   ? `✅ Konum çiti: ${snap.geofence.verified_rows}/${snap.geofence.total ?? snap.geofence.verified_rows} kayıt park poligonu içinde doğrulanmıştır.`
   : `⚠ Konum çiti: ${snap.geofence.verified_rows}/${snap.geofence.total} kayıt park poligonu içinde doğrulanmıştır; ${snap.geofence.outside_rows} kayıt poligon dışında koordinat taşımaktadır. Bu kayıtlar, konum çiti zorunluluğunun (0007) yürürlüğe girişinden önce üretildiği için geriye dönük olarak poligon denetimine tabi tutulamamıştır; karbon hesabına dahillerdir ancak mekânsal doğrulamaları bulunmamaktadır.`}<br>
 ${snap.moderation.reviewed === snap.moderation.approved
   ? `✅ Moderasyon: ${snap.moderation.approved}/${snap.moderation.approved} kayıt onaylı ve zaman damgalıdır.`
   : `⚠ Moderasyon: ${snap.moderation.approved}/${snap.moderation.approved} kayıt moderatör onaylıdır; zaman damgası (reviewed_at) ${snap.moderation.reviewed}/${snap.moderation.approved} kayıtta mevcuttur — onay zaman damgasının yazımı 0007 sonrası akışta zorunludur, önceki onaylar damgasızdır.`}<br>
 🔗 Kalıcı kimlik: ${id} + içerik hash'i${'' /* R2: Zenodo DOI eklendiğinde buraya işlenir */}.
</div>

<h2><span class="no">8</span>Değerlendirme</h2>
${evalParas}

<h2><span class="no">9</span>Sınırlılıklar</h2>
<ul class="lim">
 ${limItems}
</ul>

${renderProvenancePresentation({engine, engineVer, appVer, dataset, resolutionLabel, P, git, L, dataYear, id, epsg, snap, hash, doi})}
<h2><span class="no">12</span>Rapor Geçmişi</h2>
<div class="tscroll"><table><thead><tr><th>Rapor</th><th>Sürüm</th><th>Tarih</th><th>İşlem</th></tr></thead><tbody>${histRows}</tbody></table></div>
<p class="qnote">Bu çizelge aynı parkın üretim yayınlarını gösterir. Test yayınları sürüm zincirine dahil edilmemiştir. Veri veya yöntem değişiklikleri yeni rapor kimliği ve sürüm kaydıyla yayımlanır.</p>

<h2><span class="no">13</span>Atıf</h2>
<div class="cite"><b>Önerilen atıf</b><br>${esc(citePlain)}
<div class="sans" style="margin-top:8px;color:var(--mut)">Yöntem kaynakları: Chave ve ark. (2014) <code>10.1111/gcb.12629</code>${L ? ` · ${esc(L.citation)}` : ''} · OpenStreetMap katkıcıları (ODbL).</div></div>
<pre>${esc(bib)}</pre>

<h2><span class="no">14</span>Kaynakça</h2>
${renderReferencesPresentation(L)}

<h2><span class="no">Ek</span>A — Veri Erişilebilirliği</h2>
${renderReportDataAccess({L, M})}
<div class="foot">DendroGeo · Küresel Ağaç Envanteri ve Karbon Veri Sistemi · ${DGR_TITLE_DEF} · Bu sayfa yayın anında dondurulmuştur; sonraki çözümlemeler yeni DGR kimliği alır, geri çekmeler günlüğe işlenir. CC BY-NC 4.0 · © DendroGeo</div>
</div>
<script>
// Printed documents use textual status labels; screen icons are restored after printing.
let dgPrintText=[];
window.addEventListener('beforeprint',()=>{const root=document.querySelector('.wrap');if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;const clean=node.textContent.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu,'');if(clean!==node.textContent){dgPrintText.push([node,node.textContent]);node.textContent=clean;}}});
window.addEventListener('afterprint',()=>{for(const [node,text]of dgPrintText)node.textContent=text;dgPrintText=[];});
const DG_HASH=${JSON.stringify(hash)};
const DG_DATA=${JSON.stringify(snap)};
(async()=>{
  try{
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(DG_DATA,(k,v)=>(v&&typeof v==='object'&&!Array.isArray(v))?Object.keys(v).sort().reduce((o,key)=>(o[key]=v[key],o),{}):v)));
    const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    document.getElementById('dgVerify').textContent=hex===DG_HASH
      ?"✅ İçerik bütünlüğü doğrulandı: sayfadaki veri, yayın hash değeri ile birebir eşleşiyor."
      :"⚠ UYARI: sayfa verisi yayın hash değeri ile eşleşmiyor; bu kopya değiştirilmiş olabilir.";
  }catch(e){document.getElementById('dgVerify').textContent='⚠ Hash doğrulanamadı: '+e.message;}
})();
${REPORT_SHARE_SCRIPT}
</script>
</body>
</html>`;
};
}
