"use strict";
/* DendroGeo · services/admin-tree.js — PARK → PROJE → KULLANICI → ÖLÇÜM AĞACI
 *
 * NEDEN VAR (kullanıcı isteği 2026-09-24):
 *   "Tüm verileri görmek istiyorum: onaylı, reddedilmiş, proje ve park
 *    bazında. Park görülsün; parkı açınca projeler açılsın; projeyi açınca
 *    kullanıcıları ve verilerini göreyim."
 *
 * Eski yönetim listesi DÜZ bir tabloydu (kullanıcı × ölçüm) ve üç zayıflığı
 * vardı:
 *   1) Park/proje hiyerarşisi yoktu → kim hangi parkta çalışmış görünmüyordu.
 *   2) Yalnız ilk 300 satırı basıyordu.
 *   3) Sorgu HATA verirse sessizce "Kayıt yok." yazıyordu — veri yok sanılırdı.
 *      (Bu, şema değişikliğinden sonra tam olarak yaşandı: embed hatası
 *       kullanıcıya "kayıtlar silinmiş" gibi göründü.)
 *
 * Bu modül üçünü de kapatır: veriyi park→proje→kullanıcı ağacına dizer,
 * <details> ile kademeli açılır, filtrelenir ve SORGU HATASINI EKRANA YAZAR
 * (yedek sorgu zinciriyle birlikte: tam embed → gömüsüz + istemci tarafı join).
 *
 * Bağımlılıklar (çağrı anında global): sb, PROFILE, $, esc, toast, LATIN,
 * dgWarnIfTruncated, approveMeas/rejectMeas/delMeas (admin.js).
 * YÜKLEME SIRASI: yönetim zincirinin SONUNDA (admin.js'in approve/reject/del
 * fonksiyonlarını çağırır; onlar da yüklenince loadAdminTree'yi tetikler). */

/* Filtre + açık düğüm durumu (yeniden çizimde korunsun) */
let DG_TREE_STATUS="";
let DG_TREE_QUERY="";
const DG_TREE_OPEN=new Set();

/* Ağaç için çekilen ham satırlar (dışa aktarım/denetim için de tutulur) */
let DG_TREE_ROWS=[];
let DG_TREE_ERR=null;

/* =========================================================
   1. VERİ ÇEKME (yedek zincir + hata görünürlüğü)
========================================================= */

const DG_TREE_SEL_FULL=
  "id,point_id,measurement_no,species,grp,dbh_cm,height_m,carbon_kg,"+
  "status,photo_url,created_at,lat,lon,owner,project_id,park_id,"+
  "profiles(full_name),"+
  "projects(id,name,park_id,park_name,parks(id,name,area_m2,city,country))";

/* Kademeli yedek: şema eskiyse (0004 yok) veya PostgREST şema önbelleği
 * bayatsa tam embed hata verir. O zaman gömüsüz çekip istemcide birleştiririz
 * — kullanıcı hiçbir koşulda "veri yok" ile baş başa kalmaz. */
async function dgTreeFetch(){
  const base=()=>sb.from("measurements")
    .order("created_at",{ascending:false});

  /* 1) tam embed */
  let r=await base().select(DG_TREE_SEL_FULL,{count:"exact"}).limit(1000);
  if(!r.error){
    dgWarnIfTruncated(r.data,1000,"Yönetim ağacı",r.count);
    return{rows:r.data||[],count:r.count,mode:"embed",error:null};
  }
  const firstErr=r.error;

  /* 2) gömüsüz + ayrı tablolar (istemci tarafı join) */
  const[mm,pp,uu]=await Promise.all([
    sb.from("measurements").select("*").order("created_at",{ascending:false}).limit(1000),
    sb.from("projects").select("*,parks(id,name,area_m2,city,country)").limit(1000),
    sb.from("profiles").select("id,full_name,email").limit(1000)
  ]);

  if(!mm.error){
    dgWarnIfTruncated(mm.data,1000,"Yönetim ağacı",null);
    const projById=new Map((pp.data||[]).map(p=>[p.id,p]));
    const userById=new Map((uu.data||[]).map(u=>[u.id,u]));
    const rows=(mm.data||[]).map(m=>({
      ...m,
      profiles:userById.get(m.owner)||null,
      projects:projById.get(m.project_id)||null
    }));
    return{rows,count:rows.length,mode:"join",
      error:firstErr?("embed hatası, yedek join kullanıldı: "+firstErr.message):null};
  }

  /* 3) ikisi de olmadı → hatayı olduğu gibi bildir */
  return{rows:[],count:0,mode:"fail",
    error:(firstErr&&firstErr.message)+" | yedek: "+(mm.error&&mm.error.message)};
}

/* =========================================================
   2. SAF GRUPLAMA (birim testlenebilir — DOM yok)
========================================================= */

/* Satırları park → proje → kullanıcı ağacına dizer.
 * Parkı olmayan kayıtlar TEK "Park algılanmamış" düğümünde toplanır
 * (karşılaştırma sayfasındaki park_pending mantığıyla aynı).
 * Sıralama: her seviyede karbon azalan. */
function dgTreeGroup(rows){
  const parks=new Map();

  (rows||[]).forEach(r=>{
    const proj=r.projects||null;
    const park=proj&&proj.parks?proj.parks:null;
    const parkId=park&&park.id?park.id:(r.park_id||0);

    const pKey=parkId?("p"+parkId):"p0";
    if(!parks.has(pKey)){
      parks.set(pKey,{
        key:pKey,
        park_id:parkId||0,
        name:park?(park.name||"İsimsiz park"):(parkId?("Park #"+parkId):"⚠ Park algılanmamış"),
        pending:!parkId,
        area_m2:park&&park.area_m2?park.area_m2:null,
        city:(park&&park.city)||(proj&&proj.city)||"",
        projects:new Map(),
        n:0,c:0
      });
    }
    const P=parks.get(pKey);

    const jKey="j"+(proj&&proj.id?proj.id:("x"+(r.project_id||0)));
    if(!P.projects.has(jKey)){
      P.projects.set(jKey,{
        key:jKey,
        project_id:(proj&&proj.id)||r.project_id||0,
        name:(proj&&proj.name)||("Proje #"+(r.project_id||0)),
        park_name:(proj&&proj.park_name)||null,
        users:new Map(),
        n:0,c:0
      });
    }
    const J=P.projects.get(jKey);

    const uKey="u"+(r.owner||"bilinmeyen");
    if(!J.users.has(uKey)){
      const pr=r.profiles||null;
      J.users.set(uKey,{
        key:uKey,
        owner:r.owner||null,
        name:(pr&&pr.full_name)||(pr&&pr.email)||"Bilinmeyen kullanıcı",
        rows:[],
        n:0,c:0,
        onayli:0,beklemede:0,red:0
      });
    }
    const U=J.users.get(uKey);

    const carbon=Number(r.carbon_kg)||0;
    U.rows.push(r);U.n++;U.c+=carbon;
    const st=r.status||"Beklemede";
    if(st==="Onaylı")U.onayli++;else if(st==="Red")U.red++;else U.beklemede++;
    J.n++;J.c+=carbon;
    P.n++;P.c+=carbon;
  });

  const out=[...parks.values()].map(P=>{
    P.projects=[...P.projects.values()].map(J=>{
      J.users=[...J.users.values()].sort((a,b)=>b.c-a.c||b.n-a.n);
      return J;
    }).sort((a,b)=>b.c-a.c||b.n-a.n);
    return P;
  });

  /* Parkı olmayan düğüm en alta, diğerleri karbona göre */
  return out.sort((a,b)=>(a.pending-b.pending)||(b.c-a.c)||(b.n-a.n));
}

/* Filtre: durum + serbest metin (kullanıcı, tür, proje, nokta) */
function dgTreeFilterRows(rows,status,query){
  const q=String(query||"").trim().toLocaleLowerCase("tr");
  return (rows||[]).filter(r=>{
    if(status&&(r.status||"Beklemede")!==status)return false;
    if(!q)return true;
    const proj=r.projects&&r.projects.name?r.projects.name:"";
    const park=(r.projects&&r.projects.parks&&r.projects.parks.name)||(r.projects&&r.projects.park_name)||"";
    const user=r.profiles&&r.profiles.full_name?r.profiles.full_name:"";
    return (proj+" "+park+" "+user+" "+(r.species||"")+" "+(r.point_id||"")+" "+(r.city||""))
      .toLocaleLowerCase("tr").includes(q);
  });
}

/* =========================================================
   3. ÇİZİM
========================================================= */

const dgTon=kg=>(Number(kg||0)/1000).toFixed(2)+" t";
const dgBadge=st=>{
  const bc=st==="Onaylı"?"on":(st==="Red"?"off":"admin");
  const tx=st==="Beklemede"?"Onay Bekliyor":st;
  return `<span class="badge ${bc}">${esc(tx)}</span>`;
};

function dgTreeRowHTML(r){
  const st=r.status||"Beklemede";
  const act=st==="Onaylı"
    ? `<button class="btn sm red" onclick="rejectMeas(${r.id})">🚫 Reddet</button>`
    : `<button class="btn sm" onclick="approveMeas(${r.id})">✓ Onayla</button>`;
  const d=r.created_at?new Date(r.created_at):null;
  return `<tr>`+
    `<td><b>P${esc(r.point_id)}</b>${r.measurement_no>1?`<span class="mono" style="font-size:.68rem"> /M${r.measurement_no}</span>`:""}</td>`+
    `<td>${esc(r.species||"—")}<br><span class="mono" style="font-size:.66rem;color:var(--mut)">${esc((typeof LATIN!=="undefined"&&LATIN[r.species])||"")}</span></td>`+
    `<td>${esc(r.grp||"—")}</td>`+
    `<td>${r.dbh_cm??"—"}</td>`+
    `<td>${r.height_m??"—"}</td>`+
    `<td><b>${(Number(r.carbon_kg)||0).toFixed(1)}</b></td>`+
    `<td>${r.photo_url?`<a href="${esc(r.photo_url)}" target="_blank" rel="noopener">📷</a>`:"—"}</td>`+
    `<td>${dgBadge(st)}</td>`+
    `<td class="mono" style="font-size:.68rem">${d?d.toLocaleDateString("tr-TR"):"—"}</td>`+
    `<td style="display:flex;gap:4px">${act}<button class="btn sm red" onclick="delMeas(${r.id})">🗑️</button></td>`+
  `</tr>`;
}

function dgTreeUserHTML(U){
  const open=DG_TREE_OPEN.has(U.key)?" open":"";
  return `<details class="dg-tree-user"${open} ontoggle="dgTreeToggle('${U.key}',this.open)">`+
    `<summary>👤 <b>${esc(U.name)}</b>`+
      `<span class="dg-tree-meta">${U.n} kayıt · ${dgTon(U.c)}`+
      `${U.onayli?` · <span style="color:var(--green)">✓${U.onayli}</span>`:""}`+
      `${U.beklemede?` · <span style="color:#b45309">⏳${U.beklemede}</span>`:""}`+
      `${U.red?` · <span style="color:var(--red)">🚫${U.red}</span>`:""}</span>`+
    `</summary>`+
    `<div class="dg-tree-body tblwrap"><table>`+
      `<thead><tr><th>Nokta</th><th>Tür</th><th>Grup</th><th>Çap</th><th>Boy</th><th>Karbon kg</th><th>Foto</th><th>Durum</th><th>Tarih</th><th>İşlem</th></tr></thead>`+
      `<tbody>${U.rows.map(dgTreeRowHTML).join("")}</tbody>`+
    `</table></div>`+
  `</details>`;
}

function dgTreeProjectHTML(P,J){
  const open=DG_TREE_OPEN.has(J.key)?" open":"";
  return `<details class="dg-tree-proj"${open} ontoggle="dgTreeToggle('${J.key}',this.open)">`+
    `<summary>📁 <b>${esc(J.name)}</b>`+
      `<span class="dg-tree-meta">${J.users.length} kullanıcı · ${J.n} kayıt · ${dgTon(J.c)}</span>`+
    `</summary>`+
    `<div class="dg-tree-body">${J.users.map(U=>dgTreeUserHTML(U)).join("")}</div>`+
  `</details>`;
}

function dgTreeParkHTML(P){
  const open=DG_TREE_OPEN.has(P.key)?" open":"";
  const projN=P.projects.length;
  const userN=P.projects.reduce((a,J)=>a+J.users.length,0);
  const ha=P.area_m2?` · ${dgFmtHa(P.area_m2)}`:"";
  const perHa=P.area_m2?` · ${((P.c/1000)/(P.area_m2/10000)).toFixed(2)} t/ha`:"";
  return `<details class="dg-tree-park${P.pending?" pending":""}"${open} ontoggle="dgTreeToggle('${P.key}',this.open)">`+
    `<summary>${P.pending?"⚠":"🌳"} <b>${esc(P.name)}</b>`+
      `<span class="dg-tree-meta">${esc(P.city||"")}${ha} · ${projN} proje · ${userN} kullanıcı · ${P.n} kayıt · ${dgTon(P.c)}${perHa}</span>`+
      (P.pending?`<button class="btn sm ghost dg-tree-act" onclick="dgTreePendingScan(event)">🌳 Park Algıla</button>`:"")+
    `</summary>`+
    `<div class="dg-tree-body">${P.projects.map(J=>dgTreeProjectHTML(P,J)).join("")}</div>`+
  `</details>`;
}

function dgTreeRender(tree){
  const el=$("adminTree");
  if(!el)return;

  if(DG_TREE_ERR){
    el.innerHTML=
      `<div class="alert err"><b>⚠ Ölçümler okunamadı — veri silinmedi, sorgu hata veriyor.</b>`+
      `<div class="mono" style="font-size:.72rem;margin-top:6px;word-break:break-word">${esc(DG_TREE_ERR)}</div>`+
      `<div style="font-size:.8rem;margin-top:8px">Olası sebepler: (1) şema değişikliğinden sonra PostgREST önbelleği bayat → Supabase'de `+
      `<b>Database → Restart</b> ya da birkaç dakika bekle; (2) 0004 migration'ı eksik; (3) RLS/rol sorunu. `+
      `Hatayı olduğu gibi paylaşman yeterli.</div>`+
      `<button class="btn sm blue" style="margin-top:10px" onclick="loadAdminTree()">🔄 Yeniden dene</button></div>`;
    return;
  }

  if(!tree.length){
    el.innerHTML=`<div class="alert info">Bu filtreye uyan kayıt yok. `+
      `(Toplam ${DG_TREE_ROWS.length} kayıt çekildi${DG_TREE_STATUS?" · durum: "+esc(DG_TREE_STATUS):""}${DG_TREE_QUERY?" · arama: "+esc(DG_TREE_QUERY):""})</div>`;
    return;
  }

  const parkN=tree.filter(P=>!P.pending).length;
  const projN=tree.reduce((a,P)=>a+P.projects.length,0);
  const recN=tree.reduce((a,P)=>a+P.n,0);
  const carb=tree.reduce((a,P)=>a+P.c,0);

  el.innerHTML=
    `<div class="dg-tree-sum mono">🌳 ${parkN} park · 📁 ${projN} proje · 📋 ${recN} kayıt · ⚖ ${dgTon(carb)}`+
    ` <button class="btn sm ghost dg-tree-act" onclick="dgTreeExpand(true)">Tümünü aç</button>`+
    ` <button class="btn sm ghost dg-tree-act" onclick="dgTreeExpand(false)">Tümünü kapat</button></div>`+
    tree.map(dgTreeParkHTML).join("");
}

/* =========================================================
   4. GİRİŞ NOKTALARI
========================================================= */

async function loadAdminTree(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner"))return;
  const box=$("adminTree");
  if(box)box.innerHTML=`<div class="alert info">⏳ Ölçümler yükleniyor…</div>`;

  const res=await dgTreeFetch();
  DG_TREE_ROWS=res.rows||[];
  DG_TREE_ERR=res.error&&(res.rows&&res.rows.length)?null:res.error;

  if(res.mode!=="embed"&&res.error&&res.rows&&res.rows.length){
    toast("⚠ Gömülü sorgu başarısız, yedek birleştirme kullanıldı: "+esc(res.error),"warn","🌳");
  }

  dgTreeDraw();
}

/* Filtrelenmiş ağacı çiz (veri zaten DG_TREE_ROWS'ta) */
function dgTreeDraw(){
  const rows=dgTreeFilterRows(DG_TREE_ROWS,DG_TREE_STATUS,DG_TREE_QUERY);
  dgTreeRender(dgTreeGroup(rows));
}

function dgTreeSetStatus(v){
  DG_TREE_STATUS=v||"";
  dgTreeDraw();
}

function dgTreeSetQuery(v){
  DG_TREE_QUERY=v||"";
  dgTreeDraw();
}

function dgTreeToggle(key,open){
  if(open)DG_TREE_OPEN.add(key);else DG_TREE_OPEN.delete(key);
}

/* "⚠ Park algılanmamış" düğümündeki kısayol: park algılama ekranına gider.
 * event.preventDefault/stopPropagation şart — yoksa buton <summary> içinde
 * olduğu için düğümü de açar/kapatır. */
function dgTreePendingScan(ev){
  if(ev&&ev.preventDefault){ev.preventDefault();ev.stopPropagation();}
  if(typeof startParkScan==="function")startParkScan({returnTo:"admin"});
}

function dgTreeExpand(open){
  const rows=dgTreeFilterRows(DG_TREE_ROWS,DG_TREE_STATUS,DG_TREE_QUERY);
  const tree=dgTreeGroup(rows);
  DG_TREE_OPEN.clear();
  if(open){
    tree.forEach(P=>{
      DG_TREE_OPEN.add(P.key);
      P.projects.forEach(J=>{
        DG_TREE_OPEN.add(J.key);
        J.users.forEach(U=>DG_TREE_OPEN.add(U.key));
      });
    });
  }
  dgTreeRender(tree);
}

window.loadAdminTree=loadAdminTree;
window.dgTreeSetStatus=dgTreeSetStatus;
window.dgTreeSetQuery=dgTreeSetQuery;
window.dgTreeToggle=dgTreeToggle;
window.dgTreeExpand=dgTreeExpand;
window.dgTreePendingScan=dgTreePendingScan;
