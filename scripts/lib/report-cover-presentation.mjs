/* Present report identity, QA status and provenance without publication effects. */
export function createReportCoverPresentation({esc, trNum, QA_STATE, DGR_TITLE_DEF, FOUNDERS_LINE}) {
  return function renderCover({id, verTxt, snap, titleMain, L, QA_ST_CLASS, QA_ST_LABEL, QA_ST, subject, P, genTr, engine, engineVer, appVer, dataYear, resolutionLabel, t, parkHa, AU, qrUri, REPORT_URL, hash}) {
    return `<div class="kick">DendroGeo Bilimsel Analiz Raporu · ${id} · sürüm ${verTxt}</div>
<h1>${snap.study?.title ? esc(snap.study.title) : titleMain}</h1>
<div class="sub">Saha ölçümleri, allometrik hesaplama ve ${L?.review ? "kayıtlı yüzey sonucu" : "arazi örtüsü sınıflandırması"} ile park ölçekli analiz</div>

<div class="meta">
 <div><b>Rapor kimliği</b><code>${id}</code><span class="hint">${DGR_TITLE_DEF}</span></div>
 <div><b>Rapor durumu</b><span class="${QA_ST_CLASS}">${QA_ST_LABEL}</span><span class="hint">${QA_ST === QA_STATE.BLOCKED ? 'kritik veri hatası: karbon sonucu bilimsel iletişimde kullanılmamalıdır' : QA_ST === QA_STATE.REVIEW ? 'veri geçerli; bazı istatistiksel kontroller inceleme uyarısı veriyor (§7)' : 'tüm kritik kontroller geçti'}</span></div>
 <div><b>Analiz konusu</b><code>${esc(subject)}</code></div>
 <div><b>Konum</b><code>${esc(P.city)}, ${esc(P.country)}</code></div>
 <div><b>Analiz tarihi</b><code>${genTr}</code></div>
 <div><b>Analiz sürümü</b><code>${esc(engine)}${engineVer ? ' v' + esc(engineVer) : ''}${appVer ? ' · DendroGeo v' + esc(appVer) : ''}</code></div>
 <div><b>Veri dönemi</b><code>${dataYear} (arazi örtüsü)</code><span class="hint">saha ölçümleri: ${snap.period.from.slice(0, 10)} → ${snap.period.to.slice(0, 10)}</span></div>
 <div><b>Mekânsal çözünürlük</b><code>${esc(resolutionLabel)}</code></div>
 <div><b>Park kimliği</b><code>${esc(P.osm_key || '—')} · DB #${P.id}</code></div>
 <div><b>Örneklem</b><code>${t.n} onaylı ölçüm · ${snap.species.length} tür</code></div>
 <div><b>Park alanı</b><code>${trNum(parkHa, 2)} ha (OSM poligonu)</code></div>
 <div><b>Yazar</b><code>${AU.name ? esc(AU.name) : 'DendroGeo (kurumsal)'}</code><span class="hint">${esc(FOUNDERS_LINE)}${AU.name ? '' : ' — istek sahibi adı çözülemedi'}</span></div>
 ${qrUri ? `<div><b>Kalıcı bağlantı (QR)</b><img src="${qrUri}" width="104" height="104" alt="${id} kalıcı rapor adresinin QR kodu" style="border:1px solid var(--line);border-radius:6px;background:#fff"><span class="hint">${esc(REPORT_URL)}</span></div>` : `<div><b>Kalıcı bağlantı</b><code>${esc(REPORT_URL)}</code></div>`}
 <div><b>Lisans</b><code>CC BY-NC 4.0</code></div>
 <div><b>İçerik hash'i</b><code>sha256:${hash.slice(0, 20)}…</code></div>
</div>
`;
  };
}
