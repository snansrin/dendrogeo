/* Render report artifact links; file production and sharing behavior stay separate. */
export function renderReportDataAccess({L, M}) {
  return `<div class="btnrow">
 <a class="btn g" href="olcum.csv">📥 Ölçüm verisi (CSV)</a>
 <a class="btn g" href="park.geojson">🗺 Konumlar (GeoJSON)</a>
 <a class="btn g" href="data.json">🧾 Snapshot (JSON)</a>
 <a class="btn g" href="metadata.json">🏷 Üst veri (JSON)</a>
 ${L ? '<a class="btn g" href="harita.png">🛰 Arazi örtüsü haritası (PNG)</a>' : ''}
 ${M.pdf_path ? '<a class="btn g" href="rapor.pdf">📄 Rapor (PDF)</a>' : ''}
 <button class="btn" onclick="window.print()">🖨 Yazdır / PDF</button>
 <button class="btn" id="dgShareBtn" onclick="dgShareReport()">📤 Paylaş</button>
 <a class="btn g" href="../../">🌐 DendroGeo uygulaması</a>
</div>
<p class="sans" style="font-size:.8rem;color:var(--mut)">Ham veriler CC BY-NC 4.0 lisansı ile açıktır; yeniden kullanımda §13 künyesine atıf zorunludur. <code>metadata.json</code>, DataCite desenine yakın makine okur üst veriyi taşır ve DOI kaydına hazırdır.</p>

`;
}
