/* Immutable report back matter: provenance, publication history,
 * citation, references, data access, and the document footer. */
export function renderReportDocumentBackmatter({renderProvenancePresentation, provenance, histRows, citePlain, bib, L, renderReferencesPresentation, renderReportDataAccess, M, DGR_TITLE_DEF, esc}) {
  return `${renderProvenancePresentation(provenance)}
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
<div class="foot">DendroGeo · Küresel Ağaç Envanteri ve Karbon Veri Sistemi · ${DGR_TITLE_DEF} · Bu sayfa yayın anında dondurulmuştur; sonraki çözümlemeler yeni DGR kimliği alır, geri çekmeler günlüğe işlenir. CC BY-NC 4.0 · © DendroGeo</div>`;
}
