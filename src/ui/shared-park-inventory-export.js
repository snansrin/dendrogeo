"use strict";
/* Additive report controls for Export and administrator export, using existing theme. */
(function(root){
 const {sortPoints,slug,photoURL,parkOf,groupProjects}=root.DG_SHARED_PARK_INVENTORY_DOMAIN;
 const {listProjects,listParticipantProjects,isCurrentParticipant,readAll}=root.DG_SHARED_PARK_INVENTORY_STORE;
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
  const speciesHTML=[...species].sort((a,b)=>a[0].localeCompare(b[0],"tr")).map(([name,s])=>`<tr><td><strong>${escape(name)}</strong></td><td><i>${escape(latin[name]||"—")}</i></td><td>${escape(s.grp)}</td><td class="dg-inventory-number">${s.count}</td><td class="dg-inventory-number">${s.carbon.toFixed(1)}</td><td class="dg-inventory-number">${(s.dbh/s.count).toFixed(1)}</td><td class="dg-inventory-number">${(s.height/s.count).toFixed(1)}</td></tr>`).join("");
  const photos=rows.map(row=>{
   const url=photoURL(row.photo_url,origin);
   if(!url)return "—";
   const target=escape(url);
   return `<a href="${target}" target="_blank" rel="noopener noreferrer" title="Fotoğrafı aç"><img src="${target}" alt="P${escape(row.point_id)} fotoğrafı" width="64" height="64" loading="lazy" class="dg-inventory-photo"></a><div><a href="${target}" target="_blank" rel="noopener noreferrer">Fotoğrafı aç</a></div>${row.photo_file?`<small>${escape(row.photo_file)}</small>`:""}`;
  });
  const lines=rows.map((row,index)=>`<tr class="dg-inventory-measurement"><td><b>P${blank(row.point_id)}</b></td><td>${blank(row.measurement_no??1)}</td><td><strong>${escape(row.species||"—")}</strong><div><i>${escape(latin[row.species]||"—")}</i></div></td><td>${blank(row.grp)}</td><td class="dg-inventory-number">${one(row.girth_cm)}</td><td class="dg-inventory-number">${one(row.dbh_cm)}</td><td class="dg-inventory-number">${one(row.height_m)}</td><td class="dg-inventory-number"><b>${one(row.carbon_kg)}</b></td><td>${blank(row.status||"Beklemede")}</td><td class="dg-inventory-photo-cell">${photos[index]}</td></tr>
   <tr class="dg-inventory-detail"><td colspan="10"><small><b>Proje:</b> ${escape(projectName.get(Number(row.project_id))||"—")} · <b>Tarih:</b> ${row.created_at?escape(new Date(row.created_at).toLocaleDateString("tr-TR")):"—"} · <b>Koordinat:</b> ${blank(row.lat)}, ${blank(row.lon)} · <b>AGB:</b> ${one(row.agb_kg)} kg · <b>BHB:</b> ${one(row.bhb_kg)} kg · <b>Biyokütle:</b> ${one(row.total_biomass_kg??(num(row.agb_kg)!==null&&num(row.bhb_kg)!==null?num(row.agb_kg)+num(row.bhb_kg):null))} kg · <b>Rakım:</b> ${one(row.altitude_m)} m · <b>Eğim:</b> ${one(row.slope_deg)}° · <b>GPS hata:</b> ${one(row.accuracy_m)} m</small></td></tr>`).join("");
  return `<section class="dg-inventory-park">
   <header class="dg-inventory-masthead"><div class="dg-inventory-brand"><span class="dg-inventory-mark">🌳</span><span><strong>DENDROGEO</strong><small>KENTSEL AĞAÇ ENVANTERİ · WEB GIS</small></span></div><div class="dg-inventory-doc-label">SAHA ENVANTER RAPORU<small>Fotoğraflı ölçüm dökümü</small></div></header>
   <div class="dg-inventory-intro"><p class="dg-inventory-eyebrow">PARK VE PROJE KAPSAMI</p><h2>${escape(group.name)}</h2><p class="dg-inventory-subtitle">👥 ${members} kişi · 📁 ${group.projects.length} proje · ${rows.length} kayıt</p><p class="dg-inventory-report-date">Düzenleme tarihi: ${new Date().toLocaleDateString("tr-TR")}</p></div>
   <div class="dg-inventory-section-label">01 / TEMEL GÖSTERGELER</div>
   <table class="dg-inventory-stats"><thead><tr><th>Kayıt</th><th>Toplam karbon</th><th>Ortalama DBH</th><th>Ortalama boy</th></tr></thead><tbody><tr><td>${rows.length}</td><td>${(carbon/1000).toFixed(2)} t</td><td>${avg("dbh_cm")} cm</td><td>${avg("height_m")} m</td></tr></tbody></table>
   <div class="dg-inventory-facts"><span>🌲 İbreli %${percent("İBRELİ")}</span><span>🍃 Yapraklı %${percent("YAPRAKLI")}</span><span>Diğer %${Math.max(0,100-Number(percent("İBRELİ"))-Number(percent("YAPRAKLI"))).toFixed(1)}</span>${hectares?`<span>Park alanı ${hectares.toFixed(2)} ha</span><span>Karbon yoğunluğu <b>${((carbon/1000)/hectares).toFixed(2)} t/ha</b></span>`:""}</div>
   <p class="dg-inventory-source">Kapsanan kayıt durumları: ${[...statuses].map(([status,n])=>escape(status)+" "+n).join(" · ")}. Tüm ölçüm ve karbon değerleri sistemde saklandığı haliyle aktarılır; bilimsel hesaplama yeniden çalıştırılmaz.</p>
   <div class="dg-inventory-section-label">02 / TÜR KOMPOZİSYONU</div>
   <h3>Tür bazında ölçüm özeti</h3><div class="dg-inventory-table-wrap"><table class="dg-inventory-table"><thead><tr><th>Tür</th><th>Latince</th><th>Grup</th><th>Adet</th><th>Karbon (kg)</th><th>Ort. Çap</th><th>Ort. Boy</th></tr></thead><tbody>${speciesHTML}</tbody></table></div>
   <div class="dg-inventory-section-label">03 / NOKTA BAZINDA ENVANTER</div>
   <h3>Point ID sıralı ayrıntılı envanter</h3><p class="dg-inventory-section-note">Her kayıt için ölçümler, konum ve varsa orijinal fotoğrafa giden bağlantı bulunmaktadır.</p><div class="dg-inventory-table-wrap"><table class="dg-inventory-table dg-inventory-points"><thead><tr><th>Point ID</th><th>Ölçüm No</th><th>Tür / Latince</th><th>Grup</th><th>Çevre (cm)</th><th>DBH (cm)</th><th>Boy (m)</th><th>Karbon (kg)</th><th>Durum</th><th>Fotoğraf</th></tr></thead><tbody>${lines}</tbody></table></div>
   <footer class="dg-inventory-footer"><div><strong>DENDROGEO</strong> · dendrogeo.org · Fotoğraflı saha envanteri</div><p>Fotoğraflar ve bağlantıları internet erişimi gerektirir. Bu belge bir DGR bilimsel yayın onayı, DOI kaydı veya doğrulama sertifikası değildir.</p></footer></section>`;
 }
 const REPORT_CSS=`.dg-park-export-report{font:14px/1.48 "Segoe UI",Arial,sans-serif;color:#19392c;background:#f3f7f4;padding:20px;max-width:1400px;margin:auto;box-sizing:border-box}
 .dg-park-export-report *{box-sizing:border-box}.dg-park-export-report .dg-inventory-park{background:#fff;border:1px solid #c9ded1;border-radius:14px;overflow:hidden;margin:0 auto 26px;box-shadow:0 6px 24px rgba(14,61,42,.08)}
 .dg-park-export-report .dg-inventory-masthead{background:#103d2e;color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:center;gap:18px}
 .dg-park-export-report .dg-inventory-brand{display:flex;align-items:center;gap:12px}.dg-park-export-report .dg-inventory-brand strong{display:block;font-size:24px;letter-spacing:2px}.dg-park-export-report .dg-inventory-brand small{display:block;color:#b8ddc9;font-size:10px;letter-spacing:1.2px}
 .dg-park-export-report .dg-inventory-mark{width:46px;height:46px;display:inline-flex;align-items:center;justify-content:center;border-radius:11px;background:#28684d;font-size:25px}
 .dg-park-export-report .dg-inventory-doc-label{text-align:right;font-size:13px;font-weight:700;letter-spacing:1px}.dg-park-export-report .dg-inventory-doc-label small{display:block;font-size:11px;letter-spacing:0;color:#c5e6d3;font-weight:400}
 .dg-park-export-report .dg-inventory-intro{padding:25px 28px 16px;border-bottom:1px solid #e2ede6}.dg-park-export-report .dg-inventory-eyebrow{color:#26825b;letter-spacing:1.8px;font-size:10px;font-weight:800;margin:0 0 6px}
 .dg-park-export-report h2{font-size:26px;line-height:1.2;margin:0 0 10px;color:#143e2d}.dg-park-export-report .dg-inventory-subtitle{font-size:13px;color:#476b57;margin:0 0 4px}.dg-park-export-report .dg-inventory-report-date{font-size:11px;color:#607d6c;margin:4px 0 0}
 .dg-park-export-report .dg-inventory-section-label{font-size:11px;letter-spacing:1px;font-weight:800;color:#177248;border-bottom:2px solid #d4e9dc;margin:26px 28px 12px;padding-bottom:8px}
 .dg-park-export-report .dg-inventory-stats{width:calc(100% - 56px);margin:0 28px;border-collapse:separate;border-spacing:8px 0;table-layout:fixed}.dg-park-export-report .dg-inventory-stats th{text-align:left;color:#587664;background:#e9f4ed;font-size:11px;padding:10px 12px;border:1px solid #d9e8df;border-bottom:0}.dg-park-export-report .dg-inventory-stats td{font-size:21px;font-weight:800;color:#143f30;padding:6px 12px 12px;background:#e9f4ed;border:1px solid #d9e8df;border-top:0}
 .dg-park-export-report .dg-inventory-facts{display:flex;flex-wrap:wrap;gap:8px;margin:18px 28px 10px}.dg-park-export-report .dg-inventory-facts span{background:#f0f7f2;border:1px solid #d7e9dc;border-radius:20px;padding:6px 11px;font-size:11px;color:#305d45}
 .dg-park-export-report .dg-inventory-source,.dg-park-export-report .dg-inventory-section-note{color:#587465;font-size:11px;margin:8px 28px 14px}.dg-park-export-report h3{margin:0 28px 10px;color:#173f2d;font-size:16px}
 .dg-park-export-report .dg-inventory-table-wrap{overflow-x:auto;margin:0 28px}.dg-park-export-report .dg-inventory-table{width:100%;border-collapse:collapse;font-size:11px;min-width:690px}.dg-park-export-report .dg-inventory-table th{background:#174d37;color:#fff;text-align:left;font-size:10px;letter-spacing:.2px;padding:9px 7px;border:1px solid #32664e}.dg-park-export-report .dg-inventory-table td{padding:8px 7px;border:1px solid #d7e5dc;vertical-align:top}.dg-park-export-report .dg-inventory-table tbody tr:nth-child(even){background:#f7faf8}
 .dg-park-export-report .dg-inventory-points{min-width:900px}.dg-park-export-report .dg-inventory-measurement td:first-child{color:#0b7149;font-weight:800}.dg-park-export-report .dg-inventory-number{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.dg-park-export-report .dg-inventory-detail td{background:#eef5f0;color:#567363;font-size:10px}.dg-park-export-report .dg-inventory-photo{object-fit:cover;border-radius:8px;border:1px solid #cdded3}.dg-park-export-report .dg-inventory-photo-cell{text-align:center}.dg-park-export-report a{color:#08704d;text-decoration:underline}.dg-park-export-report .dg-inventory-photo-cell small{display:block;overflow-wrap:anywhere;font-size:9px}
 .dg-park-export-report .dg-inventory-footer{margin-top:28px;padding:18px 28px;background:#e9f4ed;color:#386449;font-size:11px}.dg-park-export-report .dg-inventory-footer p{margin:6px 0 0;color:#62816c;font-size:10px}
 @media(max-width:650px){.dg-park-export-report{padding:8px}.dg-park-export-report .dg-inventory-masthead{padding:16px;flex-wrap:wrap}.dg-park-export-report .dg-inventory-intro{padding:18px 16px}.dg-park-export-report .dg-inventory-section-label{margin-left:16px;margin-right:16px}.dg-park-export-report .dg-inventory-stats{margin:0 10px;width:calc(100% - 20px);border-spacing:3px 0}.dg-park-export-report .dg-inventory-stats th{font-size:9px;padding:7px 5px}.dg-park-export-report .dg-inventory-stats td{font-size:14px;padding:5px}.dg-park-export-report .dg-inventory-table-wrap,.dg-park-export-report h3{margin-left:16px;margin-right:16px}.dg-park-export-report .dg-inventory-facts{margin-left:16px;margin-right:16px}}
 @media print{.dg-park-export-report{background:#fff;padding:0;max-width:none}.dg-park-export-report .dg-inventory-park{box-shadow:none;border:0;border-radius:0;margin:0}.dg-park-export-report .dg-inventory-park+.dg-inventory-park{break-before:page}.dg-park-export-report .dg-inventory-table{min-width:0}.dg-park-export-report .dg-inventory-table thead{display:table-header-group}.dg-park-export-report tr{break-inside:avoid}.dg-park-export-report .dg-inventory-masthead,.dg-park-export-report .dg-inventory-table th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
 @page{size:A4 landscape;margin:12mm}`;
 function documentHTML(groups,{latin={},origin=""}={}){
  const sections=groups.map(({group,rows})=>renderGroup(group,rows,{latin,origin})).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DendroGeo · Fotoğraflı Park Envanteri</title><style>${REPORT_CSS}</style></head><body><main class="dg-park-export-report">${sections}</main></body></html>`;
 }
 function downloadHTML(html,fileName,doc=root.document){
  const url=root.URL.createObjectURL(new root.Blob([html],{type:"text/html;charset=utf-8"}));
  const link=doc.createElement("a");link.href=url;link.download=fileName;doc.body.append(link);link.click();link.remove();
  root.setTimeout(()=>root.URL.revokeObjectURL(url),30000);
 }
 function waypointProjectGroups(projects,userId){
  // The participant query is the access boundary; show its project-level
  // results under the same park groups used by the full-inventory picker.
  const groups=new Map();
  for(const project of projects||[]){
   const park=parkOf(project),group=groups.get(park.key)||{...park,projects:[]};
   const sameName=String(project.name||"").trim().toLocaleLowerCase("tr-TR")===park.name.trim().toLocaleLowerCase("tr-TR");
   const identity=sameName?`Proje #${project.id}`:`${project.name||"Proje"} · #${project.id}`;
   group.projects.push({project,label:`${identity} · ${String(project.owner)===String(userId)?"Sana ait":"Ortak erişim"}`});
   groups.set(park.key,group);
  }
  return [...groups.values()].map(group=>({...group,projects:group.projects.sort((a,b)=>a.label.localeCompare(b.label,"tr")||Number(a.project.id)-Number(b.project.id))}))
   .sort((a,b)=>a.name.localeCompare(b.name,"tr")||String(a.key).localeCompare(String(b.key)));
 }
 async function buildWaypointCSV({client,userId,role,projectId,fetchWaypoints=root.DG_FETCH_PROJECT_WAYPOINTS,formats=root.DG_PARK_EXPORT_FORMATS}={}){
  if(!userId||!Number.isSafeInteger(Number(projectId))||Number(projectId)<=0)throw Error("Ölçüm noktaları için bir proje seç.");
  if(!await isCurrentParticipant(client,userId))throw Error("Oturum doğrulanamadı. Yeniden giriş yapıp projeleri yenile.");
  const projects=await listParticipantProjects(client,{userId,role});
  const project=projects.find(row=>Number(row.id)===Number(projectId));
  if(!project)throw Error("Bu projeye erişimin artık yok. Projeleri yenile.");
  if(!fetchWaypoints?.fetch||!formats?.waypointsCSV)throw Error("Ölçüm noktaları dışa aktarma modülü yüklenemedi.");
  const response=await fetchWaypoints.fetch({client,projectId:Number(project.id)});
  if(response?.error)throw Error(response.error.message||"Ölçüm noktaları okunamadı.");
  const rows=response?.data||[];
  if(!rows.length)throw Error("Seçili projede dışa aktarılacak ölçüm noktası yok.");
  if(rows.some(row=>Number(row.project_id)!==Number(project.id)))throw Error("Seçilen proje dışında nokta bulundu. Karışık CSV oluşturulmadı.");
  const park=parkOf(project);
  return{project,csv:formats.waypointsCSV(rows,{id:Number(project.id),name:project.name||`Proje ${project.id}`,parkId:park.id,parkName:park.name}),count:rows.length};
 }
 function openPreview(title,html,fileName){
  const doc=root.document,modal=doc.getElementById("previewModal");
  const titleEl=doc.getElementById("pvTitle"),body=doc.getElementById("pvBody"),button=doc.getElementById("pvDownload");
  if(!modal||!titleEl||!body||!button)throw Error("Rapor önizleme penceresi bulunamadı.");
  titleEl.textContent=title;
  const reportStyles=html.match(/<style>([\s\S]*?)<\/style>/)?.[1]||"";
  body.innerHTML=`<style>${reportStyles}</style>`+(html.match(/<body>([\s\S]*)<\/body>/)?.[1]||"");
  button.onclick=()=>downloadHTML(html,fileName);
  root.DG_EXPORT_PREVIEW_UI.open(modal);
 }
 function status(id,message,error=false){const el=root.document.getElementById(id);if(el){el.textContent=message;el.style.color=error?"var(--red)":"var(--mut)";}}
 function setBusy(value){busy=value;root.document.querySelectorAll('[data-dg-park-inventory-action="preview"],[data-dg-park-inventory-action="admin"],[data-dg-park-inventory-action="waypoints-csv"]').forEach(btn=>{btn.disabled=value;});}
 async function refresh(){
  const el=root.document.getElementById("dgSharedParkSelect");if(!el)return;
  const waypointSelect=root.document.getElementById("dgWaypointExportProject");
  if(typeof USER==="undefined"||!USER?.id){status("dgSharedParkStatus","Oturum açıldığında ortak parklar görüntülenir.");if(waypointSelect)status("dgWaypointExportStatus","Ölçüm noktalarını indirmek için oturum aç.",true);return;}
  const user=USER.id;status("dgSharedParkStatus","Erişebildiğin parklar yükleniyor…");
  try{
   const participantProjects=await listParticipantProjects(sb,{userId:user,role:PROFILE?.role}),groups=groupProjects(participantProjects);if(USER?.id!==user)return;
   visibleParks=groups;loadedFor=user;
   const previous=el.value;
   el.replaceChildren(new Option("Park seç", ""),...[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr")).map(g=>new Option(`${g.name} · ${g.projects.length} proje`,g.key)));
   if(groups.has(previous))el.value=previous;
   else if(groups.size===1)el.value=groups.keys().next().value;
   if(waypointSelect){
     const previous=waypointSelect.value;
     waypointSelect.replaceChildren(new Option("Park seç", ""),...[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr")).map(g=>new Option(`${g.name} · ${g.projects.length} proje`,g.key)));
     if(groups.has(previous))waypointSelect.value=previous;
     else if(groups.size===1)waypointSelect.value=groups.keys().next().value;
     status("dgWaypointExportStatus",`${groups.size} sahip/ortak parkı · Seçili parkın erişilebilir projelerindeki noktalar indirilir.`);
   }
   const measurementSelect=root.document.getElementById("dgMeasurementExportPark");
   if(measurementSelect){const previous=measurementSelect.value;measurementSelect.replaceChildren(new Option("Park seç",""),...[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr")).map(g=>new Option(`${g.name} · ${g.projects.length} proje`,g.key)));if(groups.has(previous))measurementSelect.value=previous;else if(groups.size===1)measurementSelect.value=groups.keys().next().value;}
   const formatCount=root.document.querySelector("#v-export .export-summary-note");if(formatCount)formatCount.textContent="4 biçim";
   status("dgSharedParkStatus",participantProjects.sharingError
    ?`Paylaşılan projeler yenilenemedi; yalnızca sana ait projeler gösteriliyor. ${participantProjects.sharingError.message}`
    :`${groups.size} sahip/ortak parkı · Yalnızca Projeler ekranında listelenen erişilebilir projeler gösterilir.`,!!participantProjects.sharingError);
  }catch(error){visibleParks=new Map();loadedFor=null;el.replaceChildren(new Option("Parklar yüklenemedi", ""));if(waypointSelect)waypointSelect.replaceChildren(new Option("Projeler yüklenemedi", ""));status("dgWaypointExportStatus","Projeler yüklenemedi: "+error.message,true);status("dgSharedParkStatus","Parklar yüklenemedi: "+error.message,true);}
 }
 async function downloadWaypoints(){
  if(busy)return;
  const select=root.document.getElementById("dgWaypointExportProject"),selected=select?.value;
  if(!USER?.id){status("dgWaypointExportStatus","Önce oturum açmalısın.",true);return;}
  if(!selected){status("dgWaypointExportStatus","CSV için bir park seç.",true);return;}
  const user=USER.id;setBusy(true);status("dgWaypointExportStatus","Seçili projenin ölçüm noktaları alınıyor…");
  try{
   if(!await isCurrentParticipant(sb,user))throw Error("Oturum doğrulanamadı.");
   const group=groupProjects(await listParticipantProjects(sb,{userId:user,role:PROFILE?.role})).get(selected);
   if(!group)throw Error("Bu parka erişimin artık yok.");
   const results=[];
   for(const project of group.projects){
    const response=await root.DG_FETCH_PROJECT_WAYPOINTS.fetch({client:sb,projectId:Number(project.id)});
    if(response?.error)throw Error(response.error.message);
    const rows=response?.data||[];
    if(rows.some(row=>Number(row.project_id)!==Number(project.id)))throw Error("Proje dışında nokta bulundu.");
    if(rows.length)results.push({csv:root.DG_PARK_EXPORT_FORMATS.waypointsCSV(rows,{id:Number(project.id),name:project.name,parkId:group.id,parkName:group.name}),count:rows.length});
   }
   if(!results.length)throw Error("Seçili parkta ölçüm noktası yok.");
   const result={project:{id:group.id||selected,name:group.name},count:results.reduce((n,r)=>n+r.count,0),csv:results.map((r,i)=>i?r.csv.replace(/^\uFEFF[^\n]*\n/,""):r.csv).join("")};
   if(USER?.id!==user||select.value!==selected){status("dgWaypointExportStatus","Oturum veya proje seçimi değişti. Yeniden dene.",true);return;}
    const fileName=`dendrogeo_olcum_noktalari_${slug(result.project.name||`proje_${result.project.id}`)}_${result.project.id}.csv`;
   const url=root.URL.createObjectURL(new root.Blob([result.csv],{type:"text/csv;charset=utf-8;"}));
   const link=root.document.createElement("a");link.href=url;link.download=fileName;root.document.body.append(link);link.click();link.remove();
   root.setTimeout(()=>root.URL.revokeObjectURL(url),30000);
   status("dgWaypointExportStatus",`${result.count} ölçüm noktası indirildi · ${result.project.name||`Proje ${result.project.id}`}.`);
  }catch(error){status("dgWaypointExportStatus","CSV indirilemedi: "+error.message,true);}finally{setBusy(false);}
 }
 async function preview(){
  if(busy)return;
  if(!USER?.id){status("dgSharedParkStatus","Önce oturum açmalısın.",true);return;}
  if(loadedFor!==USER.id)await refresh();
  const selected=root.document.getElementById("dgSharedParkSelect")?.value;
  const group=visibleParks.get(selected);
  if(!group){status("dgSharedParkStatus","Lütfen erişebildiğin bir park seç.",true);return;}
  setBusy(true);status("dgSharedParkStatus","Ortak ölçümler alınıyor…");
  try{
   // Recheck authorization at download time: a revoked invite must not reuse a stale selection.
   const current=groupProjects(await listParticipantProjects(sb,{userId:USER.id,role:PROFILE?.role})).get(selected);
   if(!current){visibleParks.delete(selected);status("dgSharedParkStatus","Bu park için sahiplik veya ortaklık erişimin artık yok. Parkları yenile.",true);return;}
   const rows=await readAll(sb,current.projects.map(p=>p.id));
   if(!rows.length){status("dgSharedParkStatus","Bu parkta erişilebilir ölçüm bulunamadı.",true);return;}
   const html=documentHTML([{group:current,rows}],{latin:LATIN,origin:SB_URL});
   openPreview("📄 "+current.name+" — Ortak Park Envanteri",html,slug(current.name)+"_ortak_envanter.html");
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
 async function measurementExport(format,preview=false){
  if(busy)return;
  const select=root.document.getElementById("dgMeasurementExportPark"),selected=select?.value,user=USER?.id;
  if(!user||!selected){status("dgMeasurementExportStatus","Dışa aktarım için bir park seç.",true);return;}
  setBusy(true);
  try{
   if(!await isCurrentParticipant(sb,user))throw Error("Oturum doğrulanamadı.");
   const group=groupProjects(await listParticipantProjects(sb,{userId:user,role:PROFILE?.role})).get(selected);
   if(!group)throw Error("Bu parka erişimin artık yok. Parkları yenile.");
   const rows=await readAll(sb,group.projects.map(p=>p.id));
   if(USER?.id!==user||select.value!==selected)throw Error("Oturum veya park seçimi değişti. Yeniden dene.");
   if(!rows.length&&!preview)throw Error("Seçili parkta erişilebilir ölçüm yok.");
   const ports=root.dgUserExportPorts(),options=ports.resolve(format),content=ports.serialize(format,rows,{preview}),fileName=slug(group.name)+"_"+options.fileName;
   if(preview)root.openPreview(group.name+" · "+options.previewTitle,content,options.isCSV,fileName);
   else ports.download(content,fileName);
   status("dgMeasurementExportStatus",`${group.name} · ${rows.length} kayıt`);
  }catch(error){status("dgMeasurementExportStatus",error.message,true);}finally{setBusy(false);}
 }
 function mount(){
  const exportBody=root.document.querySelector?.("#v-export .export-panel-body"),adminCard=root.document.getElementById?.("admExpCountry")?.closest?.(".card");
  const exportGrid=root.document.querySelector?.("#v-export .export-format-grid");
  if(exportGrid&&!root.document.getElementById("dgMeasurementExportPark")){
   const section=root.document.createElement("section");section.className="export-format-card";section.style.gridColumn="1 / -1";
   section.innerHTML='<label class="lbl" for="dgMeasurementExportPark">Park / ortak proje</label><div class="export-actions"><select id="dgMeasurementExportPark" style="flex:1 1 280px;min-width:0;max-width:560px"><option value="">Park seç</option></select><button type="button" class="btn sm ghost" data-dg-park-inventory-action="refresh">↻ Parkları yenile</button></div><p id="dgMeasurementExportStatus" class="dg-meta" role="status">Standart CSV, GeoJSON ve QGIS CSV seçtiğin parkın erişilebilir ölçümlerini içerir.</p>';
   exportGrid.prepend(section);
  }
  if(exportGrid&&!root.document.getElementById("dgWaypointExportProject")){
   const csvCard=[...exportGrid.querySelectorAll(".export-format-card")].find(card=>card.querySelector("h3")?.textContent.trim()==="Standart CSV");
   if(csvCard){
    const section=root.document.createElement("section");section.className="export-format-card";section.style.gridColumn="1 / -1";
    section.innerHTML='<div class="export-format-top"><span class="export-format-icon">📍</span><span class="badge on">ÖLÇÜM NOKTALARI</span></div><h3>Ölçüm Noktaları CSV</h3><p>Seçtiğin parkın erişilebilir projelerindeki ölçüm noktalarını mevcut durumlarıyla CSV olarak indir.</p><label class="lbl" for="dgWaypointExportProject">Park / ortak proje</label><div class="export-actions" style="align-items:center;max-width:960px"><select id="dgWaypointExportProject" style="flex:1 1 280px;max-width:560px;min-width:0"><option value="">Projeler yükleniyor…</option></select><button type="button" class="btn sm blue" data-dg-park-inventory-action="waypoints-csv">⬇ CSV indir</button><button type="button" class="btn sm ghost" data-dg-park-inventory-action="refresh">↻ Yenile</button></div><p id="dgWaypointExportStatus" class="dg-meta" role="status">Erişilebilir projeler yükleniyor…</p>';
    exportGrid.append(section);
   }
  }
  if(exportBody&&!root.document.getElementById("dgSharedParkSelect")){
   const section=root.document.createElement("section");section.className="export-format-card";section.style.marginTop="14px";
   section.innerHTML='<h3>🌳 Park · Tam Envanter</h3><p>Yalnız oluşturduğun projeler ve davetini kabul ettiğin ortak çalışmalar gösterilir. Point ID sıralı ölçümler, tıklanabilir fotoğraflarla DendroGeo envanter raporunda sunulur. Yöneticinin tüm kullanıcı çıktısı yalnız yönetim bölümündedir.</p><div class="grid g3"><div><label class="lbl" for="dgSharedParkSelect">Park / ortak proje</label><select id="dgSharedParkSelect"><option value="">Parklar yükleniyor…</option></select></div><div style="align-self:end"><button type="button" class="btn sm ghost" data-dg-park-inventory-action="refresh">↻ Parkları yenile</button></div><div style="align-self:end"><button type="button" class="btn sm" data-dg-park-inventory-action="preview">📄 DendroGeo raporu / HTML indir</button></div></div><p id="dgSharedParkStatus" class="dg-meta" role="status">Ortak parkları görmek için bu sekmeyi aç.</p>';
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
   if(action==="refresh")refresh();else if(action==="preview")preview();else if(action==="admin")admin();else if(action==="waypoints-csv")downloadWaypoints();
  });
  const view=root.document.getElementById?.("v-export");
  if(view&&root.MutationObserver){new root.MutationObserver(()=>{if(view.classList.contains("on"))refresh();}).observe(view,{attributes:true,attributeFilter:["class"]});}
  if(view?.classList.contains("on"))refresh();
 }
  root.DG_SHARED_PARK_INVENTORY_EXPORT=Object.freeze({photoURL,groupProjects,readAll,sortPoints,renderGroup,documentHTML,listProjects,listParticipantProjects,downloadHTML,waypointProjectGroups,buildWaypointCSV,measurementExport,init});
 if(root.document?.readyState==="loading")root.document.addEventListener("DOMContentLoaded",init,{once:true});else if(root.document)init();
})(window);
