"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tad=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tadf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* DendroGeo · services/admin.js — ÖLÇÜM ONAY & MODERASYON ÇEKİRDEĞİ (Faz 6)
 * Ziyaret sayacı → visit-stats.js, veri talepleri → data-requests.js,
 * kullanıcı yönetimi → user-admin.js, yedek → backup.js'e taşındı.
 * Burada kalanlar: onay/red/silme, depolama istatistikleri, yetim temizliği,
 * yeniden coğdalama, bağımlı filtre yardımcıları (listCountries/listCities/
 * listProjects/fillSelect — data-requests de bunları çağırır), yönetici toplu
 * dışa aktarımı ve REQ_ROWS/ADM_ROWS paylaşılan filtre state'i. */

/* 0043: Düz liste çizimi TEK yerde — hem loadAdmin (taze sunucu verisi) hem
 * iyimser onay/red (admin-tree.js DG_TREE_ROWS önbelleği) buradan çizer; kod
 * tekrarlamaz, iki görünüm (ağaç + düz liste) tutarlı kalır. data-mid: satırı
 * kayıt kimliğiyle bulmayı sağlar (hedefli güncelleme/hata ayıklama). */
function dgFlatRowHTML(x){
  /* Locked markup contracts retained in src/ui/admin-measurement-row.js:
   * (+x.dbh_cm).toFixed(1); dgThumb(x.photo_url); onclick="dgGeoOverride(. */
  return window.DG_ADMIN_MEASUREMENT_ROW_UI.render(x,{escape:esc,latin:LATIN,thumbnail:dgThumb});
}
function dgRenderFlatTable(rows){
  const t=$("aMeasT");if(!t)return;
  /* Locked contract retained: sort((a,b)=>((+a.project_id||0)-(+b.project_id||0))||((+a.point_id||0)-(+b.point_id||0))). */
  t.innerHTML=window.DG_ADMIN_MEASUREMENT_TABLE_UI.render(rows,{renderRow:dgFlatRowHTML});
}

/* 0043 · SEKMELİ (debounced) ARKA PLAN MUTABAKAT
 * İyimser onay/red ağacı + düz listeyi + rozetleri ANINDA yerel önbellekten
 * günceller (ağ turu yok, sıçrama yok, TEK çizim). Sunucuyla tam mutabakat
 * için her onayda ağır loadAdmin çağırmak YERİNE, son tıktan ~1 sn sonra TEK
 * bir HAFİF tazeleme yapılır: ağaç SUNUCUDAN YENİDEN ÇEKİLMEZ (ikinci tam
 * çizim = gereksiz titreme + taze tıkla yarışma); yalnız onayla DEĞİŞEN üst
 * istatistik (aCarbon: onaylı karbon, v_global) ve dünya karşılaştırması
 * tazelenir. Dünya sekmesi gizli görünümde çizilir → admin sekmesi
 * kaydırmasını ETKİLEMEZ. Böylece "bir sürü veri" hızlıca onaylanırken ağaç
 * anlık ve TEK çizimde kalır, ağ yükü patlamaz, sıçrama/titreme olmaz. */
let DG_ADMIN_SYNC_T=null;
function dgAdminSyncSoon(){
  if(DG_ADMIN_SYNC_T)clearTimeout(DG_ADMIN_SYNC_T);
  DG_ADMIN_SYNC_T=setTimeout(async()=>{
    DG_ADMIN_SYNC_T=null;
    try{
      const g=await sb.from("v_global").select("*").single();
      if(g&&g.data&&$("aCarbon"))$("aCarbon").textContent=g.data.carbon_t||0;
    }catch(e){}
    try{loadWorld();}catch(e){}
  },1000);
}

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadAdmin(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadAdmin__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadAdmin__scroll(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return;
 const[uRes,mRes,pRes,gRes]=await Promise.all([
  sb.from("profiles").select("*"),
  /* ⚠ PGRST201 DÜZELTMESİ (2026-09-24, canlıda yakalandı): 0003 ile
   * measurements'a reviewed_by FK'sı eklendi → profiles'a İKİ ilişki var
   * (owner + reviewed_by). Çıplak "profiles(...)" gömüsü bu yüzden
   * "Could not embed because more than one relationship was found" hatası
   * veriyordu ve tablo sessizce "Kayıt yok." basıyordu (veri silinmemişti).
   * FK adı açıkça belirtilir: profiles!measurements_owner_fkey. */
  sb.from("measurements").select("*,profiles!measurements_owner_fkey(full_name)").order("created_at",{ascending:false}),
  sb.from("projects").select("*"),
  sb.from("v_global").select("*").single()
 ]);
 const users=uRes.data||[],meas=mRes.data||[],projs=pRes.data||[],global=gRes.data||{};

const cnt=await sb.from("measurements").select("*",{count:"exact",head:true});
$("aUsers").textContent=users.length;$("aRec").textContent=cnt.count??meas.length;$("aProj").textContent=projs.length;$("aCarbon").textContent=global.carbon_t||0;
 /* ⚠ SESSİZ "KAYIT YOK" TUZAĞI KAPANDI (2026-09-24): sorgu hata verirse
  * tablo "Kayıt yok." diyordu ve kullanıcı verisinin silindiğini sanıyordu.
  * Artık hatanın kendisi ekrana yazılır (ayrıntı: admin-tree.js dgTreeFetch). */
 if(mRes.error){
  $("aMeasT").innerHTML=`<tr><td colspan=9><div class="alert err"><b>⚠ Ölçümler okunamadı (veri silinmedi, sorgu hata veriyor):</b> <span class="mono" style="font-size:.72rem">${esc(mRes.error.message)}</span><br><span style="font-size:.8rem">Şema değişikliğinden sonra PostgREST önbelleği bayatlamış olabilir → Supabase'de birkaç dakika bekleyip 🔄 Yenile, ya da üstteki "Park → Proje → Kullanıcı" ağacının hata kutusundaki adımları izle.</span></div></td></tr>`;
 }else dgRenderFlatTable(meas);
 loadStorageStats();
 checkBackupReminder();
 loadVisitStats();
 loadRequests();
 loadAdminExportFilters();
 /* Park → proje → kullanıcı ağacı (admin-tree.js). Onay/red/silme sonrası
  * loadAdmin() yeniden çağrıldığı için ağaç da kendiliğinden tazelenir. */
 if(typeof loadAdminTree==="function")loadAdminTree();
 /* Park kimlikleri (park-registry.js): çift kimlik/adı olmayan park uyarıları
  * burada görünür; birleştir/yeniden adlandır/sil araçları aynı kartta. */
 if(typeof loadParkAdmin==="function")loadParkAdmin();
 /* Bilimsel rapor yayın kuyruğu (report-publish.js, 0008): yönetici sekmesi
  * her açıldığında istekler + yayın günlüğü tazelenir; bekleyen istek varken
  * modül kendi 25 sn'lik yoklamasını kurar. */
 if(typeof dgLoadPublishQueue==="function")dgLoadPublishQueue();
}

async function approveMeas(id){
 const{error}=await sb.from("measurements").update({status:"Onaylı",shared:true}).eq("id",id);
 if(error)return toast("Hata: "+error.message,"err");
 toast("Kayıt onaylandı","ok","✓");
 /* Canlı haritayı bayat işaretle (2026-09-26): onaylanan nokta Canlı Harita
  * sekmesine gidilince DG_LIVE_DIRTY kapısıyla yeniden çizilir (go("map")). */
 dgMarkLiveDirty();
 /* 0043 · İYİMSER ONAY (kullanıcı: "3-4 kaydı onaylarken sıçrama yaşıyorum,
  * bir sürü veri girilecek"). Eski akış her onayda loadAdmin→loadAdminTree ile
  * TÜM ağacı sunucudan yeniden çekiyor, ağaç "⏳ yükleniyor"a çöküp kaydırma
  * fırlıyordu. Yeni akış: satırı YEREL önbellekte güncelle + YERİNDE çiz
  * (anlık, ağ yok, sıçrama yok). Satır önbellekte yoksa (örn. düz listeden,
  * ağaç yüklenmeden) eski tam yükleme yedeğine düş. Sunucuyla tam mutabakat
  * sekmeli (debounced) arka plan tazelemesiyle ~1 sn içinde gelir. */
 if(typeof dgTreeApplyStatus!=="function"||!dgTreeApplyStatus(id,"Onaylı",true)){
  loadAdmin();loadWorld();
 }else{
  dgAdminSyncSoon();
 }
}

/* 🛰 KONUM ÇİTİ İSTİSNASI (0007): saha gerçeği poligonla çatışabilir (yeni
 * dikim alanı, OSM'de henüz olmayan park, kapalı bahçe). Yönetici istisna
 * işlerse satıra geo_override_by yazılır (audit) ve trigger çiti atlar.
 * Yetki sunucuda da denetlenir: tg_geo_fence → is_admin() yoksa 42501. */
async function dgGeoOverride(id){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.","err");
 if(!confirm(dgCf("Bu kayıt için KONUM ÇİTİ İSTİSNASI işlensin mi?\nSorumluluk işleyende; satıra audit izi (geo_override_by) yazılır.")))return;
 const{error}=await sb.from("measurements").update({geo_override_by:USER.id}).eq("id",id);
 if(error)return toast("Hata: "+error.message,"err");
 toast("🛰 Konum istisnası işlendi (audit izi satırda)","ok","🛰");
 loadAdmin();
}

async function rejectMeas(id){
 const{error}=await sb.from("measurements").update({status:"Red",shared:false}).eq("id",id);
 if(error)return toast("Hata: "+error.message,"err");
 toast("Kayıt reddedildi","warn","🚫");
 dgMarkLiveDirty();   /* red edilen nokta da haritadan düşmeli */
 /* 0043: iyimser red — yerinde güncelle (ağ yok, sıçrama yok); önbellekte
  * yoksa tam yüklemeye düş; tam mutabakat sekmeli arka plan tazelemesiyle. */
 if(typeof dgTreeApplyStatus!=="function"||!dgTreeApplyStatus(id,"Red",false)){
  loadAdmin();
 }else{
  dgAdminSyncSoon();
 }
}

async function loadStorageStats(){
 try{
  const root=await sb.storage.from("dendro-photos").list("",{limit:100});
  let bytes=0,count=0;
  for(const f of (root.data||[])){
   const sub=await sb.storage.from("dendro-photos").list(f.name,{limit:1000});
   (sub.data||[]).forEach(file=>{bytes+=(file.metadata&&file.metadata.size)||0;count++;});
  }
  const mb=bytes/1048576;
  $("storeBar").style.width=Math.min(100,(mb/QUOTA_MB)*100)+"%";
  $("storeBar").style.background=mb/QUOTA_MB>0.8?"var(--red)":(mb/QUOTA_MB>0.6?"var(--amber)":"var(--green)");
  $("storeInfo").textContent=_tadf("{n} fotoğraf · {mb} MB / {q} MB",{n:count,mb:mb.toFixed(1),q:QUOTA_MB});
 }catch(e){$("storeInfo").textContent=_tad("Depolama bilgisi alınamadı.");}
}

async function cleanOrphans(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.");
 if(!confirm(dgCf("Hiçbir kayda bağlı olmayan depolama dosyaları silinsin mi?")))return;
 const root=await sb.storage.from("dendro-photos").list("",{limit:100});
 const{data:meas}=await sb.from("measurements").select("photo_url");
 const urls=new Set((meas||[]).map(m=>m.photo_url).filter(Boolean));
 let removed=0;
 for(const f of (root.data||[])){
  const sub=await sb.storage.from("dendro-photos").list(f.name,{limit:1000});
  const orphans=[];
  for(const file of (sub.data||[])){
   const pub=sb.storage.from("dendro-photos").getPublicUrl(f.name+"/"+file.name).data.publicUrl;
   if(!urls.has(pub))orphans.push(f.name+"/"+file.name);
  }
  if(orphans.length){await sb.storage.from("dendro-photos").remove(orphans);removed+=orphans.length;}
 }
 toast("✓ "+removed+" yetim dosya silindi.");
 loadStorageStats();
}

async function reGeocodeAll(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return toast("Yetki yok.");
 if(!confirm(dgCf("Tüm kayıtların şehir/ülke bilgisi GPS koordinatından yeniden algılansın mı? (Nominatim limiti ~1 istek/sn)")))return;
 const{data}=await sb.from("measurements").select("id,lat,lon,city,country");
 let done=0;
 for(const r of (data||[])){
  if(!Number.isFinite(+r.lat)||!Number.isFinite(+r.lon))continue;
  const geo=await reverseGeocode(r.lat,r.lon);
  if(geo&&(geo.city!==r.city||geo.country!==r.country)){
   await sb.from("measurements").update({city:geo.city,country:geo.country}).eq("id",r.id);
   done++;
  }
  await new Promise(res=>setTimeout(res,1100));
 }
 toast(_tadf("✓ {n} kaydın şehri güncellendi",{n:done}),"ok","🌍");
 loadWorld();loadAdmin();
}

async function delMeas(id){
 if(!confirm(dgCf("Kayıt silinsin mi?")))return;
 const{data}=await sb.from("measurements").select("photo_url").eq("id",id).single();
 if(data)await removePhoto(data.photo_url);
 const{error}=await sb.from("measurements").delete().eq("id",id);
 if(error)return toast("Hata: "+error.message,"err");
 dgMarkLiveDirty();
 /* 0043: iyimser silme — satırı önbellekten düş + yerinde çiz (sıçrama yok);
  * önbellekte yoksa tam yüklemeye düş; tam mutabakat sekmeli arka planla. */
 if(typeof dgTreeRemoveRow!=="function"||!dgTreeRemoveRow(id)){
  loadAdmin();
 }else{
  dgAdminSyncSoon();
 }
}

function filterAdminMeas(){
 const q=$("adminMeasSearch").value.toLowerCase();
 $("aMeasT").querySelectorAll("tr").forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?"":"none";});
}

/* ============ GERÇEK ZAMANLI BAĞIMLI FİLTRELER (Ülke→Şehir→Proje) ============ */
let REQ_ROWS=[],REQ_PROJECTS=[],ADM_ROWS=[],ADM_PROJECTS=[];

function listCountries(rows,projects){
 return window.DG_ADMIN_EXPORT_FILTER_OPTIONS.listCountries(rows,projects);
}

function listCities(rows,projects,country){
 return window.DG_ADMIN_EXPORT_FILTER_OPTIONS.listCities(rows,projects,country);
}

function listProjects(projects,country,city,withId){
 return window.DG_ADMIN_EXPORT_FILTER_OPTIONS.listProjects(projects,country,city,withId);
}

function fillSelect(sel,opts){
 if(!sel)return;
 const cur=sel.value;
 sel.innerHTML='<option value="">Tümü</option>'+opts.map(o=>{
  const isObj=typeof o==="object";
  const v=isObj?o.v:o,label=isObj?o.label:o;
  return `<option value="${esc(v)}"${v===cur?" selected":""}>${esc(label)}</option>`;
 }).join("");
 if(sel.value!==cur)sel.value="";
}

/* --- Yönetici paneli --- */
async function loadAdminExportFilters(){
 try{
  const [m,p]=await Promise.all([
   sb.from("measurements").select("country,city"),
   sb.from("projects").select("id,name,country,city").order("name")
  ]);
  ADM_ROWS=m.data||[];ADM_PROJECTS=p.data||[];
  fillSelect($("admExpCountry"),listCountries(ADM_ROWS,ADM_PROJECTS));
  admCountryChanged();
 }catch(e){}
}

function admCountryChanged(){
 fillSelect($("admExpCity"),listCities(ADM_ROWS,ADM_PROJECTS,$("admExpCountry").value));
 admCityChanged();
}

function admCityChanged(){
fillSelect($("admExpProject"),listProjects(ADM_PROJECTS,$("admExpCountry").value,$("admExpCity").value,true));
}

/* --- TOPLU DIŞA AKTARIM (Admin) --- */
function adminFilteredQuery(){
return window.DG_BUILD_ADMIN_EXPORT_QUERY.build(()=>sb,{country:$("admExpCountry").value,city:$("admExpCity").value,project:$("admExpProject").value,status:$("admExpStatus").value});
}

async function adminFilteredRows(){
return window.DG_READ_ADMIN_EXPORT_ROWS.read(adminFilteredQuery);
}

async function adminExportCSV(){
const rows=await adminFilteredRows();
if(!rows.length)return toast(_tad("Filtreye uyan kayıt yok"),"warn");
dl(fullCSV(rows),"dendrogeo_toplu.csv");toast(_tadf("✓ {n} kayıt dışa aktarıldı",{n:rows.length}),"ok","📥");
}

async function adminExportQgis(){
const rows=await adminFilteredRows();
if(!rows.length)return toast("Filtreye uyan kayıt yok","warn");
dl(fullCSV(rows),"dendrogeo_qgis_detayli.csv");toast(_tadf("✓ {n} kayıt dışa aktarıldı",{n:rows.length}),"ok","🧾");
}

async function adminExportGeo(){
const rows=await adminFilteredRows();
if(!rows.length)return toast("Filtreye uyan kayıt yok","warn");
const gj={type:"FeatureCollection",features:rows.map(r=>({type:"Feature",geometry:{type:"Point",coordinates:[r.lon,r.lat]},properties:{point:r.point_id,species:r.species,latin:LATIN[r.species]||"",dbh:(Number.isFinite(+r.dbh_cm)?+(+r.dbh_cm).toFixed(1):null),height:r.height_m,carbon:r.carbon_kg,status:r.status,photo:r.photo_url||""}}))};
dl(JSON.stringify(gj,null,2),"dendrogeo_toplu.geojson");toast(_tadf("✓ {n} kayıt dışa aktarıldı",{n:rows.length}),"ok","🗺");
}
