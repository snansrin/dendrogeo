"use strict";
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

const PARK_RPT_FIELDS="carbon_kg,dbh_cm,height_m,species,grp,point_id,projects(name,city,park_id,park_name)";

async function loadParkCompare(){
 const el=$("parkCompare");
 const{data,error}=await sb.from("v_park_compare").select("*").order("carbon_kg",{ascending:false});

 /* Şema eski (0004 çalıştırılmamış) → sayfa boş kalmasın diye proje bazlı
  * eski toplama yedek olarak çalışır ve kullanıcıyı migration'a yönlendirir. */
 if(error){
  dgParkSchemaMissing("v_park_compare: "+error.message);
  return loadParkCompareLegacy(el);
 }

 PARK_ROWS=data||[];
 const linked=PARK_ROWS.filter(r=>Number(r.park_id)>0);
 const pending=PARK_ROWS.filter(r=>!(Number(r.park_id)>0));
 const max=linked.length?Math.max(...linked.map(r=>Number(r.carbon_kg)||0)):1;

 if(!el)return;

 el.innerHTML=
  (linked.length?linked.map((p,i)=>dgParkRowHTML(p,i,max)).join("")
   :'<div style="color:var(--mut);font-size:.85rem">Henüz park kimliğine bağlı onaylı kayıt yok. Ölçüm girmeden önce park algıla: Canlı Harita → 🌳 Park Algılama.</div>')
  +dgPendingParksHTML(pending);

 dgFillReportOptions(linked,pending);
}

function dgParkRowHTML(p,i,max){
 const n=Number(p.records)||0;
 const kg=Number(p.carbon_kg)||0;
 const area=Number(p.area_m2)||0;
 const perHa=area>0?(kg/1000)/(area/10000):null;
 const badge=i===0?'<span class="badge on">🏆 En İyi</span>':"";
 return `
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:8px 12px;background:var(--bg);border-radius:10px">
   <div class="mono" style="width:26px;height:26px;border-radius:50%;background:${i===0?"var(--green)":"var(--line)"};color:${i===0?"#fff":"var(--mut)"};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;flex:0 0 auto">${i+1}</div>
   <div style="flex:1;min-width:0">
    <div style="font-size:.85rem;font-weight:700">🌳 ${esc(p.park_name)} ${badge}</div>
    <div style="font-size:.7rem;color:var(--mut)">${esc(p.city||"—")} · 👥 ${p.contributors||0} kişi · 📁 ${p.projects||0} proje · ${n} kayıt${p.species_n?` · ${p.species_n} tür`:""} · ort. çap ${(Number(p.avg_dbh)||0).toFixed(1)} cm · ort. boy ${(Number(p.avg_height)||0).toFixed(1)} m${area>0?` · ${dgFmtHa(area)}`:""}</div>
   </div>
   <div style="width:120px;background:var(--line);border-radius:4px;height:8px;overflow:hidden;flex:0 0 auto"><div style="height:100%;width:${max>0?(kg/max*100).toFixed(0):0}%;background:var(--green)"></div></div>
   <div class="mono" style="width:96px;text-align:right;font-weight:600;flex:0 0 auto">${(kg/1000).toFixed(2)} t${perHa!==null?`<br><span style="font-weight:400;font-size:.66rem;color:var(--mut)">${perHa.toFixed(2)} t/ha</span>`:""}</div>
  </div>`;
}

function dgPendingParksHTML(pending){
 if(!pending||!pending.length)return "";
 const n=pending.reduce((a,r)=>a+(Number(r.records)||0),0);
 return `
  <div style="margin-top:16px;border-top:1px dashed var(--line);padding-top:12px">
   <div class="lbl" style="margin-bottom:8px">⚠ PARK ALGILANMAMIŞ KAYITLAR <span style="text-transform:none;letter-spacing:0;font-weight:400">(sıralamaya dahil değil · ${n} kayıt)</span></div>
   ${pending.map(p=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:6px 10px;background:var(--bg);border-radius:8px;opacity:.85">
     <div style="flex:1;min-width:0;font-size:.78rem">${esc(p.park_name)} <span class="badge off">park yok</span>
      <div style="font-size:.68rem;color:var(--mut)">${esc(p.city||"—")} · ${p.records} kayıt · ${(Number(p.carbon_kg)/1000).toFixed(2)} t</div>
     </div>
     <button class="btn sm ghost" onclick="startParkScan({returnTo:'world'})">🌳 Park Algıla</button>
    </div>`).join("")}
   <div style="font-size:.7rem;color:var(--mut);margin-top:6px">Bu kayıtlar park kimliği oluşturulmadan önce girilmiş. Yönetici <b>🌳 Parkları Geri Doldur</b> aracıyla ölçüm merkezinden otomatik eşleştirebilir.</div>
  </div>`;
}

function dgFillReportOptions(linked,pending){
 const rep=$("repProject");
 if(!rep)return;
 const opt=(v,label)=>`<option value="${esc(v)}">${esc(label)}</option>`;
 rep.innerHTML=
  (linked||[]).map(p=>opt(String(p.park_id),"🌳 "+p.park_name)).join("")
  +(pending||[]).map(p=>opt("proj:"+p.park_name,"⚠ "+p.park_name+" (park yok)")).join("")
  ||'<option value="">—</option>';
}

/* Şema eskiyse (migration 0004 uygulanmamış) karşılaştırma proje bazlı eski
 * davranışa düşer — sayfa boş kalmasın, ama kullanıcı sebebini bilsin. */
async function loadParkCompareLegacy(el){
 const{data,count}=await sb.from("measurements").select("carbon_kg,dbh_cm,height_m,species,grp,projects(name,city)",{count:"exact"}).eq("status","Onaylı").limit(5000);
 dgWarnIfTruncated(data,5000,"Park karşılaştırma",count);
 PARK_DATA=data||[];
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
    <div style="font-size:.7rem;color:var(--mut)">${esc(p.city)} · ${p.n} kayıt · ort. çap ${(p.dbh/p.n).toFixed(1)} cm · ort. boy ${(p.h/p.n).toFixed(1)} m</div>
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
 if(!key)return toast("Park seç","err");
 const row=(PARK_ROWS||[]).find(r=>String(r.park_id)===String(key));
 const isPark=!!row&&Number(row.park_id)>0;
 const name=isPark?row.park_name:String(key).replace(/^proj:/,"");

 /* !inner zorunlu: PostgREST gömülü kaynakta filtre ancak inner join ile
  * çalışır (yoksa park filtresi eşleşmeyen satırlar da gelir). */
 const sel=PARK_RPT_FIELDS.replace("projects(","projects!inner(");
 let q=sb.from("measurements").select(sel).eq("status","Onaylı");
 q=isPark?q.eq("projects.park_id",row.park_id):q.eq("projects.name",name);
 const{data,count,error}=await q.limit(5000);

 if(error){
  /* Şema eski: park_id sütunu yok → ada göre dene */
  const fb=await sb.from("measurements").select("carbon_kg,dbh_cm,height_m,species,grp,point_id,projects(name,city)").eq("status","Onaylı").eq("projects.name",name).limit(5000);
  if(fb.error)return toast("Rapor alınamadı: "+esc(fb.error.message),"err");
  return dgRenderParkReport(name,fb.data||[],fb.count,null);
 }
 dgWarnIfTruncated(data,5000,name+" (park raporu)",count);
 dgRenderParkReport(name,data||[],count,row);
}

function dgRenderParkReport(name,rows,count,row){
 PARK_DATA=rows;
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
 const projNames=[...new Set(rows.map(r=>r.projects?.name).filter(Boolean))];
 const area=row&&Number(row.area_m2)>0?Number(row.area_m2):null;
 const perHa=area?(c/1000)/(area/10000):null;
 const html=`
  <div class="alert info" style="margin-bottom:12px">🌳 <b>${esc(name)}</b> · 👥 ${row&&row.contributors?row.contributors+" kişi":projNames.length+" proje"} · 📁 ${projNames.length} proje · ${count!=null?count+" onaylı kayıt (raporda "+n+")":n+" kayıt"}</div>
  <div class="grid g4" style="margin-bottom:14px">
   <div class="stat" style="padding:12px"><div class="lbl">Kayıt</div><div class="val" style="font-size:1.1rem">${n}</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Karbon</div><div class="val" style="font-size:1.1rem">${(c/1000).toFixed(2)} t</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Ort. Çap</div><div class="val" style="font-size:1.1rem">${dbh} cm</div></div>
   <div class="stat" style="padding:12px"><div class="lbl">Ort. Boy</div><div class="val" style="font-size:1.1rem">${h} m</div></div>
  </div>
  <div style="font-size:.78rem;color:var(--mut);margin-bottom:12px">🌲 İbreli %${pct(ib)} · 🍃 Yapraklı %${pct(ya)} · Diğer %${pct(n-ib-ya)}${area?` · alan ${dgFmtHa(area)}${perHa!==null?` · <b>${perHa.toFixed(2)} t/ha</b>`:""}`:""} · ${new Date().toLocaleDateString("tr-TR")}</div>
  ${projNames.length>1?`<div style="font-size:.74rem;color:var(--mut);margin-bottom:10px">Bu parkta birleşen projeler: ${projNames.map(esc).join(" · ")}</div>`:""}
  <table><thead><tr><th>Tür</th><th>Latince</th><th>Grup</th><th>Adet</th><th>Karbon (kg)</th><th>Ort. Çap</th><th>Ort. Boy</th></tr></thead><tbody>
  ${spRows.map(([sp,v])=>`<tr><td>${sp}</td><td style="font-style:italic">${LATIN[sp]&&LATIN[sp]!=="—"?LATIN[sp]:"—"}</td><td>${v.grp}</td><td>${v.n}</td><td>${v.c.toFixed(1)}</td><td>${(v.dbh/v.n).toFixed(1)}</td><td>${(v.h/v.n).toFixed(1)}</td></tr>`).join("")}
  </tbody></table>`;
 const csv="\uFEFF"+["PARK,\""+name.replace(/"/g,'""')+"\"",
  "PARK_ID,"+(row&&row.park_id?row.park_id:""),
  "SEHIR,"+(rows[0].projects?.city||row&&row.city||"—"),
  "ALAN_M2,"+(area||""),
  "KARBON_T_HA,"+(perHa!==null?perHa.toFixed(3):""),
  "PROJELER,\""+projNames.join(" | ").replace(/"/g,'""')+"\"",
  "TARIH,"+new Date().toLocaleDateString("tr-TR"),
  "KAYIT,"+n,
  "TOPLAM_KARBON_KG,"+c.toFixed(1),"TOPLAM_KARBON_T,"+(c/1000).toFixed(2),
  "ORT_CAP_CM,"+dbh,"ORT_BOY_M,"+h,"IBRELI_%,"+pct(ib),"YAPRAKLI_%,"+pct(ya),
  "TUR,LATIN,GRUP,ADET,KARBON_KG,ORT_CAP_CM,ORT_BOY_M"]
  .concat(spRows.map(([sp,v])=>[sp,LATIN[sp]||"—",v.grp,v.n,v.c.toFixed(1),(v.dbh/v.n).toFixed(1),(v.h/v.n).toFixed(1)].join(","))).join("\n")+"\n";
 $("pvTitle").textContent="📄 "+name+" — Park Raporu";
 $("pvBody").innerHTML=html;
 $("pvDownload").onclick=()=>dl(csv,name.replace(/\s+/g,"_")+"_rapor.csv");
 $("previewModal").classList.add("on");
}
/* Click-to-zoom */
async function zoomToCountry(country){
const m=worldMapL||worldMap;if(!m)return;
const{data,count}=await sb.from("measurements").select("lat,lon",{count:"exact"}).eq("status","Onaylı").eq("country",country).limit(2000);
dgWarnIfTruncated(data,2000,country+" (ülke yakınlaşma)",count);
fitRows(m,data,country,"🌍");
}
async function zoomToCity(city){
const m=worldMapL||worldMap;if(!m)return;
const{data,count}=await sb.from("measurements").select("lat,lon",{count:"exact"}).eq("status","Onaylı").eq("city",city).limit(2000);
dgWarnIfTruncated(data,2000,city+" (şehir yakınlaşma)",count);
fitRows(m,data,city,"🏙");
}
function fitRows(m,rows,label,icon){
const pts=(rows||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
if(!pts.length)return toast(label+" için onaylı nokta yok","warn",icon);
const b=L.latLngBounds(pts.map(r=>[+r.lat,+r.lon]));
m.fitBounds(b.pad(0.25),{maxZoom:12});
toast(label+" haritada","info",icon);
}
