/* Snapshot assembly for immutable scientific reports.
 * All I/O, geometry, QA, and rendering dependencies are supplied by the adapter. */
export function createReportSnapshotApplication(dependencies) {
  const { rest, summarizeReportMeasurements, mcTotalCI, mcRowCI, reportContext, reviewedSurface, parkOuter, pointInPolygon, bboxRing, ringGeodesicAreaM2, geometrySelfIntersections, inventoryQa, loadSpeciesDict, loadRho, resolveReportAuthor, renderMapPNG, fmtDateDot, runLULC, DATASET_ASCII, ENGINE_VERSION, APP_VERSION, GIT_COMMIT, buildReportProvenance, DATASET_DEFAULT, MC_CFG, canonicalHash } = dependencies;

  async function buildSnapshot(parkId, { skipLulc = false, meta = null, surfaceSnapshot = null } = {}) {
    const genAt = new Date().toISOString();
    const park = (await rest('parks', { id: 'eq.' + parkId, limit: 1 }))[0];
    if (!park) throw new Error('Park bulunamadı: ' + parkId);
    const SEL_V21 = 'id,point_id,measurement_no,species,grp,dbh_cm,girth_cm,height_m,carbon_kg,volume_m3,lat,lon,accuracy_m,created_at,reviewed_at,photo_url,photo_file';
    const SEL_V2 = 'id,point_id,measurement_no,species,grp,dbh_cm,height_m,carbon_kg,lat,lon,accuracy_m,created_at,reviewed_at,photo_url';
    let rows;
    try {
      rows = await rest('measurements', { select: SEL_V21, park_id: 'eq.' + parkId, status: 'eq.Onaylı', order: 'point_id.asc' });
    } catch (e) {
      /* 0011 henüz uygulanmadı → girth_cm/volume_m3 kolonları yok; eski seçime düş */
      rows = await rest('measurements', { select: SEL_V2, park_id: 'eq.' + parkId, status: 'eq.Onaylı', order: 'point_id.asc' });
    }
    if (!rows.length) throw new Error('Bu park için onaylı kayıt yok; rapor yayınlanamaz.');
    const measurementSummary = summarizeReportMeasurements(rows, park.area_m2, { mcTotalCI, mcRowCI });
    /* Konum çiti denetimi SAYILARLA: her kayıt için gerçek nokta–poligon testi.
     * Daha önce verified_rows = rows.length varsayılıyordu; poligon dışında
     * koordinat taşıyan kayıt varsa rapor bunu beyan etmek zorundadır. */
    if(meta?.study){const v=reportContext.validate(meta.study);if(!v.valid)throw Error('Yayın künyesi geçersiz.');meta.study=v.value;}
    const savedSurface = !skipLulc && surfaceSnapshot ? reviewedSurface(surfaceSnapshot,parkId) : null;
    const OG = savedSurface ? {outer:surfaceSnapshot.outer[0],holes:surfaceSnapshot.holes||[]} : await parkOuter(park).catch(() => null);
    const gfInside = OG ? rows.filter((r) => (savedSurface ? surfaceSnapshot.outer : [OG.outer]).some(outer=>pointInPolygon(+r.lat, +r.lon, outer, OG.holes))).length : null;
    const gfStat = OG ? { inside: gfInside, outside: rows.length - gfInside } : null;
    const ringPts = OG ? (OG.outer.length + (OG.holes || []).reduce((a, h) => a + h.length, 0)) : 0;
    const gjRing = (park.geom_json && Array.isArray(park.geom_json.outer) && park.geom_json.outer[0]) || null;
    const gjBbox = gjRing ? bboxRing(gjRing) : false;
    const geometryQA = OG ? {
      source: savedSurface ? 'Kayıtlı analiz sınırı' : (gjRing && !gjBbox) ? 'parks.geom_json (uygulamada çizilen sınır)' : ('OSM ' + (park.osm_key || '—')),
      ring_points: ringPts,
      ring_area_m2: OG ? Math.round(ringGeodesicAreaM2(OG.outer)) : null,
      self_intersections: ringPts <= 600 ? geometrySelfIntersections(OG.outer, OG.holes) : null,
      /* geom_json bbox ise analiz OSM poligonundan yürür; rapor bunu beyan eder */
      geom_json_bbox_ignored: !savedSurface && gjBbox ? { ring_points: gjRing.length, ring_area_m2: Math.round(ringGeodesicAreaM2(gjRing)) } : null,
    } : null;
    /* Envanter kalite kapısı: kanonik sözlük + panel denklemiyle yeniden hesap */
    const qaSpecies = inventoryQa(rows, loadSpeciesDict());
    /* Yayın provenance'i ölçüm protokolü kilidini aynı kanonik ρ kaynağından okur.
     * Bu değer buildSnapshot kapsamındadır; inventoryQa içindeki yerel değişkene
     * güvenilmez (2026-10-06: "base is not defined" yayın hatası). */
    const rhoBase = loadRho();
    /* YAZAR (0012+0015 · kullanıcı standardı): rapor, PARKIN VERİSİNİ ÖLÇEN
     * kullanıcının adıyla yayımlanır. Öncelik zinciri:
     *   1) dg_park_author(park)  — en çok onaylı katkısı olan kayıt sahibi (0015)
     *   2) v_report_authors      — son yayın isteğini açan kullanıcı (0012)
     *   3) kurumsal "DendroGeo"  — İSİM UYDURULMAZ
     * (DGR-2026-0004 dersi: istek Sinan'dan gelince künyede Sinan yazdı; oysa
     * 34 kaydın sahibi Nagihan. Ölçen kişi istek açandan önceliklidir.) */
    let author = await resolveReportAuthor(parkId, rest);
    let lulc = null;
    if (!skipLulc && surfaceSnapshot) {
      lulc=savedSurface;
      lulc._outer=surfaceSnapshot.outer[0];
      lulc._png=renderMapPNG({outer:surfaceSnapshot.outer[0],outers:surfaceSnapshot.outer,holes:surfaceSnapshot.holes||[],surfaceFeatures:surfaceSnapshot.displayFeatures||surfaceSnapshot.features,classes:lulc.mapClasses,parkName:park.name,sub:'KAYITLI ANALIZ - '+fmtDateDot(surfaceSnapshot.acceptedAt),points:rows.map(r=>({lat:+r.lat,lon:+r.lon})),pointStat:gfStat,meta:{id:meta?.id,epsg:lulc.epsg,dateStr:fmtDateDot(surfaceSnapshot.acceptedAt),source:'UYDU / OSM / KULLANICI KARARI',resolution:'UYDU 10/20 M; VEKTOR SINIR'}});
      delete lulc.mapClasses;
    } else if (!skipLulc) {
      try {
        const L = await runLULC(park, OG);
        if (L) {
          const g = L.report.groupAreasM2 || {};
          lulc = {
            source: L.report.primaryLabel, citation: L.report.primaryCitation, year: L.report.year,
            cross: L.report.crossLabel, crossError: L.report.crossError || null,
            agreement: L.report.agreement, areaDeltaPct: L.report.areaDeltaPct, cells: L.report.sourceCells,
            coverage_m2: Math.round(L.report.rasterCoverageAreaM2 || 0),
            classified_m2: Math.round(L.report.classifiedAreaM2 || 0),
            epsg: L.epsg || null,
            masked_ha: +(((L.report.maskedAreaM2 || 0) / 10000).toFixed(2)),
            classes: Object.entries(L.report.classes).map(([k, c]) => ({ key: k, label: c.label, ha: +((g[k] || 0) / 10000).toFixed(2), pct: +((100 * (g[k] || 0) / L.report.classifiedAreaM2).toFixed(1)) })),
            _png: renderMapPNG({
              outer: L.outer, holes: L.holes, wruns: L.wruns, classes: L.report.classes,
              parkName: park.name,
              maskHa: +(((L.report.maskedAreaM2 || 0) / 10000).toFixed(2)),
              sub: (L.report.primaryLabel || 'ESA WorldCover 2021') + ' - 10 m',
              sub2: `PROJE SAHASI: ${(park.area_m2 / 10000).toFixed(1)} ha (OSM) - ` + (gfStat
                ? (gfStat.outside > 0
                  ? `OLCUM NOKTASI: POLIGON ICINDE ${gfStat.inside} / DISINDA ${gfStat.outside}`
                  : `${rows.length} ONAYLI OLCUM NOKTASI (POLIGON ICINDE)`)
                : `${rows.length} ONAYLI OLCUM NOKTASI`),
              points: rows.map((r) => ({ lat: +r.lat, lon: +r.lon })),
              pointStat: gfStat,
              meta: {
                id: (meta && meta.id) || null,
                epsg: L.epsg || null,
                dateStr: fmtDateDot(genAt),
                source: DATASET_ASCII,
                engine: ENGINE_VERSION,
              },
            }),
            _outer: L.outer,
          };
        }
      } catch (e) { lulc = { error: String(e && e.message || e) }; }
    }
    /* PNG/outer BINARY taşımaz: snapshot'tan AYRIK döner; hash yalnızca
     * sayfanın/data.json'ın içerdiği alanlar üzerinden hesaplanır → sayfa
     * açılışındaki bütünlük kontrolü ile yayın hash'i aynı şeyi imzalar. */
    const png = lulc && lulc._png ? lulc._png : null;
    const outerL = lulc && lulc._outer ? lulc._outer : null;
    if (lulc) { delete lulc._png; delete lulc._outer; }
    if(meta?.study?.author_name)author={name:meta.study.author_name,full_name:meta.study.author_name,source:'publication_context'};
    const snap = {
      ...(meta?.study ? {study:meta.study} : {}),
      schema: 'dendrogeo-report/1',
      park: { id: park.id, name: park.name, osm_key: park.osm_key, city: park.city, country: park.country, area_m2: park.area_m2 },
      generated_at: genAt,
      /* Üretim izi (2026-09-28): §11 Analiz Parmak İzi ve metadata.json buradan
       * okur. Hash bu alanları da kapsar → parmak izi sonradan değiştirilemez. */
      provenance: buildReportProvenance({
        engineVersion: ENGINE_VERSION,
        appVersion: APP_VERSION,
        gitCommit: meta && meta.git_commit,
        fallbackGitCommit: GIT_COMMIT,
        reportId: meta && meta.id,
        measurementProtocol: rhoBase.measurementLockId,
        measurementProtocolFingerprint: rhoBase.measurementLockFingerprint,
        lulc,
        savedSurface,
        datasetDefault: DATASET_DEFAULT,
      }),
      mc: { ...MC_CFG },
      totals: measurementSummary.totals,
      species: measurementSummary.species,
      gps: measurementSummary.gps,
      period: measurementSummary.period,
      moderation: measurementSummary.moderation,
      geofence: {
        policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)',
        total: rows.length,
        verified_rows: gfInside == null ? rows.length : gfInside,
        outside_rows: gfInside == null ? 0 : rows.length - gfInside,
        polygon_source: savedSurface ? 'Kayıtlı analiz sınırı' : OG ? (park.geom_json && park.geom_json.outer ? 'parks.geom_json' : 'OSM') : 'yok',
      },
      author,
      geometry_qa: geometryQA,
      qa: { species: qaSpecies, photos: { n_with: rows.filter((r) => r.photo_url).length, n: rows.length } },
      lulc,
      rows: rows.map((r) => ({ id: r.id, point_id: r.point_id, species: r.species, grp: r.grp, dbh_cm: +r.dbh_cm, girth_cm: r.girth_cm == null ? null : +r.girth_cm, height_m: +r.height_m, carbon_kg: +r.carbon_kg, volume_m3: r.volume_m3 == null ? null : +r.volume_m3, lat: +(+r.lat).toFixed(6), lon: +(+r.lon).toFixed(6), acc_m: r.accuracy_m, photo: !!r.photo_url, photo_file: r.photo_file || null, date: r.created_at.slice(0, 10) })),
    };
    return { snap, hash: canonicalHash(snap), png, outerL };
  }

  return { buildSnapshot };
}
