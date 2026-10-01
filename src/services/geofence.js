"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tgf=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tgff=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* DendroGeo · services/geofence.js — KONUM DOĞRULAMASI (2026-09-26, kullanıcı isteği)
 *
 * İSTEK: "proje yapılacağı zaman veya projeye fotoğraf ekleneceği zaman
 * konumdan doğrulama alsın; aynı projeye farklı parklardan giriş yapılmasın;
 * her proje park ile eşitlensin; hatalı girişlerin önüne geçilsin."
 *
 * İKİ KATMANLI ÇİTİN İSTEMCİ YARISI:
 *   1) dgFreshFix()        → taze GPS fix'i (yüksek hassasiyet, ≤120 sn bayatlık)
 *   2) dgGeoDecide()       → SAF karar: poligon içinde mi / kenara ≤40 m mi /
 *                             hassasiyet eşiği / miras park daire yedeği
 *   3) dgVerifyAtPark()    → kullanıcıya anlaşılır mesaj + sebep kodu
 *   4) dgGeoStamp()        → doğrulama damgası satıra yazılır (audit)
 * Sunucu yarısı supabase/migrations/0007_geo_fence.sql → trg_geo_fence:
 * istemci atlatılsa bile park dışı ölçüm INSERT/UPDATE'i REDDEDİLİR.
 *
 * EŞİKLER (DG_GEO): saha gerçeklerine göre seçildi, tek yerden değiştirilir:
 *   ACC_MAX_M  ±60 m   → bundan kaba GPS'le "doğrulandı" damgası vurulmaz
 *   MARGIN_M   40 m    → poligon kenarının bu kadar dışı GPS gürültüsü sayılır
 *                         (OSM poligonları da ±birkaç m kayar); ötesi RED
 *   FIX_MAX_AGE_S 120  → 2 dakikadan bayat fix "taze doğrulama" değildir
 *
 * YÜKLEME SIRASI: park zincirinde park-geometry'den SONRA (pointInPark,
 * pointToSegmentDistanceM) ve measure/park-registry'den ÖNCE. Tüm çapraz
 * referanslar ÇAĞRI ANINDA çözülür.
 */

const DG_GEO={ACC_MAX_M:60,MARGIN_M:40,FIX_MAX_AGE_S:120,RING_MAX_POINTS:500};

/* Park halkasına en kısa uzaklık (m). pointToSegmentDistanceM park-geometry'de.
 * Poligon DIŞINDAKİ bir noktanın "kenara ne kadar uzak" olduğunu söyler →
 * MARGIN_M kararı ve kullanıcıya gösterilen mesafe bununla kurulur. */
function dgDistToParkM(lat,lon,geom){
 if(!geom||!Array.isArray(geom.outer)||!geom.outer.length)return null;
 let best=Infinity;
 for(const ring of geom.outer){
  if(!Array.isArray(ring)||ring.length<2)continue;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const d=pointToSegmentDistanceM(lat,lon,ring[j],ring[i]);
   if(d<best)best=d;
  }
 }
 return Number.isFinite(best)?best:null;
}

/* SAF KARAR FONKSİYONU (DOM/ağ yok → birim testlenebilir).
 * fix   : {lat,lon,acc}
 * park  : parks satırı (geom_json {outer,inner}, centroid_*, area_m2, name)
 * dönüş : {ok, verified, inside, reason, distM, acc}
 *   reason: inside | margin | circle | no-park | no-geom | acc | outside
 * verified=true yalnızca POLİGON (veya kenar payı) kararıyla damgalanır;
 * miras parkın daire yedeği "ok" olabilir ama "verified" OLMAZ. */
function dgGeoDecide(fix,park,opt){
 const cfg=Object.assign({},DG_GEO,opt||{});
 if(!park)return{ok:true,verified:false,inside:false,reason:"no-park",distM:null,acc:fix&&fix.acc};
 if(!fix||!Number.isFinite(+fix.lat)||!Number.isFinite(+fix.lon))
  return{ok:false,verified:false,inside:false,reason:"no-fix",distM:null,acc:null};
 const acc=Number.isFinite(+fix.acc)?+fix.acc:null;
 if(acc!=null&&acc>cfg.ACC_MAX_M)
  return{ok:false,verified:false,inside:false,reason:"acc",distM:null,acc};
 const geom=park.geom_json&&Array.isArray(park.geom_json.outer)?park.geom_json:null;
 const distM=park.centroid_lat!=null
  ?Math.round(hav(+fix.lat,+fix.lon,+park.centroid_lat,+park.centroid_lon)):null;
 if(!geom){
  /* MİRAS PARK: geometri sunucuda yok → alan-yarıçaplı daire yedeği.
   * Doğrulandı DAMGASI vurulmaz (verified=false), ama saha çalışması bloklanmaz. */
  if(distM==null)return{ok:true,verified:false,inside:false,reason:"no-geom",distM:null,acc};
  const r=Math.max(150,Math.sqrt((+park.area_m2||0)/Math.PI)*1.25);
  return distM<=r
   ?{ok:true,verified:false,inside:false,reason:"circle",distM,acc}
   :{ok:false,verified:false,inside:false,reason:"outside",distM,acc};
 }
 const inside=pointInPark(+fix.lat,+fix.lon,geom);
 const edge=inside?0:(dgDistToParkM(+fix.lat,+fix.lon,geom)||Infinity);
 if(inside)return{ok:true,verified:true,inside:true,reason:"inside",distM,acc};
 if(edge<=cfg.MARGIN_M)return{ok:true,verified:true,inside:false,reason:"margin",distM,acc,edgeM:Math.round(edge)};
 return{ok:false,verified:false,inside:false,reason:"outside",distM,acc,edgeM:Math.round(edge)};
}

/* TAZE GPS FIX'İ. watchPosition'ın son değeri bayat olabileceği için doğrulama
 * anında TEKİL yüksek-hassasiyetli okuma alınır. Red sebepleri kodludur:
 * denied (izin yok) | timeout | unavailable. */
function dgFreshFix(maxAgeS){
 return new Promise((res,rej)=>{
  if(typeof navigator==="undefined"||!("geolocation" in navigator))
   return rej({code:"unavailable",message:"Cihazda konum servisi yok"});
  navigator.geolocation.getCurrentPosition(
   p=>res({lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,at:Date.now()}),
   e=>rej({code:e.code===1?"denied":(e.code===3?"timeout":"unavailable"),message:e.message||("kod "+e.code)}),
   {enableHighAccuracy:true,timeout:15000,maximumAge:(Number.isFinite(+maxAgeS)?+maxAgeS:DG_GEO.FIX_MAX_AGE_S)*1000});
 });
}

/* PARKTA MIYIM? Mesajları burada kurulur ki her çağrı yeri aynı dili konuşsun. */
async function dgVerifyAtPark(park,why){
 if(!park)return{ok:true,verified:false,reason:"no-park"};
 let fix;
 try{fix=await dgFreshFix();}
 catch(e){
  const code=(e&&e.code)||"unavailable";
  /* CİHAZDA KONUM YETENEĞİ HİÇ YOKSA (masaüstü sensörsüz, test koşumu vb.)
   * sert blok SAHA DIŞI cihazları tamamen kilitleyen düşmanca bir davranış
   * olurdu. Bu durumda istemci damga vurmaz ama SUNUCU ÇİTİ (trg_geo_fence)
   * gönderilen lat/lon ile parkı doğrulamaya DEVAM eder — yani yanlış parktan
   * giriş yine reddedilir; yalnızca "yerinde doğrulandı" damgası eksik kalır.
   * izin (denied) ve zaman aşımı KULLANICI TARAFINDAN çözülebilir → sert blok. */
  if(code==="unavailable"){
   console.warn("DENDROGEO · konum servisi yok → yerinde doğrulama yapılamadı (sunucu çiti aktif)");
   return{ok:true,verified:false,reason:"no-geo",distM:null,acc:null,
    message:_tgf("Cihazda konum servisi yok: yerinde doğrulama yapılamadı; sunucu çiti yine de park dışı girişi reddeder.")};
  }
  return{ok:false,verified:false,reason:code,
   message:code==="denied"
    ?_tgff("Konum izni gerekli: bu {w} yalnızca {p} içinden veri kabul eder. Tarayıcı ayarlarından konuma izin ver.",{w:_tgf(why==="project"?"proje":"ölçüm"),p:park.name||_tgf("parkı")})
    :_tgff("Konum alınamadı ({e}). Açık alanda yeniden dene.",{e:(e&&e.message||code)})};
 }
 const d=dgGeoDecide(fix,park);
 d.fix=fix;
 if(!d.ok&&d.reason==="acc")
  d.message=_tgff("GPS hassasiyeti ±{a} m (eşik ±{m} m). Açık alanda bekleyip yeniden dene.",{a:Math.round(d.acc),m:DG_GEO.ACC_MAX_M});
 if(!d.ok&&d.reason==="outside")
  d.message=_tgff("Konumun {p} DIŞINDA (kenara ~{d} m). Bu proje yalnızca bu parktan veri kabul eder — başka parktan giriş engellendi.",{p:(park.name||_tgf("park")),d:(d.edgeM!=null?d.edgeM:d.distM)});
 return d;
}

/* Doğrulama damgası → ölçüm satırı (audit + yönetici görünürlüğü). */
function dgGeoStamp(base,dec){
 if(!base||!dec||!dec.fix)return base;
 base.geo_acc_m=dec.acc!=null?Math.round(dec.acc):null;
 base.geo_dist_m=dec.distM;
 if(dec.verified)base.geo_verified_at=new Date().toISOString();
 return base;
}

/* Halkayı sunucuya yazılabilir boyuta indir (500 nokta/park ≈ 30 KB üstü jsonb
 * gereksiz; çit için bu çözünürlük fazlasıyla yeterli). */
function dgSimplifyRing(ring,max){
 if(!Array.isArray(ring)||ring.length<=max)return ring;
 /* İndeks matematiği (k*n/max): kayan nokta ADIM birikimiyle (i+=step) halka
  * boyu ±1 oynuyordu ve jsonb boyutu testte 502 çıkıyordu; bu biçim
  * DETERMİNİSTİK tam max nokta üretir. */
 const out=[];
 for(let k=0;k<max;k++)out.push(ring[Math.floor(k*ring.length/max)]);
 if(out.length<3)return ring;
 out.push(out[0]);
 return out;
}

/* Tarama sırasında bellekteki halkayı parks.geom_json'a yazar (0007).
 * PARK_POLY/PARK_HOLES park-state.js'te; çağrı anında çözülür.
 * Başarısızlık ÖLÜMCÜL DEĞİL: sunucu o park için daire yedine düşer. */
async function dgPersistParkGeom(park){
 try{
  const outer=(typeof PARK_POLY!=="undefined"&&Array.isArray(PARK_POLY)&&PARK_POLY.length>=3)?PARK_POLY:null;
  if(!park||!park.id||!outer)return park;
  const holes=(typeof PARK_HOLES!=="undefined"&&Array.isArray(PARK_HOLES))?PARK_HOLES:[];
  const geom={outer:[dgSimplifyRing(outer,DG_GEO.RING_MAX_POINTS)],
              inner:holes.map(h=>dgSimplifyRing(h,DG_GEO.RING_MAX_POINTS)).filter(h=>h&&h.length>=3)};
  const{data,error}=await sb.from("parks").update({geom_json:geom}).eq("id",park.id).select().single();
  if(error){console.warn("DENDROGEO · park geometrisi sunucuya yazılamadı (daire yedeği geçerli):",error.message);return park;}
  return data||park;
 }catch(e){console.warn("DENDROGEO · dgPersistParkGeom:",e);return park;}
}
