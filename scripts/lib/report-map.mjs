import { PngCanvas, hex2rgb } from './png.mjs';
import { fmtDateDot } from './report-formatting.mjs';

export const DATASET_ASCII = 'ESA WORLDCOVER 2021 V200';

/* Şekil 2 — park sahası haritası.
 * Katman sırası (bilinçli): (1) park dışı bağlam dokusu, (2) park poligonu
 * taban boyası (maskeli/veri yok tonu → poligon içinde beyaz dilim fiziken
 * imkânsız), (3) çözümleme motorunun kesintisiz run-length hücreleri,
 * (4) park sınırı (beyaz halo + koyu mürekkep), (5) envanter noktaları,
 * (6) lejant / ölçek / kuzey oku. */
export const MAP_TONES = { out: [238, 240, 238], nodata: [212, 212, 208], ink: [24, 36, 32], mut: [104, 118, 110], halo: [255, 255, 255] };
function fillRing(cv, pts, col) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(cv.h - 1, Math.ceil(y1));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ya = pts[j][1], yb = pts[i][1];
      if ((ya > y + 0.5) !== (yb > y + 0.5)) xs.push(pts[j][0] + (y + 0.5 - ya) / (yb - ya) * (pts[i][0] - pts[j][0]));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) cv.rect(xs[i], y, xs[i + 1], y, col);
  }
}
function strokeRing(cv, pts, col, thick = 1) {
  const OFF = thick <= 1 ? [[0, 0]] : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  for (const [ox, oy] of OFF)
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
      cv.line(pts[j][0] + ox, pts[j][1] + oy, pts[i][0] + ox, pts[i][1] + oy, col);
}
function disc(cv, x, y, r, col) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
    if (dx * dx + dy * dy <= r * r) cv.set(x + dx, y + dy, col);
}
export function mapCanvas({ outer, outers = null, surfaceFeatures = [], holes = [], wruns = [], classes = {}, parkName = '', sub = '', sub2 = '', maskHa = 0, points = [], pointStat = null, meta = null }) {
  const PAD = 26, TOP = 96, MAPH = 540, FOOT = 70;
  let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180;
  for (const [la, lo] of (outers||[outer]).flat()) { minLa = Math.min(minLa, la); maxLa = Math.max(maxLa, la); minLo = Math.min(minLo, lo); maxLo = Math.max(maxLo, lo); }
  const dxM = Math.max(1, (maxLo - minLo) * 111320 * Math.cos(((minLa + maxLa) / 2) * Math.PI / 180));
  const dyM = Math.max(1, (maxLa - minLa) * 110540);
  const W = Math.max(420, Math.min(1000, Math.round((MAPH - 2 * PAD) * dxM / dyM) + 2 * PAD));
  const k = Math.max(0.02, Math.min((W - 2 * PAD) / dxM, (MAPH - 2 * PAD) / dyM));
  const cx = (minLo + maxLo) / 2, cy = (minLa + maxLa) / 2;
  const X = (lon) => W / 2 + (lon - cx) * 111320 * Math.cos(cy * Math.PI / 180) * k;
  const Y = (lat) => TOP + (MAPH - 2 * PAD) / 2 - (lat - cy) * 110540 * k;
  /* PNG sunumu: havuz / süs havuzu ayrı bir kartografik sınıf değildir.
   * Bilimsel snapshot ve rapor tablosundaki "pool" alanı DEĞİŞMEZ; yalnız PNG'de
   * su ile aynı renkte ve aynı lejant satırında gösterilir. */
  const pngClassKey = (key) => key === 'pool' ? 'water' : key;
  const pngClass = (key) => {
    const dk = pngClassKey(key);
    return classes[dk] || classes[key] || null;
  };
  const legRows = ['green', 'hard', 'building', 'water', 'bare', 'other']
    .filter((key) => key === 'water' ? (classes.water || classes.pool) : classes[key])
    .concat(maskHa > 0 ? ['masked'] : [], ['border', 'point', 'outside']);
  const H = TOP + MAPH + 16 + legRows.length * 28 + 18 + FOOT;
  const cv = new PngCanvas(W, H, MAP_TONES.out);
  const ring = outer.map(([la, lo]) => [X(lo), Y(la)]);
  fillRing(cv, ring, MAP_TONES.nodata);                       /* taban: veri yok tonu */
  for (const h of holes) fillRing(cv, h.map(([la, lo]) => [X(lo), Y(la)]), MAP_TONES.out);
  for (const r of wruns)                                      /* kesintisiz hücre örtüsü */
    cv.rect(X(r.lo0), Y(r.la1), X(r.lo1), Y(r.la0), hex2rgb((pngClass(r.key) && pngClass(r.key).color) || '#94a3b8'));
  for(const f of surfaceFeatures)for(const poly of f.geometry.coordinates){
    const rings=poly.map(r=>r.map(([lo,la])=>[X(lo),Y(la)]));
    fillSurfacePolygon(cv,rings,hex2rgb(pngClass(f.properties.class)?.color||'#94a3b8'));
  }
  /* KRIPMA GEÇİŞİ: run-length bantları satır içindeki poligon dışı boşlukları
   * köprüleyebildiği için (içbükey girinti) harita alanı taranır ve poligon
   * (delikler dâhil, tek-çift kuralı) dışındaki pikseller bağlam dokusuna
   * geri boyanır. Böylece hem beyaz/gri dilim kalmaz hem de park sahasının
   * dışına sınıf rengi taşmaz. */
  const allRings = [...(outers||[outer]).map(r=>r.map(([la,lo])=>[X(lo),Y(la)])), ...holes.map((h) => h.map(([la, lo]) => [X(lo), Y(la)]))];
  const yMap1 = Math.min(cv.h - 1, TOP + MAPH);
  for (let y = 0; y <= yMap1; y++) {
    const xs = [];
    for (const rg of allRings) for (let i = 0, j = rg.length - 1; i < rg.length; j = i++) {
      const ya = rg[j][1], yb = rg[i][1];
      if ((ya > y + 0.5) !== (yb > y + 0.5)) xs.push(rg[j][0] + (y + 0.5 - ya) / (yb - ya) * (rg[i][0] - rg[j][0]));
    }
    xs.sort((a, b) => a - b);
    let x = 0;
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil(xs[i] ?? 0)), b = Math.min(cv.w - 1, Math.floor(xs[i + 1] ?? cv.w));
      if (x < a) cv.rect(x, y, a - 1, y, MAP_TONES.out);
      x = Math.max(x, b + 1);
    }
    if (x < cv.w) cv.rect(x, y, cv.w - 1, y, MAP_TONES.out);
  }
  /* İNCE ÇERÇEVE (2026-09-28): harita alanı kartografik çerçeve alır; kırpma
   * geçişinden SONRA çizilir (aksi hâlde bağlam dokusu çerçeveyi silerdi). */
  const FR = [206, 210, 206];
  const fx0 = PAD - 12, fy0 = TOP - 12, fx1 = W - PAD + 12, fy1 = TOP + MAPH + 12;
  cv.line(fx0, fy0, fx1, fy0, FR); cv.line(fx0, fy1, fx1, fy1, FR);
  cv.line(fx0, fy0, fx0, fy1, FR); cv.line(fx1, fy0, fx1, fy1, FR);
  strokeRing(cv, ring, MAP_TONES.halo, 2);                    /* halo: sınır her zeminde okunur */
  strokeRing(cv, ring, MAP_TONES.ink, 1);
  /* Envanter noktaları YALNIZ harita çerçevesi içine çizilir: poligondan
   * çok uzak (eski/hatalı GNSS) bir kayıt lejant/altbilgi üzerine binemez. */
  for (const p of points) {
    const pxX = X(p.lon), pxY = Y(p.lat);
    if (pxX < fx0 || pxX > fx1 || pxY < fy0 || pxY > fy1) continue;
    disc(cv, pxX, pxY, 5, MAP_TONES.halo); disc(cv, pxX, pxY, 3, MAP_TONES.ink);
  }
  const T = (x, y, t, c, sc) => cv.text(x, y, t, c, sc);
  T(PAD, 12, parkName, MAP_TONES.ink, 3);
  T(PAD, 44, sub, MAP_TONES.mut, 2);
  if (sub2) T(PAD, 66, sub2, MAP_TONES.mut, 2);
  /* Belge kimliği sağ üstte: harita tek başına dolaşıma girse bile hangi
   * DGR'ye ait olduğu üzerinde yazılıdır (kullanıcı standardı md. 10). */
  if (meta && meta.id) {
    const tid = String(meta.id);
    T(Math.max(PAD, W - PAD - 12 * tid.length), 12, tid, MAP_TONES.mut, 2);
  }
  let ly = TOP + MAPH + 10;
  for (const key of legRows) {
    if (key === 'border') {
      cv.line(PAD + 2, ly + 11, PAD + 20, ly + 11, MAP_TONES.ink);
      T(PAD + 32, ly + 4, 'PARK SINIRI (OSM POLIGONU)', MAP_TONES.ink, 2);
    } else if (key === 'point') {
      disc(cv, PAD + 11, ly + 11, 5, MAP_TONES.halo); disc(cv, PAD + 11, ly + 11, 3, MAP_TONES.ink);
      T(PAD + 32, ly + 4, pointStat && pointStat.outside > 0
        ? `ENVANTER NOKTASI (ICINDE ${pointStat.inside} / DISINDA ${pointStat.outside})`
        : `ENVANTER NOKTASI (n=${points.length}, POLIGON ICINDE)`, MAP_TONES.ink, 2);
    } else if (key === 'outside') {
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, MAP_TONES.out);
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 2, [190, 194, 190]);
      T(PAD + 32, ly + 4, 'PARK DISI (BAGLAM)', MAP_TONES.mut, 2);
    } else if (key === 'masked') {
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, MAP_TONES.nodata);
      T(PAD + 32, ly + 4, `MASKELI (BULUT/GOLGE) ${maskHa.toFixed(2)} ha`, MAP_TONES.mut, 2);
    } else {
      const c = pngClass(key);
      const areaM2 = key === 'water'
        ? Number(classes.water?.areaM2 || 0) + Number(classes.pool?.areaM2 || 0)
        : Number(c?.areaM2 || 0);
      const label = key === 'water' ? (classes.water?.label || 'Su') : c.label;
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, hex2rgb(c.color));
      T(PAD + 32, ly + 4, `${label} ${(areaM2 / 10000).toFixed(2)} ha`, MAP_TONES.ink, 2);
    }
    ly += 28;
  }
  /* ÖLÇEK ÇUBUĞU: dönüşümlü koyu/açık segmentler (klasik kartografik biçim);
   * kuzey oku aynen kalır. */
  const nice = [10, 20, 50, 100, 200, 500].find((m) => m * k > 90) || 1000;
  const barW = nice * k, segN = 4, sx0 = W - PAD - barW, sy0 = TOP + MAPH - 40, sy1 = TOP + MAPH - 32;
  for (let i = 0; i < segN; i++) {
    const a = sx0 + barW * i / segN, b = sx0 + barW * (i + 1) / segN;
    cv.rect(a, sy0, b - 1, sy1, i % 2 === 0 ? MAP_TONES.ink : [255, 255, 255]);
  }
  cv.line(sx0, sy0, sx0 + barW, sy0, MAP_TONES.ink);
  cv.line(sx0, sy1, sx0 + barW, sy1, MAP_TONES.ink);
  cv.line(sx0, sy0, sx0, sy1, MAP_TONES.ink);
  cv.line(sx0 + barW, sy0, sx0 + barW, sy1, MAP_TONES.ink);
  T(sx0, sy0 - 22, nice + ' m', MAP_TONES.ink, 2);
  cv.line(W - PAD - 14, TOP + 60, W - PAD - 14, TOP + 26, MAP_TONES.ink);
  cv.line(W - PAD - 20, TOP + 36, W - PAD - 14, TOP + 24, MAP_TONES.ink);
  cv.line(W - PAD - 8, TOP + 36, W - PAD - 14, TOP + 24, MAP_TONES.ink);
  T(W - PAD - 24, TOP + 66, 'N', MAP_TONES.ink, 2);
  /* ALT BİLGİ ŞERİDİ (kullanıcı standardı md. 10): belge kimliği, veri
   * kaynağı, çözünürlük, projeksiyon, analiz tarihi, motor sürümü ve telif.
   * Metin ASCII'ye translitere edilir (png.mjs glif kümesi); dar tuvallerde
   * punto otomatik küçülür (Tfit), taşma olmaz. */
  const fy = H - FOOT + 12;
  cv.line(PAD, fy - 8, W - PAD, fy - 8, FR);
  const Tfit = (x, y, txt, c) => T(x, y, txt, c, (12 * txt.length <= W - 2 * PAD) ? 2 : 1);
  const idLine = meta && meta.id ? ('DENDROGEO - ' + meta.id) : 'DENDROGEO - BILIMSEL ANALIZ HARITASI';
  T(PAD, fy, idLine, MAP_TONES.ink, 2);
  const brandMark = 'DENDROGEO 2026';
  if (W - PAD - 12 * brandMark.length > PAD + 12 * idLine.length + 8) T(W - PAD - 12 * brandMark.length, fy, brandMark, MAP_TONES.mut, 2);
  Tfit(PAD, fy + 20, 'VERI: ' + ((meta && meta.source) || DATASET_ASCII) + ' / COZUNURLUK: '+(meta?.resolution||'10 M') + (meta && meta.epsg ? ' / PROJEKSIYON: EPSG:' + meta.epsg : ''), MAP_TONES.mut);
  if (meta && (meta.dateStr || meta.engine)) {
    const l3 = (meta.dateStr ? 'ANALIZ TARIHI: ' + meta.dateStr : '') +
      (meta.dateStr && meta.engine ? ' / ' : '') +
      (meta.engine ? 'DENDROGEO LC ENGINE V' + meta.engine : '') + ' / CC BY-NC 4.0';
    Tfit(PAD, fy + 40, l3, MAP_TONES.mut);
  }
  return cv;
}
export function renderMapPNG(opts) { return mapCanvas(opts).encode(); }

function fillSurfacePolygon(cv,rings,col){
 const pts=rings.flat();let y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))),y1=Math.min(cv.h-1,Math.ceil(Math.max(...pts.map(p=>p[1]))));
 for(let y=y0;y<=y1;y++){const xs=[];for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if((a[1]>y+.5)!==(b[1]>y+.5))xs.push(a[0]+(y+.5-a[1])/(b[1]-a[1])*(b[0]-a[0]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)cv.rect(xs[i],y,xs[i+1],y,col);}
}
