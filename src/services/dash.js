"use strict";
/* ===== DendroGeo v2 · src/services/dash.js =====
Panel, analiz, grafikler, kayıtlar, dünya verisi yükleme */

// 1. Kayıtlarım tablosu
async function loadRecords(){ 
 const{data}=await sb.from("measurements").select("*,projects(name)").eq("owner",USER.id).order("created_at",{ascending:false});
 $("recTable").innerHTML=(data||[]).map(r=>{
  const st=r.status||"Beklemede";
  const bc=st==="Onaylı"?"on":(st==="Red"?"off":"admin");
  return `<tr><td>${esc(r.projects?.name)||"—"}</td><td>${r.point_id}</td><td>${esc(r.species)}</td><td>${r.dbh_cm}</td><td>${r.height_m}</td><td>${(r.carbon_kg||0).toFixed(1)}</td><td>${r.photo_url?"📷":"—"}</td><td><span class="badge ${bc}">${st==="Beklemede"?"Onay Bekliyor":st}</span></td><td style="display:flex;gap:4px"><button class="btn sm blue" onclick="editRec(${r.id})">✏️</button><button class="btn sm red" onclick="delRec(${r.id})">Sil</button></td></tr>`;
 }).join("")||"<tr><td colspan=9>Kayıt yok</td></tr>";
}
// 2. Kayıt sil
async function delRec(id){
 if(!confirm("Kayıt tamamen silinsin mi?"))return;
 const{data}=await sb.from("measurements").select("photo_url").eq("id",id).single();
 if(data)await removePhoto(data.photo_url);
 await sb.from("measurements").delete().eq("id",id);loadRecords();loadDash();
}
// 3. Panel istatistikleri + grafik
async function loadDash(){
 const{data}=await sb.from("measurements").select("*").eq("owner",USER.id);
 $("dMy").textContent=(data||[]).length;
 $("dCarbon").textContent=((data||[]).reduce((a,r)=>a+(r.carbon_kg||0),0)).toFixed(0);
 drawChart("chCarbon","bar",(data||[]).slice(0,10).map(r=>"P"+r.point_id),(data||[]).slice(0,10).map(r=>r.carbon_kg));
 renderAnalysis(data||[],"myAnalysis");
}
// 4. Tür dağılımı listesi
// 5. Chart.js grafiği
function drawChart(id,type,labels,data){
 if(charts[id])charts[id].destroy();
 const pal=["#14532d","#1e6f4b","#2e8b57","#3aa76d","#6aa84f","#8fbc6d","#c77d2e","#d97706","#92400e","#4c9a52"];
 charts[id]=new Chart($(id),{type,data:{labels,datasets:[{data,backgroundColor:(c)=>pal[c.dataIndex%pal.length],borderRadius:8,borderSkipped:false,barPercentage:.6}]},options:{plugins:{legend:{display:false}},scales:type==="bar"?{y:{grid:{color:"rgba(20,30,25,.06)"},ticks:{color:"#68766e"}},x:{grid:{display:false},ticks:{color:"#68766e"}}}:undefined}});
}
// 6. Ağaç çeşitliliği analizi
/* ============ AKTİF VERİ ANALİZİ (İbreli/Yapraklı yüzde, ort. çap/boy, tür dağılımı) ============ */
function renderAnalysis(rows,elId){
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
    <div class="stat" style="padding:14px"><div class="lbl" style="color:${GROUP_COLOR["İBRELİ"]}">İbreli Ort.Boy</div><div class="val" style="font-size:1.15rem">${groups["İBRELİ"].n?(groups["İBRELİ"].h/groups["İBRELİ"].n).toFixed(1):"—"} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
    <div class="stat" style="padding:14px"><div class="lbl" style="color:${GROUP_COLOR["YAPRAKLI"]}">Yapraklı Ort.Boy</div><div class="val" style="font-size:1.15rem">${groups["YAPRAKLI"].n?(groups["YAPRAKLI"].h/groups["YAPRAKLI"].n).toFixed(1):"—"} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
   </div>
   
   <!-- Top 6 tür -->
   <div class="lbl" style="margin-bottom:10px">En Yaygın 6 Tür</div>
   ${topSpecies.map(([sp,v])=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:6px 10px;background:var(--bg);border-radius:8px">
     <div style="width:8px;height:8px;border-radius:50%;background:${GROUP_COLOR[v.grp]}"></div>
     <div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:600">${esc(sp)}</div><div style="font-size:.68rem;color:var(--mut);font-style:italic">${esc(LATIN[sp])||""}</div></div>
     <div style="width:100px;background:var(--line);border-radius:4px;height:6px;overflow:hidden"><div style="height:100%;width:${pct(v.n)}%;background:${GROUP_COLOR[v.grp]}"></div></div>
     <div class="mono" style="font-size:.78rem;color:var(--ink);font-weight:600;width:42px;text-align:right">${v.n} <span style="color:var(--mut);font-weight:400">(${pct(v.n)}%)</span></div>
    </div>`).join("")}
  </div>`;
}
// 7. Dünya verisi yükle
async function loadWorld(){
 try{
  const g=await sb.from("v_global").select("*").single();
  if(g.data){$("wRec").textContent=g.data.records||0;$("wCountry").textContent=g.data.countries||0;$("wCity").textContent=g.data.cities||0;$("wCarbon").textContent=g.data.carbon_t||0;}
  const c=await sb.from("v_country").select("*");
  $("wCountryT").innerHTML=(c.data||[]).slice(0,30).map(r=>`<tr><td>${esc(r.country)}</td><td>${r.records}</td><td>${r.carbon_t}</td><td>${r.avg_dbh}</td><td>${r.avg_height||"—"}</td></tr>`).join("")||"<tr><td colspan=5>—</td></tr>";
  const t=await sb.from("v_city").select("*");
  $("wCityT").innerHTML=(t.data||[]).slice(0,30).map(r=>`<tr><td>${esc(r.city)}</td><td>${r.records}</td><td>${r.carbon_t}</td></tr>`).join("")||"<tr><td colspan=3>—</td></tr>";
  loadApprovedMarkers(worldMap,3000,(n,rows)=>renderAnalysis(rows,"worldAnalysis"));
  loadParkCompare();
 }catch(e){}
}
