"use strict";
/* 0035c: EN modu için kısa çeviri yardımcısı (i18n yoksa TR döner). */
const _tw=(s)=>(typeof dgT==="function"?dgT(s):s);
/* ============ PARK KARŞILAŞTIRMA + RAPOR ============
 * 2026-09-24 DEĞİŞİKLİK (kullanıcı isteği): bu liste artık PROJELERE VERİLEN
 * ADLARI değil, ALGILANAN PARKLARI gösterir. 3 kişi Göksu Parkı'nda çalıştıysa
 * üç proje satırı değil TEK "Göksu Parkı" satırı çıkar; kayıt/karbon/katılımcı
 * sayıları o parkta birleşir.
 *
 * Kaynak: public.v_park_compare (0004_parks.sql). View park bazında GROUP BY
 * yaptığı için iki eski sorun da biter:
 *   · istemcide .limit(5000) ile ham satır çekip toplama → kesilme riski yok,
 *     satır sayısı park sayısıyla sınırlı (bkz. utils/truncation.js gerekçesi),
 *   · proje adı değişince sıralamanın değişmesi → kimlik artık OSM elemanı.
 *
 * Park bağı olmayan ESKİ projeler kaybolmaz: park_id=0 + park_pending=true
 * ile ayrı, sıralamaya karışmayan bir bölümde listelenir. Yönetim →
 * "🌳 Parkları Geri Doldur" aracı bunları ölçüm merkezinden OSM parkıyla
 * eşleştirip ana listeye taşır. */
let PARK_DATA=[];   /* seçili parkın ham ölçüm satırları (rapor için) */
let PARK_ROWS=[];   /* v_park_compare satırları */
const DG_WORLD_PARK_COMPARISON_MODULE_STORE=window.DG_WORLD_PARK_COMPARISON_STORE?window.DG_WORLD_PARK_COMPARISON_STORE.create(()=>sb):null;

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadParkCompare(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadParkCompare__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadParkCompare__scroll(){
 /* v_park_compare supplies park-level contributors; the primary path stays park-keyed. */
 const el=$("parkCompare");
 const{data,error}=await(DG_WORLD_PARK_COMPARISON_MODULE_STORE?DG_WORLD_PARK_COMPARISON_MODULE_STORE.primary():sb.from("v_park_compare").select("*").order("carbon_kg",{ascending:false}));

 /* Şema eski (0004 çalıştırılmamış) → sayfa boş kalmasın diye proje bazlı
  * eski toplama yedek olarak çalışır ve kullanıcıyı migration'a yönlendirir.
  *
  * ⚠ HATA SINIFLANDIRMASI (2026-09-26): her hata "şema eski" DEĞİLDİR.
  * v_park_compare bilinçli olarak YALNIZ authenticated'a açık
  * (0004_parks.sql: "revoke select on public.v_park_compare from anon").
  * Oturum yokken, JWT tazelenirken ya da token süresi dolmuşken 401/42501
  * döner; eskiden bu da dgParkSchemaMissing'e gidiyordu. Sonuçları ağırdı:
  *   · yönetici ZATEN UYGULANMIŞ bir migration'ı yeniden çalıştırmaya
  *     yönlendiriliyordu ("0004_parks.sql çalıştırılmalı"),
  *   · dgParkSchemaMissing DG_PARK_SCHEMA_OK=false yaptığı için ÖLÇÜM KAPISI
  *     kapanıyor ve yeni kayıtlar park_id'siz yazılıyordu
  *     (measure.js:278 gate, measure.js:318 park_id=null).
  * Yetki/ağ hataları artık ayrı ele alınır; şema bayrağına DOKUNMAZ. */
 if(error){
  if(!dgIsSchemaError(error)){
   dgParkCompareDenied(error);
   return;
  }
  dgParkSchemaMissing("v_park_compare: "+error.message);
  return loadParkCompareLegacy(el);
 }

 PARK_ROWS=data||[];
 const prepared=window.DG_PREPARE_PARK_COMPARISON?window.DG_PREPARE_PARK_COMPARISON.prepare(PARK_ROWS):null;
 const linked=prepared?prepared.linked:PARK_ROWS.filter(r=>Number(r.park_id)>0);
 const pending=prepared?prepared.pending:PARK_ROWS.filter(r=>!(Number(r.park_id)>0));
 const max=prepared?prepared.max:(linked.length?Math.max(...linked.map(r=>Number(r.carbon_kg)||0)):1);

 if(!el)return;

 el.innerHTML=
  (linked.length?linked.map((p,i)=>dgParkRowHTML(p,i,max)).join("")
   :'<div style="color:var(--mut);font-size:.85rem">Henüz park kimliğine bağlı onaylı kayıt yok. Ölçüm girmeden önce park algıla: Canlı Harita → 🌳 Park Algılama.</div>')
  +dgPendingParksHTML(pending);

 dgFillReportOptions(linked,pending);
}

/* Karşılaştırma satırı — MOBİL UYUMLU (2026-09-24): eskiden tümü satır içi
 * stildi, bu yüzden dar ekranda eziliyordu ve media query ile düzeltilemiyordu.
 * Artık sınıflarla çiziliyor; css/style.css .dg-cmp-* kuralları 640px altında
 * bar'ı alta alıyor, metni sarmalıyor. */
function dgParkRowHTML(p,i,max){
 /* CSS contract in the extracted renderer: class="dg-cmp-row, dg-cmp-main, dg-cmp-bar. */
 return window.DG_PARK_COMPARISON_ROW.render(p,i,max,{escape:esc,translate:_tw,formatHa:dgFmtHa});
}

function dgPendingParksHTML(pending){
 /* Locked source contract: PARK ALGILANMAMIŞ KAYITLAR; const admin=(typeof dgIsAdmin==="function")?dgIsAdmin():false;
  * admin?`<button class="btn sm ghost dg-pend-act" onclick="startParkScan({returnTo:'world'})";
  * normal users see "🔐 yönetici bağlayacak" and never get the scan action. */
 return window.DG_PARK_COMPARISON_PENDING.render(pending,{isAdmin:typeof dgIsAdmin==="function"&&dgIsAdmin(),escape:esc});
}

function dgFillReportOptions(linked,pending){
 window.DG_PARK_REPORT_OPTIONS_UI.render($("repProject"),linked,pending,esc);
}

/* YETKİ/AĞ HATASI — şema bayrağına dokunmaz (2026-09-26).
 * dgParkSchemaMissing'in aksine DG_PARK_SCHEMA_OK=false YAPMAZ: ölçüm kapısı
 * ve park_id yazımı açık kalır. Kullanıcıya gerçek sebep söylenir. */
/* 0040: kaydırma koruma sarmalı. */
function dgParkCompareDenied(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgParkCompareDenied__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgParkCompareDenied__scroll(error){
 const code=(error&&(error.code||error.status))||"";
 const msg=(error&&error.message)||String(error||"bilinmeyen hata");
 console.warn("DENDROGEO · park karşılaştırma okunamadı (şema değil, yetki/ağ):",code,msg);
 const el=$("parkCompare");
 const adm=(typeof dgIsAdmin==="function")?dgIsAdmin():false;
 /* Hata kullanıcıya gösterilir; şema durumu burada değiştirilmez. */
 if(el)el.innerHTML=window.DG_PARK_COMPARISON_ERROR_UI.render({code,message:msg,isAdmin:adm,escape:esc});
 toast(dgCf("Park karşılaştırması yüklenemedi: ")+(code||msg),"warn","🌳");
}

/* Şema eskiyse (migration 0004 uygulanmamış) karşılaştırma proje bazlı eski
 * davranışa düşer — sayfa boş kalmasın, ama kullanıcı sebebini bilsin. */
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadParkCompareLegacy(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadParkCompareLegacy__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadParkCompareLegacy__scroll(el){
 const{data,count}=await(DG_WORLD_PARK_COMPARISON_MODULE_STORE?DG_WORLD_PARK_COMPARISON_MODULE_STORE.legacy():sb.from("measurements").select("carbon_kg,dbh_cm,height_m,species,grp,projects(name,city)",{count:"exact"}).eq("status","Onaylı").limit(5000));
 dgWarnIfTruncated(data,5000,"Park karşılaştırma",count);
 PARK_DATA=data||[];
 const grouped=window.DG_GROUP_LEGACY_PARK_COMPARISON?window.DG_GROUP_LEGACY_PARK_COMPARISON.group(PARK_DATA):null;
 if(grouped&&window.DG_LEGACY_PARK_COMPARISON_UI){
  const list=grouped.parks;
  if(!el)return;
  el.innerHTML=window.DG_LEGACY_PARK_COMPARISON_UI.render(list,grouped.max,{escape:esc,translate:_tw});
  const rep=$("repProject");if(rep)rep.innerHTML=window.DG_LEGACY_PARK_COMPARISON_UI.reportOptions(list,esc);
  return;
 }
 const by={};
 PARK_DATA.forEach(r=>{
  const name=r.projects?.name||"—";
  const p=by[name]=by[name]||{name,city:r.projects?.city||"—",n:0,c:0,dbh:0,h:0};
  p.n++;p.c+=(r.carbon_kg||0);p.dbh+=(r.dbh_cm||0);p.h+=(r.height_m||0);
 });
 const list=Object.values(by).sort((a,b)=>b.c-a.c);
 const max=list.length?list[0].c:1;
 if(!el)return;
 el.innerHTML=
  `<div class="alert warn" style="margin-bottom:10px"><b>⚠ Veritabanı şeması eski:</b> park kimliği tabloları yok, liste geçici olarak <b>proje adı</b> bazında. `+
  `Kalıcı çözüm: <span class="mono">supabase/migrations/0004_parks.sql</span> Supabase SQL Editor'da çalıştırılmalı.</div>`
  +(list.length?list.map((p,i)=>`
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:8px 12px;background:var(--bg);border-radius:10px">
   <div class="mono" style="width:26px;height:26px;border-radius:50%;background:${i===0?"var(--green)":"var(--line)"};color:${i===0?"#fff":"var(--mut)"};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;flex:0 0 auto">${i+1}</div>
   <div style="flex:1;min-width:0">
    <div style="font-size:.85rem;font-weight:700">${esc(p.name)} ${i===0?'<span class="badge on">🏆 En İyi</span>':""}</div>
    <div style="font-size:.7rem;color:var(--mut)">${esc(p.city)} · ${p.n} ${_tw("kayıt")} · ${_tw("ort. çap")} ${(p.dbh/p.n).toFixed(1)} cm · ${_tw("ort. boy")} ${(p.h/p.n).toFixed(1)} m</div>
   </div>
   <div style="width:120px;background:var(--line);border-radius:4px;height:8px;overflow:hidden;flex:0 0 auto"><div style="height:100%;width:${(p.c/max*100).toFixed(0)}%;background:var(--green)"></div></div>
   <div class="mono" style="width:70px;text-align:right;font-weight:600;flex:0 0 auto">${(p.c/1000).toFixed(2)} t</div>
  </div>`).join(""):'<div style="color:var(--mut);font-size:.85rem">Henüz onaylı kayıt yok.</div>');
 const rep=$("repProject");
 if(rep)rep.innerHTML=list.map(p=>`<option>proj:${esc(p.name)}</option>`).join("")||'<option value="">—</option>';
}

/* Park raporu: seçili PARKIN tüm ölçümleri (tüm kullanıcılar, tüm projeler).
 * park_id>0 → projects.park_id filtresi (PostgREST !inner); park yoksa eski
 * davranış: proje adına göre. */
async function parkReport(){
 const key=$("repProject").value;
 /* Query contract retained in domain request modules: projects!inner( and .eq("projects.park_id",row.park_id). */
 return window.DG_LOAD_PARK_REPORT.run({key,parkRows:PARK_ROWS,
  load:(primary,legacy)=>window.DG_PARK_REPORT_STORE.load(sb,primary,legacy),
  warnIfTruncated:dgWarnIfTruncated,render:dgRenderParkReport,
  onNoSelection:()=>toast("Park seç","err"),
  onError:error=>toast(dgCf("Rapor alınamadı: ")+esc(error.message),"err")});
}

function dgRenderParkReport(name,rows,count,row){
 PARK_DATA=rows;
 if(!rows.length)return toast("Bu park için onaylı kayıt yok.");
 const model=window.DG_SUMMARIZE_PARK_REPORT.summarize(rows,row,count);
 const today=new Date().toLocaleDateString("tr-TR");
 const html=window.DG_PARK_REPORT_SUMMARY_UI.render(name,model,{escape:esc,translate:_tw,formatHa:dgFmtHa,date:today})+
  window.DG_PARK_REPORT_SPECIES_TABLE.render(model.species,LATIN);
 const csv=window.DG_BUILD_PARK_REPORT_CSV.build(name,model,{date:today,latin:LATIN});
 window.DG_PARK_REPORT_PREVIEW_UI.show({title:"📄 "+name+" — "+_tw("Park Raporu"),body:html,csv,
  fileName:name.replace(/\s+/g,"_")+"_rapor.csv",elements:{title:$("pvTitle"),body:$("pvBody"),download:$("pvDownload"),modal:$("previewModal")},download:dl});
}
/* Click-to-zoom */
async function zoomToCountry(country){
const m=worldMapL||worldMap;if(!m)return;
if(window.DG_WORLD_ZOOM_TO_LOCATION&&DG_WORLD_PARK_COMPARISON_MODULE_STORE)return window.DG_WORLD_ZOOM_TO_LOCATION.run(m,"country",country,country,"🌍",{load:(column,value)=>DG_WORLD_PARK_COMPARISON_MODULE_STORE.location(column,value),warnIfTruncated:dgWarnIfTruncated,fit:fitRows});
const{data,count}=await sb.from("measurements").select("lat,lon",{count:"exact"}).eq("status","Onaylı").eq("country",country).limit(2000);
dgWarnIfTruncated(data,2000,country+" (ülke yakınlaşma)",count);
fitRows(m,data,country,"🌍");
}
async function zoomToCity(city){
const m=worldMapL||worldMap;if(!m)return;
if(window.DG_WORLD_ZOOM_TO_LOCATION&&DG_WORLD_PARK_COMPARISON_MODULE_STORE)return window.DG_WORLD_ZOOM_TO_LOCATION.run(m,"city",city,city,"🏙",{load:(column,value)=>DG_WORLD_PARK_COMPARISON_MODULE_STORE.location(column,value),warnIfTruncated:dgWarnIfTruncated,fit:fitRows});
const{data,count}=await sb.from("measurements").select("lat,lon",{count:"exact"}).eq("status","Onaylı").eq("city",city).limit(2000);
dgWarnIfTruncated(data,2000,city+" (şehir yakınlaşma)",count);
fitRows(m,data,city,"🏙");
}
function fitRows(m,rows,label,icon){
/* dgValidCoord same guard: const pts=(rows||[]).filter(r=>dgValidCoord(r.lat,r.lon)); */
return window.DG_FIT_MEASUREMENT_ROWS.fit(m,rows,label,icon,{isValidCoordinate:dgValidCoord,bounds:points=>L.latLngBounds(points),toast,translate:dgCf});
}
