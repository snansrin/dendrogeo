"use strict";
/* ===== DendroGeo v2 · src/services/dash.js =====
Panel, analiz, grafikler, kayıtlar, dünya verisi yükleme */

// 1. Kayıtlarım — ana tema ile proje bazında açılır/kapanır envanter
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadRecords(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadRecords__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgRecordStatusMeta(status){
 const st=status||"Beklemede";
 return {label:st==="Beklemede"?"Onay Bekliyor":st,cls:st==="Onaylı"?"on":(st==="Red"?"off":"admin")};
}
function dgRecordProjectGroup(name,rows){
 const carbon=rows.reduce((a,r)=>a+(Number(r.carbon_kg)||0),0);
 const approved=rows.filter(r=>r.status==="Onaylı").length;
 const pending=rows.filter(r=>!r.status||r.status==="Beklemede").length;
 const body=rows.map(r=>{
  const st=dgRecordStatusMeta(r.status);
  const dbh=Number.isFinite(+r.dbh_cm)?(+r.dbh_cm).toFixed(1):"—";
  const girth=Number.isFinite(+r.girth_cm)&&+r.girth_cm>0?(+r.girth_cm).toFixed(1):"—";
  const height=Number.isFinite(+r.height_m)?(+r.height_m).toFixed(1):"—";
  return `<article class="record-item">
   <div class="record-main"><div class="record-point">P${esc(r.point_id)}</div><div class="record-tree"><b>${esc(r.species)||"—"}</b><span>${esc(r.grp)||"—"}</span></div></div>
   <div class="record-metrics"><div><span>Çevre</span><b>${girth} cm</b></div><div><span>DBH</span><b>${dbh} cm</b></div><div><span>Boy</span><b>${height} m</b></div><div><span>Karbon</span><b>${(Number(r.carbon_kg)||0).toFixed(1)} kg C</b></div></div>
   <div class="record-side"><span class="badge ${st.cls}">${esc(st.label)}</span><div class="record-photo">${dgThumb(r.photo_url)}</div><div class="record-actions"><button class="btn sm blue" onclick="editRec(${r.id})" aria-label="P${esc(r.point_id)} kaydını düzenle">✏️ Düzenle</button><button class="btn sm red" onclick="delRec(${r.id})" aria-label="P${esc(r.point_id)} kaydını sil">Sil</button></div></div>
  </article>`;
 }).join("");
 return `<details class="record-project">
  <summary><div class="record-project-title"><span class="record-project-icon">📁</span><span><b>${esc(name)||"Projesiz kayıtlar"}</b><small>${rows.length} kayıt · ${approved} onaylı${pending?" · "+pending+" bekliyor":""}</small></span></div><div class="record-project-total"><b>${carbon.toFixed(1)}</b><span>kg C</span></div></summary>
  <div class="record-project-body">${body}</div>
 </details>`;
}
async function loadRecords__scroll(){
 const{data}=await sb.from("measurements").select("*,projects(name)").eq("owner",USER.id).order("created_at",{ascending:false});
 const recRows=(data||[]).slice().sort((a,b)=>{
  const pa=(a.projects&&a.projects.name)||"",pb=(b.projects&&b.projects.name)||"";
  const c=String(pa).localeCompare(String(pb),"tr");
  return c!==0?c:((+a.point_id||0)-(+b.point_id||0))||((+a.measurement_no||1)-(+b.measurement_no||1));
 });
 const groups=new Map();
 for(const r of recRows){const name=(r.projects&&r.projects.name)||"Projesiz kayıtlar";if(!groups.has(name))groups.set(name,[]);groups.get(name).push(r);}
 const el=$("recGroups");if(!el)return;
 el.innerHTML=groups.size?[...groups.entries()].map(([name,rows])=>dgRecordProjectGroup(name,rows)).join(""):`<div class="card records-empty">${typeof dgCf==="function"?dgCf("Kayıt yok"):"Kayıt yok"}</div>`;
}
// 2. Kayıt sil
async function delRec(id){
 if(!confirm(dgCf("Kayıt tamamen silinsin mi?")))return;
 // Delete the row first. A rejected/zero-row delete must retain its photo.
 const{data,error}=await sb.from("measurements").delete().eq("id",id).select("photo_url");
 if(error||!data?.length)return toast(dgCf("Kayıt silinemedi: ")+(error?.message||dgCf("Sunucu silmeyi doğrulamadı.")),"err");
 for(const row of data)if(row.photo_url)await removePhoto(row.photo_url);
 loadRecords();loadDash();
 dgMarkLiveDirty();
 if(typeof loadLiveMap==="function"&&$("v-map")?.classList.contains("on"))loadLiveMap();
}
// 3. Panel istatistikleri + grafik
async function loadDash(){
 if(typeof dgAcademicProfileRender==="function")dgAcademicProfileRender();
 const{data}=await sb.from("measurements").select("*").eq("owner",USER.id);
 $("dMy").textContent=(data||[]).length;
 $("dCarbon").textContent=((data||[]).reduce((a,r)=>a+(r.carbon_kg||0),0)).toFixed(0);
 drawChart("chCarbon","bar",(data||[]).slice(0,10).map(r=>"P"+r.point_id),(data||[]).slice(0,10).map(r=>r.carbon_kg));
 renderAnalysis(data||[],"myAnalysis");
}
// 4. Tür dağılımı listesi
// 5. Chart.js grafiği
async function drawChart(id,type,labels,data){
 /* Faz 7: Chart.js tembel yüklenir; çağıranlar fire-and-forget bırakabilir. */
 if(window.dgEnsureChart)await window.dgEnsureChart();
 if(charts[id])charts[id].destroy();
 const pal=["#14532d","#1e6f4b","#2e8b57","#3aa76d","#6aa84f","#8fbc6d","#c77d2e","#d97706","#92400e","#4c9a52"];
 charts[id]=new Chart($(id),{type,data:{labels,datasets:[{data,backgroundColor:(c)=>pal[c.dataIndex%pal.length],borderRadius:8,borderSkipped:false,barPercentage:.6}]},options:{plugins:{legend:{display:false}},scales:type==="bar"?{y:{grid:{color:"rgba(20,30,25,.06)"},ticks:{color:"#5f6d65"}},x:{grid:{display:false},ticks:{color:"#5f6d65"}}}:undefined}});
}
// 6. Ağaç çeşitliliği analizi
/* ============ AKTİF VERİ ANALİZİ (İbreli/Yapraklı yüzde, ort. çap/boy, tür dağılımı) ============ */
/* 0040: kaydırma koruma sarmalı. */
function renderAnalysis(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return renderAnalysis__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function renderAnalysis__scroll(rows,elId){
 const el=$(elId);if(!el)return;
 rows=rows||[];
 if(!rows.length){el.innerHTML="";return;}
 const groups={"İBRELİ":{n:0,dbh:0,h:0},"YAPRAKLI":{n:0,dbh:0,h:0},"DİĞER":{n:0,dbh:0,h:0}};
 const bySpecies={};
 rows.forEach(r=>{
  const g=groups[r.grp]?r.grp:"DİĞER";
  groups[g].n++;groups[g].dbh+=(r.dbh_cm||0);groups[g].h+=(r.height_m||0);
  bySpecies[r.species]=bySpecies[r.species]||{n:0,grp:g};
  bySpecies[r.species].n++;
 });
 const total=rows.length;
 const pct=n=>total?((n/total)*100).toFixed(1):"0.0";
 const avgDbh=total?(rows.reduce((a,r)=>a+(r.dbh_cm||0),0)/total).toFixed(1):"0";
 const avgH=total?(rows.reduce((a,r)=>a+(r.height_m||0),0)/total).toFixed(1):"0";
 const ibPct=pct(groups["İBRELİ"].n);
 const yaPct=pct(groups["YAPRAKLI"].n);
 const diPct=pct(groups["DİĞER"].n);
 const topSpecies=Object.entries(bySpecies).sort((a,b)=>b[1].n-a[1].n).slice(0,6);
 
 el.innerHTML=`
  <div class="card">
   <div class="shead" style="margin-bottom:14px"><span class="no">🌳</span><h2 style="font-size:1.15rem">Ağaç Çeşitliliği & Yapısal Analiz</h2><span class="rule"></span><span class="mono" style="font-size:.78rem;color:var(--mut)">${total} onaylı kayıt</span></div>
   
   <!-- Grup dağılımı yatay bar -->
   <div style="margin-bottom:18px">
    <div class="lbl" style="margin-bottom:8px">Grup Dağılımı</div>
    <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px;color:var(--mut)">
     <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GROUP_COLOR["İBRELİ"]};margin-right:5px"></span>İbreli <b style="color:var(--ink)">${ibPct}%</b></span>
     <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GROUP_COLOR["YAPRAKLI"]};margin-right:5px"></span>Yapraklı <b style="color:var(--ink)">${yaPct}%</b></span>
     <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GROUP_COLOR["DİĞER"]};margin-right:5px"></span>Diğer <b style="color:var(--ink)">${diPct}%</b></span>
    </div>
    <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line)">
     <div style="width:${ibPct}%;background:${GROUP_COLOR["İBRELİ"]};transition:width .6s"></div>
     <div style="width:${yaPct}%;background:${GROUP_COLOR["YAPRAKLI"]};transition:width .6s"></div>
     <div style="width:${diPct}%;background:${GROUP_COLOR["DİĞER"]};transition:width .6s"></div>
    </div>
   </div>
   
   <!-- Ortalamalar -->
   <div class="grid g4" style="margin-bottom:18px">
    <div class="stat" style="padding:14px"><div class="lbl">Ort. Çap</div><div class="val" style="font-size:1.15rem">${avgDbh} <span style="font-size:.7rem;font-weight:400">cm</span></div></div>
    <div class="stat" style="padding:14px"><div class="lbl">Ort. Boy</div><div class="val" style="font-size:1.15rem">${avgH} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
    <div class="stat" style="padding:14px"><div class="lbl" style="color:${GROUP_COLOR_INK["İBRELİ"]}">İbreli Ort.Boy</div><div class="val" style="font-size:1.15rem">${groups["İBRELİ"].n?(groups["İBRELİ"].h/groups["İBRELİ"].n).toFixed(1):"—"} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
    <div class="stat" style="padding:14px"><div class="lbl" style="color:${GROUP_COLOR_INK["YAPRAKLI"]}">Yapraklı Ort.Boy</div><div class="val" style="font-size:1.15rem">${groups["YAPRAKLI"].n?(groups["YAPRAKLI"].h/groups["YAPRAKLI"].n).toFixed(1):"—"} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
   </div>
   
   <!-- Top 6 tür -->
   <div class="lbl" style="margin-bottom:10px">En Yaygın 6 Tür</div>
   ${topSpecies.map(([sp,v])=>`<div style="margin-bottom:12px">
     <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px;color:var(--mut)">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GROUP_COLOR[v.grp]};margin-right:5px"></span>${esc(sp)} <i style="font-style:italic;font-size:.7rem;color:var(--mut)">${esc(LATIN[sp])||""}</i></span>
      <span><b style="color:var(--ink)">${v.n}</b> (${pct(v.n)}%)</span>
     </div>
     <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line)">
      <div style="width:${pct(v.n)}%;background:${GROUP_COLOR[v.grp]};transition:width .6s"></div>
     </div>
    </div>`).join("")}
  </div>`;
}
// 7. Dünya verisi yükle
/* SESSİZ catch(e){} KALDIRILDI (2026-09-26).
 *
 * Bu blok v_global + v_country + v_city sorgularını VE işaretçi yüklemesini
 * sarıyordu; içlerinden biri patladığında (RLS/42501, JWT tazelenirken 401,
 * PostgREST şema önbelleği, ağ) Dünya sekmesi BOMBOŞ kalıyor ve ekranda
 * hiçbir açıklama olmuyordu. Kullanıcının gördüğü tek şey "onayladığım veri
 * ne dünyada ne canlı haritada var" — oysa veri veritabanında duruyordu.
 * Projenin kendi ilkesi (park-registry: "sessiz başarısızlık yok") burada
 * uygulanmıyordu. Artık sebep #worldErr kutusunda + ↻ Yeniden dene.
 *
 * İŞARETÇİ HATASI: loadApprovedMarkers artık hatayı 3. argümanla döndürüyor;
 * başarısızlıkta analiz bloğu yanlış veriyle (boş küme) doldurulmuyor. */
async function loadWorld(){
 const box=$("worldErr");
 if(box)box.style.display="none";
 try{
  const g=await sb.from("v_global").select("*").single();
  if(g.data){$("wRec").textContent=g.data.records||0;$("wCountry").textContent=g.data.countries||0;$("wCity").textContent=g.data.cities||0;$("wCarbon").textContent=g.data.carbon_t||0;}
  const c=await sb.from("v_country").select("*");
  $("wCountryT").innerHTML=(c.data||[]).slice(0,30).map(r=>`<tr><td data-label="Ülke">${esc(r.country)}</td><td data-label="Kayıt">${r.records}</td><td data-label="Karbon(t)">${r.carbon_t}</td><td data-label="Ort.Çap">${Number.isFinite(+r.avg_dbh)?(+r.avg_dbh).toFixed(1):"—"}</td><td data-label="Ort.Yükseklik(m)">${r.avg_height||"—"}</td></tr>`).join("")||"<tr><td colspan=5>—</td></tr>";
  const t=await sb.from("v_city").select("*");
  $("wCityT").innerHTML=(t.data||[]).slice(0,30).map(r=>`<tr><td data-label="Şehir">${esc(r.city)}</td><td data-label="Kayıt">${r.records}</td><td data-label="Karbon(t)">${r.carbon_t}</td></tr>`).join("")||"<tr><td colspan=3>—</td></tr>";
  loadApprovedMarkers(worldMap,3000,(n,rows,err)=>{
   if(err)return dgWorldError("İşaretçiler yüklenemedi: "+err);
   dgMarkLiveDirty();   /* dünya tazelendi → canlı harita kümesi de bayat */
   if(worldMap&&worldMap._clusterDegraded)
     console.warn("DENDROGEO · dünya haritası kümelenmeden çizildi (markercluster yok)");
   renderAnalysis(rows,"worldAnalysis");
  });
  loadParkCompare();
 }catch(e){
  dgWorldError((e&&(e.message||e))+"");
 }
}
function dgWorldError(msg){
 console.error("DENDROGEO · loadWorld:",msg);
 const box=$("worldErr");
 if(!box)return;
 box.style.display="";
 box.className="alert err";
 box.innerHTML=`<b>⚠ Dünya verisi yüklenemedi</b> — sayılar/harita bu yüzden boş olabilir. Kayıt silinmedi: `+
  `<span class="mono" style="font-size:.74rem">${esc(msg)}</span> `+
  `<button class="btn sm" style="margin-left:6px" onclick="loadWorld()">↻ Yeniden dene</button>`;
}
