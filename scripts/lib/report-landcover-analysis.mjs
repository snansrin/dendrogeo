/* Adapt the existing land-cover engine output for immutable reports.
 * The scientific engine itself remains in the application runtime. */
export function createReportLandcoverAnalysis({parkOuter, bootLC}) {
  return async function runLULC(park, preOuter = null) {
    const g = preOuter || (await parkOuter(park));
    if (!g) return null;
    const { outer, holes } = g;
    const ctx = bootLC();
    const area = park.area_m2 > 0 ? park.area_m2 : ctx.ringGeodesicArea(outer);
    const report = await ctx.dgLcAnalyze({ outer: [outer], holes, parkAreaM2: area });
    const last = ctx.__dgLast();
    const cells = ctx.dgLcCellsGeoJson(last.result);
    /* HARITA TAM ÖRTÜŞÜM: dgLcCellsGeoJson bellek koruması nedeniyle 10.000
     * hücrede kesilir (bu parkta 13.396 hücre → kesilen dilim haritada beyaz
     * kalıyordu). Çizim için KESİNTİSİZ run-length çıktısı (result.runs)
     * kullanılır ve UTM→WGS dönüşümü burada bir kez yapılır. */
    const runs = (last && last.result && Array.isArray(last.result.runs)) ? last.result.runs : [];
    /* Koordinat sistemi BÜYÜKLÜKTEN tanınır: |x|≤180 ve |y|≤90 ise derece
     * (4326 karosu), aksi hâlde UTM metreleri → ters dönüşüm. (run.epsg alanı
     * analiz EPSG'sini taşıyabildiği için tek başına güvenilir değildir.) */
    const toWgs = (x, y, epsg) => (Math.abs(x) <= 180 && Math.abs(y) <= 90
      ? { lon: x, lat: y } : ctx.dgLcUtmInverse(x, y, epsg));
    const wruns = runs.map((r) => {
      const a = toWgs(r.x0, r.y1, r.epsg);
      const b = toWgs(r.x1, r.y0, r.epsg);
      return {
        lo0: Math.min(a.lon, b.lon), lo1: Math.max(a.lon, b.lon),
        la0: Math.min(a.lat, b.lat), la1: Math.max(a.lat, b.lat),
        key: r.classKey,
      };
    }).filter((r) => [r.lo0, r.lo1, r.la0, r.la1].every(Number.isFinite));
    /* Analiz EPSG'si: harita altbilgisi ve §11 parmak izi için üst veri
     * (koordinat uzayı BÜYÜKLÜKTEN tanınmaya devam eder; bu yalnız kayıt). */
    const epsg = runs.length && Number.isFinite(Number(runs[0].epsg)) ? Number(runs[0].epsg) : null;
    return { report, cells: cells && cells.features ? cells.features : [], wruns, outer, holes, epsg };
  }
}
