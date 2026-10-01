"use strict";
/* DendroGeo · services/admin.js — ÖLÇÜM ONAY & MODERASYON ÇEKİRDEĞİ (Faz 6)
 * Ziyaret sayacı → visit-stats.js, veri talepleri → data-requests.js,
 * kullanıcı yönetimi → user-admin.js, yedek → backup.js'e taşındı.
 * Burada kalanlar: onay/red/silme, depolama istatistikleri, yetim temizliği,
 * yeniden coğdalama, bağımlı filtre yardımcıları (listCountries/listCities/
 * listProjects/fillSelect — data-requests de bunları çağırır), yönetici toplu
 * dışa aktarımı ve REQ_ROWS/ADM_ROWS paylaşılan filtre state'i. */

async function loadAdmin(){
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
 /* 0036 (T4): açılır özet kartlar bu önbellekten çizilir. */
 try{DG_ADM={users,meas,projs,global};}catch(e){}
 if(typeof dgRenderActive==="function"){try{dgRenderActive();}catch(e){}}
const cnt=await sb.from("measurements").select("*",{count:"exact",head:true});
$("aUsers").textContent=users.length;$("aRec").textContent=cnt.count??meas.length;$("aProj").textContent=projs.length;$("aCarbon").textContent=global.carbon_t||0;
 /* ⚠ SESSİZ "KAYIT YOK" TUZAĞI KAPANDI (2026-09-24): sorgu hata verirse
  * tablo "Kayıt yok." diyordu ve kullanıcı verisinin silindiğini sanıyordu.
  * Artık hatanın kendisi ekrana yazılır (ayrıntı: admin-tree.js dgTreeFetch). */
 if(mRes.error){
  $("aMeasT").innerHTML=`<tr><td colspan=9><div class="alert err"><b>⚠ Ölçümler okunamadı (veri silinmedi, sorgu hata veriyor):</b> <span class="mono" style="font-size:.72rem">${esc(mRes.error.message)}</span><br><span style="font-size:.8rem">Şema değişikliğinden sonra PostgREST önbelleği bayatlamış olabilir → Supabase'de birkaç dakika bekleyip 🔄 Yenile, ya da üstteki "Park → Proje → Kullanıcı" ağacının hata kutusundaki adımları izle.</span></div></td></tr>`;
 }else
 $("aMeasT").innerHTML=meas.slice(0,300).map(x=>{
  const st=x.status||"Beklemede";
  const bc=st==="Onaylı"?"on":(st==="Red"?"off":"admin");
  const act=st==="Onaylı"
   ?`<button class="btn sm red" onclick="rejectMeas(${x.id})">🚫 Reddet</button>`
   :`<button class="btn sm" onclick="approveMeas(${x.id})">✓ Onayla</button>`;
  return `<tr><td data-label="Kullanıcı">${esc(x.profiles?.full_name)||"—"}</td><td data-label="Nokta">${x.point_id}</td><td data-label="Tür">${esc(x.species)}<br><span class="mono" style="font-size:.68rem;color:var(--mut);text-transform:none;letter-spacing:0">${esc(LATIN[x.species])||""}</span></td><td data-label="Çap"><b>${x.dbh_cm}</b></td><td data-label="Boy"><b>${x.height_m}</b></td><td data-label="Karbon">${(x.carbon_kg||0).toFixed(1)}</td><td data-label="Foto">${dgThumb(x.photo_url)}</td><td data-label="Durum"><span class="badge ${bc}">${st}</span></td><td data-label="İşlem" style="display:flex;gap:4px">${act}<button class="btn sm ghost" title="Konum çiti istisnası işle (0007 · yalnız yönetici · audit izi kalır)" onclick="dgGeoOverride(${x.id})">🛰</button><button class="btn sm red" onclick="delMeas(${x.id})">🗑️</button></td></tr>`;
 }).join("")||"<tr><td colspan=9>Kayıt yok.</td></tr>";
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
 /* Canlı haritayı bayat işaretle (2026-09-26): loadWorld() dünya sekmesini
  * tazeliyordu ama Canlı Harita sekmesi liveLoaded kapısı yüzünden ESKİ
  * kümede kalıyordu → onaylanan nokta F5'e kadar görünmüyordu. */
 dgMarkLiveDirty();
 loadAdmin();loadWorld();
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
 loadAdmin();
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
  $("storeInfo").textContent=count+" fotoğraf · "+mb.toFixed(1)+" MB / "+QUOTA_MB+" MB";
 }catch(e){$("storeInfo").textContent="Depolama bilgisi alınamadı.";}
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
 toast("✓ "+done+" kaydın şehri güncellendi","ok","🌍");
 loadWorld();loadAdmin();
}

async function delMeas(id){
 if(!confirm(dgCf("Kayıt silinsin mi?")))return;
 const{data}=await sb.from("measurements").select("photo_url").eq("id",id).single();
 if(data)await removePhoto(data.photo_url);
 await sb.from("measurements").delete().eq("id",id);dgMarkLiveDirty();loadAdmin();
}

function filterAdminMeas(){
 const q=$("adminMeasSearch").value.toLowerCase();
 $("aMeasT").querySelectorAll("tr").forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?"":"none";});
}

/* ============ GERÇEK ZAMANLI BAĞIMLI FİLTRELER (Ülke→Şehir→Proje) ============ */
let REQ_ROWS=[],REQ_PROJECTS=[],ADM_ROWS=[],ADM_PROJECTS=[];

function listCountries(rows,projects){
 const s=new Set();
 (rows||[]).forEach(r=>{const v=(r.country||"").trim();if(v)s.add(v);});
 (projects||[]).forEach(p=>{const v=(p.country||"").trim();if(v)s.add(v);});
 return [...s].sort((a,b)=>a.localeCompare(b,"tr"));
}

function listCities(rows,projects,country){
 const s=new Set();
 (rows||[]).forEach(r=>{const c=(r.country||"").trim(),v=(r.city||"").trim();if(v&&(!country||c===country))s.add(v);});
 (projects||[]).forEach(p=>{const c=(p.country||"").trim(),v=(p.city||"").trim();if(v&&(!country||c===country))s.add(v);});
 return [...s].sort((a,b)=>a.localeCompare(b,"tr"));
}

function listProjects(projects,country,city,withId){
 const list=(projects||[])
  .filter(p=>(!country||(p.country||"").trim()===country)&&(!city||(p.city||"").trim()===city))
  .sort((a,b)=>(a.name||"").localeCompare(b.name||"","tr"));
 return withId?list.map(p=>({v:String(p.id),label:p.name+(p.city?" · "+p.city:"")})) : list.map(p=>p.name);
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
let q=sb.from("measurements").select("*,projects(name)");
const c=$("admExpCountry").value,ci=$("admExpCity").value,p=$("admExpProject").value,s=$("admExpStatus").value;
if(c)q=q.eq("country",c);
if(ci)q=q.eq("city",ci);
if(p)q=q.eq("project_id",+p);
if(s)q=q.eq("status",s);
return q;
}

async function adminFilteredRows(){
let out=[],from=0,step=1000;
for(;;){
const{data,error}=await adminFilteredQuery().order("created_at").range(from,from+step-1);
if(error)throw new Error(error.message);
out=out.concat(data||[]);
if(!data||data.length<step)break;
from+=step;
}
return out;
}

async function adminExportCSV(){
const rows=await adminFilteredRows();
if(!rows.length)return toast("Filtreye uyan kayıt yok","warn");
dl(fullCSV(rows),"dendrogeo_toplu.csv");toast("✓ "+rows.length+" kayıt dışa aktarıldı","ok","📥");
}

async function adminExportQgis(){
const rows=await adminFilteredRows();
if(!rows.length)return toast("Filtreye uyan kayıt yok","warn");
dl(fullCSV(rows),"dendrogeo_qgis_detayli.csv");toast("✓ "+rows.length+" kayıt dışa aktarıldı","ok","🧾");
}

async function adminExportGeo(){
const rows=await adminFilteredRows();
if(!rows.length)return toast("Filtreye uyan kayıt yok","warn");
const gj={type:"FeatureCollection",features:rows.map(r=>({type:"Feature",geometry:{type:"Point",coordinates:[r.lon,r.lat]},properties:{point:r.point_id,species:r.species,latin:LATIN[r.species]||"",dbh:r.dbh_cm,height:r.height_m,carbon:r.carbon_kg,status:r.status,photo:r.photo_url||""}}))};
dl(JSON.stringify(gj,null,2),"dendrogeo_toplu.geojson");toast("✓ "+rows.length+" kayıt dışa aktarıldı","ok","🗺");
}

/* ═══════════ 0036 (T4) · AÇILIR ÖZET KARTLAR + AKTİF KULLANICILAR ═══════════
 * Kullanıcı isteği: "buradakiler açılabilir tablo olsun, aktif kullanıcı
 * eklensin ve ne yapıyor yazsın." Kartlara tıkla → altta liste açılır/kapanır.
 * Metinler TR literal basılır; EN modunda MutationObserver çevirir (0035d
 * mimarisi) — ikinci sözlük gerekmez. */
let DG_ADM=null,DG_ADM_KIND="";
async function dgAdminExpand(kind){
 const box=$("admExpand");if(!box)return;
 if(DG_ADM_KIND===kind){box.style.display="none";DG_ADM_KIND="";return;}
 DG_ADM_KIND=kind;box.style.display="";
 const d=DG_ADM||{users:[],meas:[],projs:[]};
 const scroll='style="max-height:340px;overflow:auto"';
 if(kind==="users"){
  const cnt={};(d.meas||[]).forEach(m=>{if(m.owner)cnt[m.owner]=(cnt[m.owner]||0)+1;});
  box.innerHTML='<div class="lbl" style="margin-bottom:10px">Kullanıcılar (tümü) — karta tekrar tıklayınca kapanır</div>'+
   '<div '+scroll+'><table><thead><tr><th scope="col">E‑posta</th><th scope="col">Ad Soyad</th><th scope="col">Rol</th><th scope="col">Durum</th><th scope="col">Kayıt</th></tr></thead><tbody>'+
   (d.users||[]).map(u=>'<tr><td data-label="E‑posta">'+esc(u.email||"—")+'</td><td data-label="Ad Soyad">'+esc(u.full_name||"—")+'</td><td data-label="Rol">'+(u.role==="owner"?"KURUCU":(u.role==="admin"?"DENETÇİ":"KULLANICI"))+'</td><td data-label="Durum"><span class="badge '+(u.active?"on":"off")+'">'+(u.active?"Aktif":"Pasif")+'</span></td><td data-label="Kayıt" class="mono">'+(cnt[u.id]||0)+'</td></tr>').join("")+
   '</tbody></table></div>';
  return;
 }
 if(kind==="records"){
  const rows=(d.meas||[]).slice(0,100);
  box.innerHTML='<div class="lbl" style="margin-bottom:10px">Son 100 ölçüm — karta tekrar tıklayınca kapanır</div>'+
   '<div '+scroll+'><table><thead><tr><th scope="col">Kullanıcı</th><th scope="col">Nokta</th><th scope="col">Tür</th><th scope="col">Çap</th><th scope="col">Boy</th><th scope="col">Karbon</th><th scope="col">Durum</th><th scope="col">Tarih</th></tr></thead><tbody>'+
   rows.map(m=>'<tr><td data-label="Kullanıcı">'+esc((m.profiles&&m.profiles.full_name)||"—")+'</td><td data-label="Nokta" class="mono">P'+esc(m.point_id)+'</td><td data-label="Tür">'+esc(m.species||"—")+'</td><td data-label="Çap" class="mono">'+(m.dbh_cm||"—")+'</td><td data-label="Boy" class="mono">'+(m.height_m||"—")+'</td><td data-label="Karbon" class="mono">'+((m.carbon_kg||0)/1).toFixed(1)+' kg</td><td data-label="Durum"><span class="badge '+(m.status==="Onaylı"?"on":(m.status==="Red"?"off":"admin"))+'">'+esc(m.status||"—")+'</td><td data-label="Tarih" class="mono">'+String(m.created_at||"").slice(0,10)+'</td></tr>').join("")+
   '</tbody></table></div>';
  return;
 }
 if(kind==="projects"){
  const byId={};(d.users||[]).forEach(u=>byId[u.id]=u);
  box.innerHTML='<div class="lbl" style="margin-bottom:10px">Projeler (tümü) — karta tekrar tıklayınca kapanır</div>'+
   '<div '+scroll+'><table><thead><tr><th scope="col">Proje Adı</th><th scope="col">Ülke</th><th scope="col">Şehir</th><th scope="col">Sahip</th><th scope="col">Tarih</th></tr></thead><tbody>'+
   (d.projs||[]).map(p=>'<tr><td data-label="Proje Adı">'+esc(p.name||"—")+'</td><td data-label="Ülke">'+esc(p.country||"—")+'</td><td data-label="Şehir">'+esc(p.city||"—")+'</td><td data-label="Sahip">'+esc((byId[p.owner]&&(byId[p.owner].full_name||byId[p.owner].email))||"—")+'</td><td data-label="Tarih" class="mono">'+String(p.created_at||"").slice(0,10)+'</td></tr>').join("")+
   '</tbody></table></div>';
  return;
 }
 if(kind==="carbon"){
  box.innerHTML='<div class="lbl" style="margin-bottom:10px">⏳</div>';
  try{
   const[cRes,tRes]=await Promise.all([sb.from("v_country").select("*"),sb.from("v_city").select("*")]);
   box.innerHTML='<div class="lbl" style="margin-bottom:10px">Karbon — ülke kırılımı (onaylı kayıtlar)</div>'+
    '<div class="grid g2"><div '+scroll+'><table><thead><tr><th scope="col">Ülke</th><th scope="col">Kayıt</th><th scope="col">Karbon(t)</th><th scope="col">Ort.DBH</th></tr></thead><tbody>'+
    (cRes.data||[]).map(r=>'<tr><td data-label="Ülke">'+esc(r.country)+'</td><td data-label="Kayıt" class="mono">'+r.records+'</td><td data-label="Karbon(t)" class="mono">'+r.carbon_t+'</td><td data-label="Ort.DBH" class="mono">'+(r.avg_dbh||"—")+'</td></tr>').join("")+
    '</tbody></table></div><div '+scroll+'><table><thead><tr><th scope="col">Şehir</th><th scope="col">Kayıt</th><th scope="col">Karbon(t)</th></tr></thead><tbody>'+
    (tRes.data||[]).map(r=>'<tr><td data-label="Şehir">'+esc(r.city)+'</td><td data-label="Kayıt" class="mono">'+r.records+'</td><td data-label="Karbon(t)" class="mono">'+r.carbon_t+'</td></tr>').join("")+
    '</tbody></table></div></div>';
  }catch(e){box.innerHTML='<div class="alert err">⚠ '+esc(e&&e.message||e)+'</div>';}
 }
}
function dgRenderActive(){
 const box=$("aLive");if(!box)return;
 let st={};
 try{st=(typeof dgPresenceList==="function")?dgPresenceList():{};}catch(e){}
 const now=Date.now();const rows=[];
 for(const k in st){for(const p of (st[k]||[])){if(!p||!p.id)continue;rows.push({p:p,age:Math.max(0,Math.round((now-(p.t||now))/1000))});}}
 rows.sort((a,b)=>a.age-b.age);
 if(!rows.length){
  box.textContent=(typeof dgPresenceReady==="function"&&!dgPresenceReady())?"—":"(şu an başka kimse yok — kanal sessiz)";
  return;
 }
 const T=(s)=>(typeof dgCf==="function"?dgCf(s):s);
 box.innerHTML=rows.map(r=>{
  const lbl=(typeof DG_VIEW_LABELS!=="undefined"&&DG_VIEW_LABELS[r.p.v])||r.p.v||"?";
  const ageTxt=r.age<60?r.age+" "+T("sn"):Math.round(r.age/60)+" "+T("dk");
  return '<div style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)">'+
   '<span style="width:9px;height:9px;border-radius:50%;background:#22c55e;flex:0 0 auto"></span>'+
   '<b>'+esc(r.p.n||"?")+'</b><span style="color:var(--mut)">· '+T(lbl)+'</span>'+
   '<span class="dg-meta" style="margin-left:auto">'+ageTxt+" "+T("önce")+'</span></div>';
 }).join("");
}
window.addEventListener("dg:lang",()=>{try{
 const b=$("admExpand");if(b&&DG_ADM_KIND){b.style.display="none";DG_ADM_KIND="";}
 if(typeof dgRenderActive==="function")dgRenderActive();
}catch(e){}});
