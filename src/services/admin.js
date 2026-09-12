"use strict";
/* ============ ZİYARETÇİ SAYACI ============ */
async function trackVisit(){
 try{
  if(sessionStorage.getItem("dg_visited"))return;
  sessionStorage.setItem("dg_visited","1");
  await sb.from("site_visits").insert({});
 }catch(e){}
}
async function loadVisitStats(){
 try{
  const total=await sb.from("site_visits").select("*",{count:"exact",head:true});
  $("aVisitTotal").textContent=total.count??0;
  const today=new Date();today.setHours(0,0,0,0);
  const t=await sb.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",today.toISOString());
  $("aVisitToday").textContent=t.count??0;
  const d7=new Date(Date.now()-7*86400000);
  const w=await sb.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",d7.toISOString());
  $("aVisit7").textContent=w.count??0;
 }catch(e){$("aVisitTotal").textContent="—";}
}
/* ============ VERİ TALEBİ (kullanıcı → yönetici) ============ */
async function sendDataRequest(){
 if(!USER)return;
 const country=$("reqCountry").value.trim()||null;
 const city=$("reqCity").value.trim()||null;
 const project_name=$("reqProject").value.trim()||null;
 const note=$("reqNote").value.trim()||null;
 const m=$("reqMsg");
 try{
  const{data:pending}=await sb.from("data_requests")
   .select("country,city,project_name,status")
   .eq("user_id",USER.id)
   .in("status",["Beklemede","İşleme Alındı"]);
  const norm=v=>(v||"").toString().trim().toLowerCase();
  const dup=(pending||[]).find(f=>norm(f.country)===norm(country)&&norm(f.city)===norm(city)&&norm(f.project_name)===norm(project_name));
  if(dup){
   toast("⚠️ Bu veri talebiniz zaten alındı — yönetici onayı bekleniyor","warn","✉️");
   m.style.color="var(--amber)";
   m.textContent="⚠ Aynı filtreyle bir talebiniz zaten "+(dup.status==="Beklemede"?"beklemede":"işleme alındı")+". Yönetici yanıt verene kadar yeni talep oluşturulamaz.";
   return;
  }
 }catch(e){console.log("Dup kontrolü:",e);}
 const body={user_id:USER.id,email:PROFILE?.email||USER.email,country,city,project_name,note,status:"Beklemede"};
 const{error}=await sb.from("data_requests").insert(body);
 if(error){m.style.color="var(--red)";m.textContent="Hata: "+error.message;return;}
 toast("✓ Talep gönderildi — yönetici yanıtı bekleniyor","ok","✉️");
 m.style.color="var(--green-dk)";m.textContent="✓ Talebiniz yönetime iletildi, hazır olduğunda e‑postanıza gönderilecek.";
 $("reqCountry").value="";$("reqCity").value="";$("reqProject").value="";$("reqNote").value="";
 loadMyRequests();
}
async function loadMyRequests(){
 if(!USER)return;
 const{data}=await sb.from("data_requests").select("*").eq("user_id",USER.id).order("created_at",{ascending:false});
 const el=$("myRequests");if(!el)return;
 el.innerHTML=(data&&data.length)?"<div class='lbl' style='margin:10px 0 6px'>Taleplerim</div>"+data.map(r=>{
  const filt=[esc(r.country),esc(r.city),esc(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
  const bc=r.status==="Tamamlandı"?"on":(r.status==="İşleme Alındı"?"admin":"off");
  return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:.82rem"><span>${esc(filt)}</span><span class="badge ${bc}">${r.status}</span></div>`;
 }).join(""):"";
}
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
/* --- Kullanıcı talep formu --- */
async function loadRequestOptions(){
 try{
  const [m,p]=await Promise.all([
   sb.from("measurements").select("country,city").eq("status","Onaylı").limit(5000),
   sb.from("projects").select("id,name,country,city").order("name")
  ]);
  REQ_ROWS=m.data||[];REQ_PROJECTS=p.data||[];
  fillSelect($("reqCountry"),listCountries(REQ_ROWS,REQ_PROJECTS));
  reqCountryChanged();
 }catch(e){}
}
function reqCountryChanged(){
 fillSelect($("reqCity"),listCities(REQ_ROWS,REQ_PROJECTS,$("reqCountry").value));
 reqCityChanged();
}
function reqCityChanged(){
 fillSelect($("reqProject"),listProjects(REQ_PROJECTS,$("reqCountry").value,$("reqCity").value,false));
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
/* ============ YÖNETİCİ: KULLANICI VERİ TALEPLERİ ============ */
async function loadRequests(){
 const{data}=await sb.from("data_requests").select("*,profiles(full_name)").order("created_at",{ascending:false});
 const reqs=data||[];
 const pending=reqs.filter(r=>r.status!=="Tamamlandı"&&r.status!=="Reddedildi");
 const closed=reqs.filter(r=>r.status==="Tamamlandı"||r.status==="Reddedildi");
 
 $("aReqPending").textContent=pending.length;
 $("aReqPendingMini").textContent=pending.length;
 $("aReqClosed").textContent=closed.length;
 
 // AKTİF TALEPLER TABLOSU
 $("aReqT").innerHTML=pending.length?pending.map(r=>{
  const filt=[esc(r.country),esc(r.city),esc(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
  const hasNote=r.note&&r.note.trim().length>0;
  return `<tr>
   <td>${esc(r.profiles?.full_name)||"—"}</td>
   <td>${esc(r.email)||"—"}</td>
   <td><b>${esc(filt)}</b></td>
   <td>${new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
   <td><span class="badge admin">${r.status}</span></td>
   <td style="display:flex;gap:4px;flex-wrap:wrap">
    <button class="btn sm blue" onclick="fulfillRequest(${r.id})">📥✉️ İndir ve Yanıtla</button>
    <button class="btn sm red" onclick="rejectRequest(${r.id})">🚫 Reddet</button>
   </td>
  </tr>${hasNote?`<tr><td colspan="6" style="background:var(--tint);font-size:.78rem;color:var(--mut);white-space:normal;padding:8px 12px;line-height:1.5"><b style="color:var(--green-dk)">📝 Not:</b> ${esc(r.note)}</td></tr>`:""}`;
 }).join(""):"<tr><td colspan=6 style='text-align:center;color:var(--mut)'>Bekleyen talep yok</td></tr>";
 
 // TAMAMLANAN/REDDEDİLENLER (COLLAPSIBLE)
 const closedWrap=$("closedRequestsWrap");
 if(closed.length>0){
  closedWrap.style.display="block";
  $("aReqClosed").textContent=closed.length;
  $("closedReqT").innerHTML=closed.map(r=>{
   const filt=[esc(r.country),esc(r.city),esc(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
   const bc=r.status==="Tamamlandı"?"on":"off";
   const hasNote=r.note&&r.note.trim().length>0;
   const closedDate=r.fulfilled_at?new Date(r.fulfilled_at).toLocaleDateString("tr-TR"):"";
   return `<tr>
    <td>${esc(r.profiles?.full_name)||"—"}</td>
    <td>${esc(r.email)||"—"}</td>
    <td>${esc(filt)}</td>
    <td>${new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
    <td>${closedDate}</td>
    <td><span class="badge ${bc}">${r.status}</span></td>
   </tr>${hasNote?`<tr><td colspan="6" style="background:var(--tint);font-size:.78rem;color:var(--mut);white-space:normal;padding:8px 12px;line-height:1.5"><b style="color:var(--green-dk)">📝 Not:</b> ${esc(r.note)}</td></tr>`:""}`;
  }).join("");
 }else{
  closedWrap.style.display="none";
 }
}
async function rejectRequest(id){
 if(!confirm("Bu talebi reddetmek istediğinizden emin misiniz? Kullanıcıya yanıt gönderilmez, talep arşive kaldırılır."))return;
 const{error}=await sb.from("data_requests").update({status:"Reddedildi",fulfilled_at:new Date().toISOString()}).eq("id",id);
 if(error){toast("Hata: "+error.message,"err");return;}
 toast("✓ Talep reddedildi","warn","🚫");
 loadRequests();
}

async function fulfillRequest(id){
   const {data:req} = await sb.from("data_requests").select("*,profiles(full_name)").eq("id",id).single();
    if(!req) return;
    
    let projIds = null;
    if(req.project_name){
        const {data:projs} = await sb.from("projects").select("id").ilike("name","%"+req.project_name+"%");
        projIds = (projs||[]).map(p=>p.id);
    }
    
    let q = sb.from("measurements").select("*").eq("status","Onaylı");
    if(req.country)  q = q.eq("country", req.country);
    if(req.city)     q = q.eq("city",    req.city);
    if(projIds)      q = q.in("project_id", projIds.length ? projIds : [-1]);
    
    const {data} = await q;
    const rows = data || [];
    const n = rows.length;
    const totalC = rows.reduce((a,r) => a + (r.carbon_kg||0), 0);
    const countries = new Set(rows.map(r=>r.country).filter(Boolean));
    const cities    = new Set(rows.map(r=>r.city).filter(Boolean));
    
    if(n === 0){
        if(!confirm("Bu filtreye uyan onaylı kayıt bulunamadı. Yine de kullanıcıya bilgilendirme maili göndermek ister misiniz?")) return;
    } else {
        dl(fullCSV(rows), "dendrogeo_talep_" + id + ".csv");
    }
    
    // 📧 Profesyonel & detaylı e-posta metni
    const bugun = new Date().toLocaleDateString("tr-TR", { day:'numeric', month:'long', year:'numeric' });
    
    const bodyLines = [
        "Merhaba " + (req.profiles?.full_name || "Değerli Kullanıcımız") + ",",
        "",
        "DendroGeo'daki veri talebiniz başarıyla hazırlandı. 🌲",
        "",
        "📊 TALEP ÖZETİ",
        "─────────────────────────",
        "• Ülke      : " + (req.country || "Tümü"),
        "• Şehir     : " + (req.city    || "Tümü"),
        "• Proje/Park: " + (req.project_name || "Tümü"),
       (req.note ? "• Notunuz   : " + req.note : null),
        "",
        "📈 VERİ SETİ İÇERİĞİ",
        "─────────────────────────",
        "• Toplam kayıt     : " + n + " ağaç ölçümü",
        "• Toplam karbon    : " + (totalC/1000).toFixed(2) + " ton C",
        "• Kapsanan ülke    : " + countries.size,
        "• Kapsanan şehir   : " + cities.size,
        "• Hazırlanma tarihi: " + bugun,
        "",
        "📎 EKTE YER ALAN DOSYA",
        "─────────────────────────",
        "Veri seti CSV formatında hazırlanmıştır.",
        "",
        "CSV sütunları: POINT_ID, LATITUDE, LONGITUDE, TREE_GROUP, TREE_SPECIES, DBH_CM, HEIGHT_M, AGB_KG, BHB_KG, TOTAL_BIOMASS_KG, CARBON_KG, PHOTO_FILE ve daha fazlasını içerir.",
        "",
        "🗺 QGIS'DE NASIL AÇILIR?",
        "─────────────────────────",
        "1. QGIS → Layer → Add Layer → Add Delimited Text Layer",
        "2. X = LONGITUDE, Y = LATITUDE, CRS = EPSG:4326",
        "3. Fotoğraf balonu için katman özelliklerinde Map Tip özelliğini kullanabilirsiniz.",
        "   Detaylı rehber: https://dendrogeo.org/ → Dışa Aktar bölümü",
        "",
        "📜 VERİ LİSANSI",
        "─────────────────────────",
        "Bu veri CC BY-NC 4.0 lisansı altındadır. Ticari olmayan amaçlarla, kaynak gösterilerek serbestçe kullanılabilir.",
        "",
        "Atıf önerisi:",
"ŞİRİN, S. & ŞİRİN, N. (2026). DendroGeo: Global Tree Inventory & Carbon Data System (Version 1.0.0) [Dataset]. Zenodo. https://doi.org/10.5281/zenodo.22646300",
"",
        "Herhangi bir sorunuz olursa bu e-postayı yanıtlayarak bize ulaşabilirsiniz.",
        "",
       "İyi çalışmalar dileriz,",
	"DendroGeo Ekibi",
	"Nagihan ŞİRİN — Doktora Öğrencisi · Sinan ŞİRİN — Sistem Geliştirici",
	"Küresel Ağaç Envanteri ve Karbon Veri Sistemi",
	"https://dendrogeo.org · DOI: 10.5281/zenodo.22646300",
    ];
    
    const bodyTxt = bodyLines.filter(l => l !== null).join("\n");
    const subject = encodeURIComponent("✅ DendroGeo Veri Talebiniz Hazırlandı — " + n + " kayıt, " + (totalC/1000).toFixed(2) + " t C");
    
    window.open(
        "mailto:" + (req.email || "") +
        "?subject=" + subject +
        "&body=" + encodeURIComponent(bodyTxt),
        "_blank"
    );
    
    await sb.from("data_requests").update({
        status: "Tamamlandı",
        fulfilled_at: new Date().toISOString()
    }).eq("id", id);
    
    toast("✓ Mail hazırlandı — CSV'yi ekleyip gönderin", "ok", "📧");
    loadRequests();
}

let USERS_CACHE=[];
async function loadUsers(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return;
 const I_AM_OWNER=PROFILE.role==="owner";
 const{data}=await sb.from("profiles").select("*");
 USERS_CACHE=data||[];
 $("aUsersT").innerHTML=USERS_CACHE.map(x=>{
  const ownerRow=x.role==="owner";
  const roleBadge=ownerRow?'<span class="badge" style="background:var(--green-dk);color:#fff">KURUCU</span>':(x.role==="admin"?'<span class="badge admin">DENETÇİ</span>':'<span class="badge on">KULLANICI</span>');
  let act="";
  if(ownerRow)act="<span style='color:var(--mut);font-size:.7rem'>🛡 Korunuyor</span>";
  else if(I_AM_OWNER)act=`<select onchange="updateRole('${x.id}',this.value)" style="padding:4px;border-radius:6px;border:1px solid var(--line)"><option value="user" ${x.role==="user"?"selected":""}>Kullanıcı</option><option value="admin" ${x.role==="admin"?"selected":""}>Denetçi</option></select> <button class="btn sm ${x.active?"red":"blue"}" onclick="toggleU('${x.id}',${!x.active})">${x.active?"Pasifleştir":"Aktifleştir"}</button>`;
  else act="<span style='color:var(--mut);font-size:.7rem'>Salt okunur</span>";
  return `<tr><td>${esc(x.email)||"—"}</td><td>${esc(x.full_name)||"—"}</td><td>${roleBadge}</td><td><span class="badge ${x.active?"on":"off"}">${x.active?"Aktif":"Pasif"}</span></td><td style="display:flex;gap:6px;align-items:center">${act}</td></tr>`;
 }).join("");
}
function filterUsers(){
 const q=$("userSearch").value.toLowerCase();
 $("aUsersT").querySelectorAll("tr").forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?"":"none";});
}
async function updateRole(id,role){
 if(PROFILE.role!=="owner")return toast("🛡 Bu yetki yalnızca kurucuya aittir.");
 const{error}=await sb.from("profiles").update({role}).eq("id",id);
if(error){toast("Hata: "+error.message,"err");return;}loadUsers();
}
async function toggleU(id,act){
 if(PROFILE.role!=="owner")return toast("🛡 Bu yetki yalnızca kurucuya aittir.");
 await sb.from("profiles").update({active:act}).eq("id",id);loadUsers();
}
/* ============ TAM YEDEK (JSON) — Tez verisi sigortası ============ */
async function fetchAllRows(table, orderCol){
  let out=[], from=0, step=1000;
  for(;;){
    const {data,error}=await sb.from(table).select("*").order(orderCol).range(from, from+step-1);
    if(error) throw new Error(table+": "+error.message);
    out=out.concat(data||[]);
    if(!data||data.length<step) break;
    from+=step;
  }
  return out;
}
async function fullBackup(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner")) return toast("Yetki yok.","err");
  toast("Yedek hazırlanıyor…","info","💾");
  try{
    const meas = await fetchAllRows("measurements","created_at");
    const projs = await fetchAllRows("projects","id");
    const wps = await fetchAllRows("waypoints","id");
    let reqs = [];
    try{ reqs = await fetchAllRows("data_requests","created_at"); }catch(e){ reqs = []; }
    const backup={
      app:"DendroGeo",
      schema_version:"1.0.0",
      doi:"10.5281/zenodo.22646300",
      exported_at:new Date().toISOString(),
      exported_by:(PROFILE&&PROFILE.full_name)||"",
      counts:{measurements:meas.length,projects:projs.length,waypoints:wps.length,data_requests:reqs.length},
      measurements:meas,
      projects:projs,
      waypoints:wps,
      data_requests:reqs
    };
    const name="dendrogeo_yedek_"+new Date().toISOString().slice(0,10)+".json";
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
    a.download=name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    localStorage.setItem("dg_lastBackup", new Date().toISOString());
    toast("✓ Yedek indirildi: "+name+" ("+meas.length+" ölçüm)","ok","💾");
  }catch(e){
    toast("Yedek hatası: "+e.message,"err","❌");
  }
}
function checkBackupReminder(){
  const last=localStorage.getItem("dg_lastBackup");
  const days=last?(Date.now()-new Date(last).getTime())/86400000:999;
  if(days>7) toast("⚠ Son tam yedeğin üzerinden "+Math.floor(days)+" gün geçti — bugünkü yedeği alın","warn","💾");
}
