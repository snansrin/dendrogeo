/* Compose the existing report cover, study note, overview and data-source sections.
 * Rendering content and all report data remain in their injected presenters. */
export function renderReportDocumentOpening({
  renderCoverPresentation, cover,
  renderStudyPresentation, study,
  renderOverviewPresentation, overview,
  renderSourcesPresentation, sources,
}) {
  return `${renderCoverPresentation(cover)}
${renderStudyPresentation(study)}
<p class="stmt">Bu rapor, DendroGeo analiz sistemi tarafından belirlenen yöntem, veri kaynakları ve kalite kontrol prosedürleri doğrultusunda oluşturulmuştur. Rapor bir akreditasyon veya sertifikasyon belgesi değildir; bulgular, beyan edilen veri kaynakları ve çözümleme sürümü kapsamında geçerlidir.</p>

${renderOverviewPresentation(overview)}
<h2><span class="no">3</span>Veri Kaynakları</h2>
${renderSourcesPresentation(sources)}`;
}
