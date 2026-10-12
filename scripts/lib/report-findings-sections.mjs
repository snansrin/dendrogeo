/* Compose report findings and map sections in their existing document order.
 * Result values and map presentation remain in their injected presenters. */
export function renderReportFindingsSections({
  renderResultsPresentation, results,
  renderMapPresentation, map,
}) {
  return `<h2><span class="no">5</span>Nicel Sonuçlar</h2>
${renderResultsPresentation(results)}
<h2><span class="no">6</span>Harita</h2>
${renderMapPresentation(map)}`;
}
