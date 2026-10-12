/* Render the existing discussion and limitations sections in document order.
 * Evaluation prose and limitation rules remain in their injected presenters. */
export function renderReportDiscussionSections({
  snap, L, t, ciTxt, knotted, knotN, G, INV, HD, DB, govdeAralikTxt, tN,
  renderEvaluationPresentation, renderLimitationsPresentation,
}) {
  const evalParas = renderEvaluationPresentation({snap, L, t, ciTxt});
  const limItems = renderLimitationsPresentation({L, knotted, knotN, t, G, INV, HD, DB, govdeAralikTxt, tN});
  return `<h2><span class="no">8</span>Değerlendirme</h2>
${evalParas}

<h2><span class="no">9</span>Sınırlılıklar</h2>
<ul class="lim">
 ${limItems}
</ul>`;
}
