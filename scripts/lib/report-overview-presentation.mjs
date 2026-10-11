/* Present existing analysis totals and site disclosures without deriving new results. */
export function createReportOverviewPresentation({esc, trNum}) {
  return function renderOverview({P, t, ciTxt, L, dataset, srcTxt, parkHa, GJ, knotted, knotN, snap}) {
    return `<h2><span class="no">1</span>Analiz Özeti</h2>
<p>Bu rapor, ${esc(P.name)} sınırları içerisinde gerçekleştirilen ${t.n} bireysel ağaç ölçümüne (göğüs çevresi, türetilmiş DBH, boy, tür, GNSS konumu ve fotoğraf kanıtı) dayalı karbon stoku tahminini, %95 model belirsizlik aralığı ve veri kalite kontrol sonuçları ile sunar. Ölçümü yapılan ağaçların toplam karbon stoku <b>${ciTxt}</b> olarak hesaplanmıştır. Kayıtlı karbon toplamının park alanına oranı ${t.per_ha_kg == null ? '—' : trNum(t.per_ha_kg / 1000, 3) + ' t/ha'} değerindedir; bu oran, parkın toplam karbon stok yoğunluğu tahmini değildir. Bütün kayıtlar moderatör onayından geçirilmiştir; park poligonu konum çiti denetiminin kayıt düzeyindeki sonucu §7'de raporlanmıştır.${L ? ` Yüzey örtüsü verisi ${esc(dataset)} kaynağından alınmış; kalite kontrol sonuçları Çizelge 4'te sunulmuştur.` : ''}</p>

<h2><span class="no">2</span>Analiz Alanı</h2>
<p>Analiz alanı, ${esc(P.city)} (${esc(P.country)}) sınırları içinde yer alan ${esc(P.name)} park sahasıdır. Saha sınırı, ${srcTxt} türetilmiş olup ${trNum(parkHa, 2)} ha alan kaplamaktadır.${GJ ? ` Uygulamada çizili sınır kaydı bir dikdörtgen (${GJ.ring_points} nokta; ${trNum(GJ.ring_area_m2 / 10000, 2)} ha) olduğundan gerçek park sınırı sayılmamış, analiz OpenStreetMap poligonundan yürütülmüştür (ayrıntı §7).` : ''}${knotted ? ` Poligonda <b>${knotN} kendini kesen segment çifti</b> (düğüm) saptanmıştır; bu durum alan hesapları ile raster ayrışımını birbirinden ayırır ve arazi örtüsü çözümlemesinin kalite eşiğine takılmasına yol açar (§7, §9).` : ''} Envanter, ${snap.period.from.slice(0, 10)} – ${snap.period.to.slice(0, 10)} tarihleri arasında ${t.n} ölçüm noktasında gerçekleştirilmiştir${snap.geofence.outside_rows > 0 ? `; kayıtların ${snap.geofence.verified_rows}/${snap.geofence.total} adedi poligon içinde, ${snap.geofence.outside_rows} adedi poligon dışında konumlanmaktadır (ayrıntı §7)` : `; kayıtların tamamı poligon içinde konumlanmaktadır (denetim §7)`}.</p>

`;
  };
}
