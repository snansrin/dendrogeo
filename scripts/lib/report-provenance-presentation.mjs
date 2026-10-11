/* Present existing reproducibility records and report fingerprint. */
export function createReportProvenancePresentation({esc}) {
  return function renderProvenance({engine, engineVer, appVer, dataset, resolutionLabel, P, git, L, dataYear, id, epsg, snap, hash, doi}) {
    return `<h2><span class="no">10</span>Tekrar Üretilebilirlik</h2>
<div class="tscroll"><table><thead><tr><th>Öğe</th><th>Kayıt</th></tr></thead><tbody>
<tr><td class="tr">Analiz sürümü</td><td class="qd">${esc(engine)}${engineVer ? ' ' + esc(engineVer) : ' —'}${appVer ? ' · uygulama ' + esc(appVer) : ''}</td></tr>
<tr><td class="tr">Veri seti</td><td class="qd">${esc(dataset)}</td></tr>
<tr><td class="tr">Çözünürlük</td><td class="qd">${esc(resolutionLabel)}</td></tr>
<tr><td class="tr">Park geometrisi</td><td class="qd">kayıtlı (<code>${esc(P.osm_key || '—')}</code>; yayın anındaki sınır)</td></tr>
<tr><td class="tr">Analiz yöntemi</td><td class="qd">sürüm kontrollü${git ? ` (git commit <code>${esc(String(git).slice(0, 7))}</code>)` : ' (git commit kaydı bu kopyada yok)'}</td></tr>
<tr><td class="tr">Üretim komutu</td><td class="qd">${L?.review ? "Yayın isteğine sabitlenen analiz: data.json ve surface.geojson" : `<code>node scripts/make-report.mjs --park ${P.id}</code>`}</td></tr>
</tbody></table></div>
${L?.review ? `<p>Yeniden üretim girdileri <code>data.json</code> dosyasında sabitlenmiştir. Uydu sahne kimlikleri, kabul zamanı, sınıf alanları ve nesne geometrileri bu kayıtla korunur. <code>surface.geojson</code>, kabul edilmiş yüzey geometrilerini içerir. Canlı veri kaynağının yeniden sorgulanması aynı veri kümesini garanti etmez; tekrar analiz için bu arşiv girdileri kullanılmalıdır.</p>` : `<p>Bu raporun yeniden üretilebilmesi için kullanılan yöntem, veri kaynağı ve analiz sürümü rapor üst verisinde (<code>metadata.json</code>) kayıt altına alınmıştır. Raster girdi bulut kataloğundan okunduğu için, kaynak ürünün yeni bir sürümü yayımlanırsa aynı komut farklı sonuç üretebilir; bu nedenle veri seti sürümü (v200, ${dataYear}) ve üretim anı §11'de sabitlenmiştir.</p>`}


<h2><span class="no">11</span>Analiz Parmak İzi</h2>
<div class="meta">
 <div><b>Analysis ID</b><code>${id}</code></div>
 <div><b>Engine</b><code>${esc(engine)}</code></div>
 <div><b>Engine version</b><code>${engineVer ? esc(engineVer) : '—'}</code></div>
 <div><b>Source dataset</b><code>${esc(dataset)}</code></div>
 <div><b>Resolution</b><code>${esc(resolutionLabel)}</code></div>
 <div><b>Projection</b><code>${esc(epsg || '—')}</code></div>
 <div><b>Git commit</b><code>${git ? esc(String(git).slice(0, 7)) : '—'}</code></div>
 <div><b>Generated</b><code>${esc(snap.generated_at)}</code></div>
 <div><b>Result hash</b><code>sha256:${esc(hash)}</code></div>
 <div><b>DOI</b>${doi ? '<a href="https://doi.org/' + esc(doi) + '">' + esc(doi) + '</a>' : '<code>atanmadı</code>'}</div>
</div>

`;
  };
}
