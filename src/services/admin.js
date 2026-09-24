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
  sb.from("measurements").select("*,profiles(full_name)").order("created_at",{ascending:false}),
  sb.from("projects").select("*"),
  sb.from("v_global").select("*").single()
 ]);
 const users=uRes.data||[],meas=mRes.data||[],projs=pRes.data||[],global=gRes.data||{};
const cnt=await sb.from("measurements").select("*",{count:"exact",head:true});
$("aUsers").textContent=users.length;$("aRec").textContent=cnt.count??meas.length;$("aProj").textContent=projs.length;$("aCarbon").textContent=global.carbon_t||0;
 $("aMeasT").innerHTML=meas.slice(0,300).map(x=>{
  const st=x.status||"Beklemede";
  const bc=st==="Onaylı"?"on":(st==="Red"?"off":"admin");
  const act=st==="Onaylı"
   ?`<button class="btn sm red" onclick="rejectMeas(${x.id})">🚫 Reddet</button>`
   :`<button class="btn sm" onclick="approveMeas(${x.id})">✓ Onayla</button>`;
  return `<tr><td>${esc(x.profiles?.full_name)||"—"}</td><td>${x.point_id}</td><td>${esc(x.species)}<br><span class="mono" style="font-size:.68rem;color:var(--mut);text-transform:none;letter-spacing:0">${esc(LATIN[x.species])||""}</span></td><td><b>${x.dbh_cm}</b></td><td><b>${x.height_m}</b></td><td>${(x.carbon_kg||0).toFixed(1)}</td><td>${x.photo_url?`<a href="${esc(x.photo_url)}" target="_blank"><img src="${esc(x.photo_url)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px"></a>`:"—"}</td><td><span class="badge ${bc}">${st}</span></td><td style="display:flex;gap:4px">${act}<button class="btn sm red" onclick="delMeas(${x.id})">🗑️</button></td></tr>`;
 }).join("")||"<tr><td colspan=9>Kayıt yok.</td></tr>";
 loadStorageStats();
 checkBackupReminder();
 loadVisitStats();
 loadRequests();
 loadAdminExportFilters();
}

async function approveMeas(id){
 const{error}=await sb.from("measurements").update({status:"Onaylı",shared:true}).eq("id",id);
 if(error)return toast("Hata: "+error.message,"err");
 toast("Kayıt onaylandı","ok","✓");
 loadAdmin();loadWorld();
}

async function rejectMeas(id){
 const{error}=await sb.from("measurements").update({status:"Red",shared:false}).eq("id",id);
 if(error)return toast("Hata: "+error.message,"err");
 toast("Kayıt reddedildi","warn","🚫");
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
 if(!confirm("Hiçbir kayda bağlı olmayan depolama dosyaları silinsin mi?"))return;
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
 if(!confirm("Tüm kayıtların şehir/ülke bilgisi GPS koordinatından yeniden algılansın mı? (Nominatim limiti ~1 istek/sn)"))return;
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
 if(!confirm("Kayıt silinsin mi?"))return;
 const{data}=await sb.from("measurements").select("photo_url").eq("id",id).single();
 if(data)await removePhoto(data.photo_url);
 await sb.from("measurements").delete().eq("id",id);loadAdmin();
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
