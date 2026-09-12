"use strict";
/* ============ PARK KARŞILAŞTIRMA + RAPOR ============ */
let PARK_DATA=[];
async function loadParkCompare(){
 const{data}=await sb.from("measurements").select("carbon_kg,dbh_cm,height_m,species,grp,projects(name,city)").eq("status","Onaylı").limit(5000);
 PARK_DATA=data||[];
 const by={};
 PARK_DATA.forEach(r=>{
  const name=r.projects?.name||"—";
  const p=by[name]=by[name]||{name,city:r.projects?.city||"—",n:0,c:0,dbh:0,h:0};
  p.n++;p.c+=(r.carbon_kg||0);p.dbh+=(r.dbh_cm||0);p.h+=(r.height_m||0);
 });
 const list=Object.values(by).sort((a,b)=>b.c-a.c);
 const max=list.length?list[0].c:1;
 const el=$("parkCompare");if(!el)return;
 el.innerHTML=list.length?list.map((p,i)=>`
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:8px 12px;background:var(--bg);border-radius:10px">
   <div class="mono" style="width:26px;height:26px;border-radius:50%;background:${i===0?"var(--green)":"var(--line)"};color:${i===0?"#fff":"var(--mut)"};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;flex:0 0 auto">${i+1}</div>
   <div style="flex:1;min-width:0">
    <div style="font-size:.85rem;font-weight:700">${esc(p.name)} ${i===0?'<span class="badge on">🏆 En İyi</span>':""}</div>
    <div style="font-size:.7rem;color:var(--mut)">${esc(p.city)} · ${p.n} kayıt · ort. çap ${(p.dbh/p.n).toFixed(1)} cm · ort. boy ${(p.h/p.n).toFixed(1)} m</div>
   </div>
   <div style="width:120px;background:var(--line);border-radius:4px;height:8px;overflow:hidden;flex:0 0 auto"><div style="height:100%;width:${(p.c/max*100).toFixed(0)}%;background:var(--green)"></div></div>
   <div class="mono" style="width:70px;text-align:right;font-weight:600;flex:0 0 auto">${(p.c/1000).toFixed(2)} t</div>
  </div>`).join(""):'<div style="color:var(--mut);font-size:.85rem">Henüz onaylı kayıt yok.</div>';
 const rep=$("repProject");
 if(rep)rep.innerHTML=list.map(p=>`<option>${esc(p.name)}</option>`).join("")||'<option value="">—</option>';
}
function parkReport(){
 const name=$("repProject").value;
 const rows=PARK_DATA.filter(r=>(r.projects?.name||"—")===name);
 if(!rows.length)return toast("Bu park için onaylı kayıt yok.");
 const n=rows.length;
 const c=rows.reduce((a,r)=>a+(r.carbon_kg||0),0);
 const dbh=(rows.reduce((a,r)=>a+(r.dbh_cm||0),0)/n).toFixed(1);
 const h=(rows.reduce((a,r)=>a+(r.height_m||0),0)/n).toFixed(1);
 const ib=rows.filter(r=>r.grp==="İBRELİ").length, ya=rows.filter(r=>r.grp==="YAPRAKLI").length;
 const pct=x=>n?((x/n)*100).toFixed(1):"0";
 const bySp={};
 rows.forEach(r=>{const s=bySp[r.species]=bySp[r.species]||{n:0,c:0,dbh:0,h:0,grp:r.grp||"DİĞER"};s.n++;s.c+=(r.carbon_kg||0);s.dbh+=(r.dbh_cm||0);s.h+=(r.height_m||0);});
 const spRows=Object.entries(bySp).sort((a,b)=>b[1].c-a[1].c);
 const html=`
  <div class="grid g4" style="margin-bottom:14px">
   <div class="stat" style="padding:12px"><div class="lbl">Kayıt</div><div class="val" style="font-size:1.1rem">${n}</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Karbon</div><div class="val" style="font-size:1.1rem">${(c/1000).toFixed(2)} t</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Ort. Çap</div><div class="val" style="font-size:1.1rem">${dbh} cm</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Ort. Boy</div><div class="val" style="font-size:1.1rem">${h} m</div></div>
  </div>
  <div style="font-size:.78rem;color:var(--mut);margin-bottom:12px">🌲 İbreli %${pct(ib)} · 🍃 Yapraklı %${pct(ya)} · Diğer %${pct(n-ib-ya)} · ${new Date().toLocaleDateString("tr-TR")}</div>
  <table><thead><tr><th>Tür</th><th>Latince</th><th>Grup</th><th>Adet</th><th>Karbon (kg)</th><th>Ort. Çap</th><th>Ort. Boy</th></tr></thead><tbody>
  ${spRows.map(([sp,v])=>`<tr><td>${sp}</td><td style="font-style:italic">${LATIN[sp]&&LATIN[sp]!=="—"?LATIN[sp]:"—"}</td><td>${v.grp}</td><td>${v.n}</td><td>${v.c.toFixed(1)}</td><td>${(v.dbh/v.n).toFixed(1)}</td><td>${(v.h/v.n).toFixed(1)}</td></tr>`).join("")}
  </tbody></table>`;
 const csv="\uFEFF"+["PARK,\""+name.replace(/"/g,'""')+"\"","SEHIR,"+(rows[0].projects?.city||"—"),"TARIH,"+new Date().toLocaleDateString("tr-TR"),"KAYIT,"+n,"TOPLAM_KARBON_KG,"+c.toFixed(1),"TOPLAM_KARBON_T,"+(c/1000).toFixed(2),"ORT_CAP_CM,"+dbh,"ORT_BOY_M,"+h,"IBRELI_%,"+pct(ib),"YAPRAKLI_%,"+pct(ya),"TUR,LATIN,GRUP,ADET,KARBON_KG,ORT_CAP_CM,ORT_BOY_M"].concat(spRows.map(([sp,v])=>[sp,LATIN[sp]||"—",v.grp,v.n,v.c.toFixed(1),(v.dbh/v.n).toFixed(1),(v.h/v.n).toFixed(1)].join(","))).join("\n")+"\n";
 $("pvTitle").textContent="📄 "+name+" — Park Raporu";
 $("pvBody").innerHTML=html;
 $("pvDownload").onclick=()=>dl(csv,name.replace(/\s+/g,"_")+"_rapor.csv");
 $("previewModal").classList.add("on");
}
/* Click-to-zoom */
async function zoomToCountry(country){
const m=worldMapL||worldMap;if(!m)return;
const{data}=await sb.from("measurements").select("lat,lon").eq("status","Onaylı").eq("country",country).limit(2000);
fitRows(m,data,country,"🌍");
}
async function zoomToCity(city){
const m=worldMapL||worldMap;if(!m)return;
const{data}=await sb.from("measurements").select("lat,lon").eq("status","Onaylı").eq("city",city).limit(2000);
fitRows(m,data,city,"🏙");
}
function fitRows(m,rows,label,icon){
const pts=(rows||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
if(!pts.length)return toast(label+" için onaylı nokta yok","warn",icon);
const b=L.latLngBounds(pts.map(r=>[+r.lat,+r.lon]));
m.fitBounds(b.pad(0.25),{maxZoom:12});
toast(label+" haritada","info",icon);
}
