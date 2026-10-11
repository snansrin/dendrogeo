/* Resolve the authoritative park boundary for report analysis.
 * Accepted geometry is preferred; bounding boxes fall back to OSM geometry. */
export function createReportParkGeometrySource({fetch: fetchImpl, bboxRing, extractRings}) {
  return async function parkOuter(park) {
    /* 0011 (2026-09-28 · Göksu bulgusu): geom_json her zaman gerçek sınır
     * DEĞİLDİR — park 25'te 5 noktalı dikdörtgen (bbox) taşıyordu; jeodezik
     * alanı 68,93 ha, künye alanı 50,11 ha. LULC "alan dengesi" QA kapısı bu
     * yüzden %37,6 farkla haklı olarak bloke etti. Bbox tespit edilirse
     * geom_json YOK SAYILIR ve OSM poligonuna düşülür; karar geometry_qa
     * üzerinden §2/§7/§9'da beyan edilir. */
    if (park.geom_json && park.geom_json.outer && !bboxRing(park.geom_json.outer[0]))
      return { outer: park.geom_json.outer[0], holes: (park.geom_json.inner || []) };
    const m = String(park.osm_key || '').match(/^(way|relation)\/(\d+)$/);
    if (!m) return null;
    let outer = null, holes = [];
    if (m[1] === 'way') {
      /* OSM ana API: way/full.json node ID'leri verir → way.nodes sırasıyla halka */
      const r = await fetchImpl(`https://api.openstreetmap.org/api/0.6/way/${m[2]}/full.json`, { headers: { 'User-Agent': 'DendroGeo-rapor/1.0 (https://dendrogeo.org)' } });
      if (!r.ok) return null;
      const j = await r.json();
      const nd = {}; for (const e of j.elements) if (e.type === 'node') nd[e.id] = [e.lat, e.lon];
      const way = j.elements.find((e) => e.type === 'way');
      outer = (way?.nodes || []).map((id) => nd[id]).filter(Boolean);
    } else {
      /* relation: Overpass 'out geom' üye geometrisi verir (uygulamayla aynı kaynak tipi) */
      const q = `[out:json][timeout:60];relation(${m[2]});out geom;`;
      let j = null;
      for (const mir of ['https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter']) {
        try {
          const r = await fetchImpl(mir, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DendroGeo-rapor/1.0' }, body: 'data=' + encodeURIComponent(q) });
          if (r.ok) { j = await r.json(); break; }
        } catch (e) { /* ayna dene */ }
      }
      if (!j) return null;
      const el = j.elements && j.elements[0];
      const rings = el ? extractRings(el) : null;
      if (!rings) return null;
      if (Array.isArray(rings)) { outer = rings[0]; holes = rings.slice(1); }
      else { outer = (rings.outer || [])[0]; holes = rings.inner || rings.holes || []; }
    }
    if (!outer || outer.length < 4) return null;
    return { outer, holes };
  }
}
