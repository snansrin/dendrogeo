/* Render existing scientific references without changing citation policy. */
export function createReportReferencesPresentation({esc, siteOrigin: SITE_ORIGIN}) {
  return function renderReferences(L) {
    return `<ol class="refs">
 ${L?.review || L?.accepted ? `<li>Copernicus Sentinel-2 Level-2A [uydu görüntüleri]. Kullanılan sahne kimlikleri ve edinim tarihleri <code>data.json</code> dosyasında kayıtlıdır.</li>` : ''}
 <li>Zanaga, D., Van De Kerchove, R., De Keersmaecker, W. ve ark. (2022). <i>ESA WorldCover 10 m 2021 v200</i> [veri seti]. Zenodo. <code>10.5281/zenodo.7254221</code> (CC BY 4.0).</li>
 <li>Chave, J., Réjou-Méchain, M., Búrquez, A. ve ark. (2014). Improved allometric models to estimate the aboveground biomass of tropical trees. <i>Global Change Biology</i>, 20(10), 3177–3190. <code>10.1111/gcb.12629</code> — §4.2'de kullanılan allometrik denklem.</li>
 <li>OpenStreetMap katkıcıları. <i>OpenStreetMap verisi</i> [park sınırı geometrisi ve bütünleyici doğrulama]. Open Database License (ODbL). https://www.openstreetmap.org/copyright</li>
 ${L && L.cross ? `<li>${esc(L.cross)} [çapraz doğrulama veri seti] — grup bazlı uzlaşma §7'de raporlanmıştır.</li>` : ''}
 <li>Şirin, N. &amp; Şirin, S. (2026). <i>DendroGeo Saha Protokolü v1</i> (göğüs çevresi, DBH = çevre/π, boy, GNSS ve fotoğraf kanıtı kuralları) ve <i>DendroGeo yöntem dokümantasyonu</i>. ${SITE_ORIGIN}/yontem/</li>
</ol>`;
  };
}
