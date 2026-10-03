/* DendroGeo · accepted surface snapshot → report LULC adapter
 *
 * Bu modül YALNIZ report_requests.surface_snapshot içindeki sunucu-süzülmüş
 * alan toplamlarını rapor şemasına çevirir. Kullanıcı çizim geometrisi taşımaz.
 * Kabul edilmiş kayıt varsa rapor motorunun yeniden uzaktan-algılama sonucu
 * üretmesi yerine bu değişmez snapshot kullanılır.
 */
export const ACCEPTED_SURFACE_SCHEMA='dendrogeo-surface-accepted/1';
export const SURFACE_CLASSES=[
  ['green','Yeşil alan'],
  ['hard','Sert zemin'],
  ['building','Bina'],
  ['water','Su'],
  ['pool','Havuz / süs havuzu'],
  ['bare','Çıplak zemin'],
  ['other','Diğer'],
];

const finite0=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:0;};
export function isAcceptedSurfaceSnapshot(s){
  return !!(s&&s.schema===ACCEPTED_SURFACE_SCHEMA&&s.areas_m2&&typeof s.areas_m2==='object'&&s.accepted_at);
}

export function acceptedSurfaceToLulc(s,parkAreaM2=0){
  if(!isAcceptedSurfaceSnapshot(s))return null;
  const areas=Object.fromEntries(SURFACE_CLASSES.map(([k])=>[k,finite0(s.areas_m2[k])]));
  const total=Object.values(areas).reduce((a,b)=>a+b,0);
  if(!(total>0))return null;
  const park=finite0(parkAreaM2);
  const year=Number(String(s.accepted_at).slice(0,4))||null;
  return{
    source:'DendroGeo · kabul edilmiş yüzey kaydı',
    citation:'DendroGeo surface review snapshot · '+String(s.accepted_at),
    year,
    cross:null,
    crossError:null,
    agreement:null,
    areaDeltaPct:park>0?+(((total-park)*100/park).toFixed(4)):null,
    cells:null,
    coverage_m2:Math.round(total),
    classified_m2:Math.round(total),
    epsg:null,
    masked_ha:0,
    classes:SURFACE_CLASSES.map(([key,label])=>({
      key,label,
      ha:+((areas[key]/10000).toFixed(4)),
      pct:+((100*areas[key]/total).toFixed(2)),
    })),
    accepted:true,
    accepted_at:String(s.accepted_at),
    revision:Number(s.revision)||null,
    source_fingerprint:s.source_fingerprint||null,
    object_fingerprint:s.object_fingerprint||null,
    geometry_available:false,
  };
}

/* renderReport(), LULC nesnesi varsa harita.png bekler. Kabul edilmiş alan
 * snapshot'ı kişisel/ayrıntılı çizim geometrisini bilerek taşımadığı için
 * olmayan ya da başka bir analizden kalmış PNG'yi göstermemeliyiz. */
export function stripUnavailableSurfaceMap(html){
  let out=String(html||'');
  out=out.replace(/\n?<meta property="og:image"[^>]*>/g,'');
  out=out.replace(/<meta name="twitter:card" content="summary_large_image">/g,'<meta name="twitter:card" content="summary">');
  out=out.replace(/<h2><span class="no">6<\/span>Harita<\/h2>[\s\S]*?<h2><span class="no">7<\/span>Kalite Kontrol ve Doğrulama<\/h2>/,
    '<h2><span class="no">6</span>Yüzey Snapshot Görselleştirmesi</h2><p>Bu rapor, yayın isteği anında dondurulmuş <b>son kabul edilmiş yüzey alanlarını</b> kullanır. Kabul kaydı ayrıntılı kullanıcı çizim geometrisini rapor kuyruğuna taşımadığından bu sürümde yeni bir raster/vektör harita üretilmemiştir; bağlayıcı sayısal değerler Çizelge 2 ve <code>data.json</code> içindedir. Böylece farklı bir tarihte yeniden çalıştırılmış yüzey analizi görseli, kabul edilmiş sayılarla karıştırılmaz.</p>\n\n<h2><span class="no">7</span>Kalite Kontrol ve Doğrulama</h2>');
  out=out.replace(/\s*<a class="btn g" href="harita\.png">[^<]*<\/a>/g,'');
  return out;
}
