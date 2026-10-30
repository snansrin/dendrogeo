"use strict";
/* Additive report controls for Export and administrator export, using existing theme. */
(function(root){
 const {sortPoints,slug,photoURL,parkOf,groupProjects}=root.DG_SHARED_PARK_INVENTORY_DOMAIN;
 const {listProjects,readAll}=root.DG_SHARED_PARK_INVENTORY_STORE;
 const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 let visibleParks=new Map(),busy=false,loadedFor=null;
 const num=value=>value===null||value===undefined||value===""?null:Number(value);
 const one=value=>Number.isFinite(num(value))?num(value).toFixed(1):"—";
 const blank=value=>value===null||value===undefined||value===""?"—":escape(value);
 function renderGroup(group,rows,{latin={},origin=""}={}){
  const projectName=new Map(group.projects.map(p=>[p.id,p.name]));
  const members=new Set(rows.map(row=>row.owner).filter(Boolean)).size;
  const carbon=rows.reduce((s,r)=>s+(Number(r.carbon_kg)||0),0);
  const avg=field=>rows.length?(rows.reduce((s,r)=>s+(Number(r[field])||0),0)/rows.length).toFixed(1):"0.0";
  const percent=group=>rows.length?(100*rows.filter(r=>r.grp===group).length/rows.length).toFixed(1):"0.0";
  const hectares=group.area?group.area/10000:null;
  const statuses=new Map();for(const row of rows){const key=row.status||"Beklemede";statuses.set(key,(statuses.get(key)||0)+1);}
  const species=new Map();for(const row of rows){const key=row.species||"—",s=species.get(key)||{count:0,carbon:0,dbh:0,height:0,grp:row.grp||"—"};s.count++;s.carbon+=Number(row.carbon_kg)||0;s.dbh+=Number(row.dbh_cm)||0;s.height+=Number(row.height_m)||0;species.set(key,s);}
  const speciesHTML=[...species].sort((a,b)=>a[0].localeCompare(b[0],"tr")).map(([name,s])=>`<tr><td>${escape(name)}</td><td><i>${escape(latin[name]||"—")}</i></td><td>${escape(s.grp)}</td><td>${s.count}</td><td>${s.carbon.toFixed(1)}</td><td>${(s.dbh/s.count).toFixed(1)}</td><td>${(s.height/s.count).toFixed(1)}</td></tr>`).join("");
  const photos=rows.map(row=>{
   const url=photoURL(row.photo_url,origin);
   if(!url)return "—";
   const target=escape(url);
   return `<a href="${target}" target="_blank" rel="noopener noreferrer" title="Fotoğrafı aç"><img src="${target}" alt="P${escape(row.point_id)} fotoğrafı" width="56" height="56" loading="lazy" style="object-fit:cover;border-radius:6px"></a><div><a href="${target}" target="_blank" rel="noopener noreferrer">Fotoğrafı aç</a></div>${row.photo_file?`<small>${escape(row.photo_file)}</small>`:""}`;
  });
  const lines=rows.map((row,index)=>`<tr><td><b>P${blank(row.point_id)}</b></td><td>${blank(row.measurement_no??1)}</td><td>${escape(row.species||"—")}<div><i>${escape(latin[row.species]||"—")}</i></div></td><td>${blank(row.grp)}</td><td>${one(row.girth_cm)}</td><td>${one(row.dbh_cm)}</td><td>${one(row.height_m)}</td><td><b>${one(row.carbon_kg)}</b></td><td>${blank(row.status||"Beklemede")}</td><td>${photos[index]}</td></tr>
   <tr class="dg-inventory-detail"><td colspan="10"><small><b>Proje:</b> ${escape(projectName.get(Number(row.project_id))||"—")} · <b>Tarih:</b> ${row.created_at?escape(new Date(row.created_at).toLocaleDateString("tr-TR")):"—"} · <b>Koordinat:</b> ${blank(row.lat)}, ${blank(row.lon)} · <b>AGB:</b> ${one(row.agb_kg)} kg · <b>BHB:</b> ${one(row.bhb_kg)} kg · <b>Biyokütle:</b> ${one(row.total_biomass_kg??(num(row.agb_kg)!==null&&num(row.bhb_kg)!==null?num(row.agb_kg)+num(row.bhb_kg):null))} kg · <b>Rakım:</b> ${one(row.altitude_m)} m · <b>Eğim:</b> ${one(row.slope_deg)}° · <b>GPS hata:</b> ${one(row.accuracy_m)} m</small></td></tr>`).join("");
  return `<section class="dg-inventory-park"><h2>🌳 ${escape(group.name)}</h2><p>👥 ${members} kişi · 📁 ${group.projects.length} proje · ${rows.length} kayıt</p>
   <table class="dg-inventory-stats"><tr><th>Kayıt</th><th>Karbon</th><th>Ort. Çap</th><th>Ort. Boy</th></tr><tr><td>${rows.length}</td><td>${(carbon/1000).toFixed(2)} t</td><td>${avg("dbh_cm")} cm</td><td>${avg("height_m")} m</td></tr></table>
   <p>🌲 İbreli %${percent("İBRELİ")} · 🍃 Yapraklı %${percent("YAPRAKLI")} · Diğer %${(100-Number(percent("İBRELİ"))-Number(percent("YAPRAKLI"))).toFixed(1)}${hectares?` · alan ${hectares.toFixed(2)} ha · <b>${((carbon/1000)/hectares).toFixed(2)} t/ha</b>`:""}</p>
   <p><small>Kapsanan durumlar: ${[...statuses].map(([status,n])=>escape(status)+" "+n).join(" · ")} · ${new Date().toLocaleDateString("tr-TR")} · Bilgiler saklanan ölçümlerden alınır, yeniden hesaplanmaz.</small></p>
   <h3>Tür özeti</h3><div style="overflow-x:auto"><table><thead><tr><th>Tür</th><th>Latince</th><th>Grup</th><th>Adet</th><th>Karbon (kg)</th><th>Ort. Çap</th><th>Ort. Boy</th></tr></thead><tbody>${speciesHTML}</tbody></table></div>
   <h3>Point ID sıralı ayrıntılı envanter</h3><div style="overflow-x:auto"><table><thead><tr><th>Point ID</th><th>Ölçüm No</th><th>Tür / Latince</th><th>Grup</th><th>Çevre (cm)</th><th>DBH (cm)</th><th>Boy (m)</th><th>Karbon (kg)</th><th>Durum</th><th>Fotoğraf</th></tr></thead><tbody>${lines}</tbody></table></div>
   <p><small>Fotoğraf görselleri ve “Fotoğrafı aç” bağlantıları internet bağlantısı gerektirir. Her bağlantı kendi ölçümünün depolama fotoğrafını açar.</small></p></section>`;
 }
 function documentHTML(groups,{latin={},origin=""}={}){
  const sections=groups.map(({group,rows})=>renderGroup(group,rows,{latin,origin})).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>DendroGeo · Park Envanteri</title><style>body{font-family:Arial,sans-serif;color:#193127;margin:24px;line-height:1.45}h2{color:#186344;border-bottom:2px solid #c6ddce;padding-bottom:7px}h3{color:#265940;margin-top:25px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #b5c8bc;padding:7px;vertical-align:top;text-align:left}th{background:#e8f1eb}.dg-inventory-stats td{font-size:18px;font-weight:bold}.dg-inventory-detail td{background:#f6f9f7}.dg-inventory-park{page-break-after:always;margin-bottom:35px}a{color:#105c9c}img{display:inline-block}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>DendroGeo · Park Envanteri</h1>${sections}</body></html>`;
 }
 function downloadHTML(html,fileName,doc=root.document){
  const url=root.URL.createObjectURL(new root.Blob([html],{type:"text/html;charset=utf-8"}));
  const link=doc.createElement("a");link.href=url;link.download=fileName;doc.body.append(link);link.click();link.remove();
  root.setTimeout(()=>root.URL.revokeObjectURL(url),30000);
 }
 function openPreview(title,html,fileName){
  const doc=root.document,modal=doc.getElementById("previewModal");
  const titleEl=doc.getElementById("pvTitle"),body=doc.getElementById("pvBody"),button=doc.getElementById("pvDownload");
  if(!modal||!titleEl||!body||!button)throw Error("Rapor önizleme penceresi bulunamadı.");
  titleEl.textContent=title;
  body.innerHTML=html.match(/<body>([\s\S]*)<\/body>/)?.[1]||"";
  button.onclick=()=>downloadHTML(html,fileName);
  root.DG_EXPORT_PREVIEW_UI.open(modal);
 }
 function status(id,message,error=false){const el=root.document.getElementById(id);if(el){el.textContent=message;el.style.color=error?"var(--red)":"var(--mut)";}}
 function setBusy(value){busy=value;root.document.querySelectorAll('[data-dg-park-inventory-action="preview"],[data-dg-park-inventory-action="admin"]').forEach(btn=>{btn.disabled=value;});}
 async function refresh(){
  const el=root.document.getElementById("dgSharedParkSelect");if(!el)return;
  if(typeof USER==="undefined"||!USER?.id){status("dgSharedParkStatus","Oturum açıldığında ortak parklar görüntülenir.");return;}
  const user=USER.id;status("dgSharedParkStatus","Erişebildiğin parklar yükleniyor…");
  try{
   const groups=groupProjects(await listProjects(sb));if(USER?.id!==user)return;
   visibleParks=groups;loadedFor=user;
   const previous=el.value;
   el.replaceChildren(new Option("Park seç", ""),...[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr")).map(g=>new Option(`${g.name} · ${g.projects.length} proje`,g.key)));
   if(groups.has(previous))el.value=previous;
   else if(groups.size===1)el.value=groups.keys().next().value;
   status("dgSharedParkStatus",`${groups.size} erişilebilir park · Projedeki tüm yetkili kullanıcıların ölçümleri alınır.`);
  }catch(error){visibleParks=new Map();loadedFor=null;el.replaceChildren(new Option("Parklar yüklenemedi", ""));status("dgSharedParkStatus","Parklar yüklenemedi: "+error.message,true);}
 }
 async function preview(){
  if(busy)return;
  if(!USER?.id){status("dgSharedParkStatus","Önce oturum açmalısın.",true);return;}
  if(loadedFor!==USER.id)await refresh();
  const group=visibleParks.get(root.document.getElementById("dgSharedParkSelect")?.value);
  if(!group){status("dgSharedParkStatus","Lütfen erişebildiğin bir park seç.",true);return;}
  setBusy(true);status("dgSharedParkStatus","Ortak ölçümler alınıyor…");
  try{
   const rows=await readAll(sb,group.projects.map(p=>p.id));
   if(!rows.length){status("dgSharedParkStatus","Bu parkta erişilebilir ölçüm bulunamadı.",true);return;}
   const html=documentHTML([{group,rows}],{latin:LATIN,origin:SB_URL});
   openPreview("📄 "+group.name+" — Ortak Park Envanteri",html,slug(group.name)+"_ortak_envanter.html");
   status("dgSharedParkStatus",`${rows.length} kayıt · Point ID sıralı · ${rows.filter(r=>photoURL(r.photo_url,SB_URL)).length} fotoğraf bağlantısı.`);
  }catch(error){status("dgSharedParkStatus","Envanter alınamadı: "+error.message,true);}finally{setBusy(false);}
 }
 async function admin(){
  if(busy)return;
  if(!PROFILE||!["admin","owner"].includes(PROFILE.role)){status("dgAdminParkInventoryStatus","Bu çıktı yalnız yöneticilere açıktır.",true);return;}
  setBusy(true);status("dgAdminParkInventoryStatus","Filtreye uyan kayıtlar alınıyor…");
  try{
   const projects=await listProjects(sb),groups=groupProjects(projects),selected=root.document.getElementById("admExpProject")?.value;
   let chosen=[...groups.values()];
   if(selected){const project=projects.find(p=>String(p.id)===selected);if(!project)throw Error("Seçili proje artık erişilebilir değil.");chosen=chosen.filter(group=>group.key===parkOf(project).key);}
   const filters={country:root.document.getElementById("admExpCountry")?.value,city:root.document.getElementById("admExpCity")?.value,status:root.document.getElementById("admExpStatus")?.value};
   const ids=chosen.flatMap(group=>group.projects.map(p=>p.id));
   const rows=await readAll(sb,ids,filters);
   if(!rows.length){status("dgAdminParkInventoryStatus","Filtreye uyan kayıt yok.",true);return;}
   const grouped=chosen.map(group=>({group,rows:rows.filter(row=>group.projects.some(project=>project.id===Number(row.project_id)))})).filter(item=>item.rows.length);
   const html=documentHTML(grouped,{latin:LATIN,origin:SB_URL});
   openPreview("📄 Yönetici — Tam Park Envanteri",html,"dendrogeo_toplu_park_envanteri.html");
   status("dgAdminParkInventoryStatus",`${rows.length} kayıt · ${grouped.length} park/proje · ${rows.filter(r=>photoURL(r.photo_url,SB_URL)).length} fotoğraf bağlantısı.`);
  }catch(error){status("dgAdminParkInventoryStatus","Tam dışa aktarım yapılamadı: "+error.message,true);}finally{setBusy(false);}
 }
 function mount(){
  const exportBody=root.document.querySelector("#v-export .export-panel-body"),adminCard=root.document.getElementById("admExpCountry")?.closest(".card");
  if(exportBody&&!root.document.getElementById("dgSharedParkSelect")){
   const section=root.document.createElement("section");section.className="export-format-card";section.style.marginTop="14px";
   section.innerHTML='<h3>🌳 Ortak Park · Tam Envanter</h3><p>Ortak çalışılan parkta erişim yetkin olan bütün projelerin ve kullanıcıların ölçümleri, Point ID sırasıyla ve fotoğrafa tıklanabilen bağlantılarla tek raporda.</p><div class="grid g3"><div><label class="lbl" for="dgSharedParkSelect">Park / ortak proje</label><select id="dgSharedParkSelect"><option value="">Parklar yükleniyor…</option></select></div><div style="align-self:end"><button type="button" class="btn sm ghost" data-dg-park-inventory-action="refresh">↻ Parkları yenile</button></div><div style="align-self:end"><button type="button" class="btn sm" data-dg-park-inventory-action="preview">📄 Önizle / HTML indir</button></div></div><p id="dgSharedParkStatus" class="dg-meta" role="status">Ortak parkları görmek için bu sekmeyi aç.</p>';
   exportBody.append(section);
  }
  if(adminCard&&!root.document.getElementById("dgAdminParkInventoryStatus")){
   const section=root.document.createElement("div");section.style.marginTop="12px";
   section.innerHTML='<button type="button" class="btn sm" data-dg-park-inventory-action="admin">📄 Fotoğraflı Tam Park Envanteri (HTML / Word)</button><p class="dg-meta">Ülke/şehir/durum filtrelerine uyar. Proje seçildiyse aynı parktaki tüm projeleri kapsar; “Tümü” tüm erişilebilir parkları içerir.</p><p id="dgAdminParkInventoryStatus" class="dg-meta" role="status"></p>';
   adminCard.append(section);
  }
 }
 function init(){
  mount();
  root.document.addEventListener("click",event=>{
   const action=event.target?.closest?.("[data-dg-park-inventory-action]")?.dataset.dgParkInventoryAction;
   if(action==="refresh")refresh();else if(action==="preview")preview();else if(action==="admin")admin();
  });
  const view=root.document.getElementById("v-export");
  if(view&&root.MutationObserver){new root.MutationObserver(()=>{if(view.classList.contains("on"))refresh();}).observe(view,{attributes:true,attributeFilter:["class"]});}
  if(view?.classList.contains("on"))refresh();
 }
 root.DG_SHARED_PARK_INVENTORY_EXPORT=Object.freeze({photoURL,groupProjects,readAll,sortPoints,renderGroup,documentHTML,listProjects,downloadHTML,init});
 if(root.document?.readyState==="loading")root.document.addEventListener("DOMContentLoaded",init,{once:true});else if(root.document)init();
})(window);
