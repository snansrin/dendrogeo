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

/* ⚠ profiles gömüsü FK adıyla BELİRTİLMELİ: 0003 measurements'a reviewed_by
 * eklediği için profiles'a iki ilişki var (owner + reviewed_by). Çıplak
 * "profiles(...)" → PGRST201 "more than one relationship" → satır gelmez.
 * (Canlıda 2026-09-24'te tam olarak bu yaşandı; test/critical-fixes kilitler.) */
const DG_TREE_SEL_FULL=
  "id,point_id,measurement_no,species,grp,dbh_cm,height_m,carbon_kg,"+
  "status,photo_url,created_at,lat,lon,owner,project_id,park_id,"+
  "reviewed_by,reviewed_at,"+
  "profiles!measurements_owner_fkey(full_name),"+
  "projects(id,name,park_id,park_name,parks(id,name,area_m2,city,country))";

/* Kademeli yedek: şema eskiyse (0004 yok) veya PostgREST şema önbelleği
 * bayatsa tam embed hata verir. O zaman gömüsüz çekip istemcide birleştiririz
 * — kullanıcı hiçbir koşulda "veri yok" ile baş başa kalmaz. */
async function dgTreeFetch(){
  /* ⚠ ZİNCİR SIRASI (canlıda 2026-09-24'te kutu "⏳ yükleniyor"da asılı kaldı):
   * supabase-js'te `from()` yalnız select/insert/update/delete/upsert verir;
   * order/limit/eq FİLTRE kurucusundadır ve ancak select()'ten sonra gelir.
   * `sb.from(t).order(...)` → TypeError: order is not a function → await
   * reddedilir → ekran sonsuza dek "yükleniyor"da kalırdı. Depodaki tüm diğer
   * çağrılar .select(...).order(...) sırasını kullanır; burası istisnaydı. */
  /* 1) tam embed */
  let r=await sb.from("measurements")
    .select(DG_TREE_SEL_FULL,{count:"exact"})
    .order("created_at",{ascending:false})
    .limit(1000);
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
        n:0,c:0,beklemede:0,onayli:0,red:0
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
        n:0,c:0,beklemede:0,onayli:0,red:0
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
    /* Durum sayaçları her seviyede tutulur: onay ekranında "hangi parkta /
     * projede / kimde onay bekliyor" rozetleri bunlardan çizilir. */
    if(st==="Onaylı"){U.onayli++;J.onayli++;P.onayli++;}
    else if(st==="Red"){U.red++;J.red++;P.red++;}
    else{U.beklemede++;J.beklemede++;P.beklemede++;}
    J.n++;J.c+=carbon;
    P.n++;P.c+=carbon;
  });

  const out=[...parks.values()].map(P=>{
    P.projects=[...P.projects.values()].map(J=>{
      J.users=[...J.users.values()].sort((a,b)=>(b.beklemede-a.beklemede)||(b.c-a.c)||(b.n-a.n));
      return J;
    }).sort((a,b)=>(b.beklemede-a.beklemede)||(b.c-a.c)||(b.n-a.n));
    return P;
  });

  /* Parkı olmayan düğüm en alta; onun dışında ONAY BEKLEYEN önce, sonra karbon.
   * Sebep: bu ekran bir onay kuyruğu — iş bekleyen yer en üstte olmalı. */
  return out.sort((a,b)=>(a.pending-b.pending)||(b.beklemede-a.beklemede)||(b.c-a.c)||(b.n-a.n));
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

/* Onay bekleyen rozeti: 🔴 + sayı. Sıfırsa hiç basılmaz (gürültü olmasın). */
const dgBekRozet=n=>n>0?`<span class="dg-pend" title="${n} kayıt onay bekliyor">🔴 ${n}</span>`:"";
const dgDurumOzet=o=>{
  const p=[];
  if(o.onayli)p.push(`<span class="dg-st-on">✓${o.onayli}</span>`);
  if(o.beklemede)p.push(`<span class="dg-st-wait">⏳${o.beklemede}</span>`);
  if(o.red)p.push(`<span class="dg-st-off">🚫${o.red}</span>`);
  return p.join(" ");
};
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
  /* data-label: 640px altında tablo kart düzenine döner (css/style.css .dg-cards) */
  return `<tr>`+
    `<td data-label="Nokta"><b>P${esc(r.point_id)}</b>${r.measurement_no>1?`<span class="mono dg-sub"> /M${r.measurement_no}</span>`:""}</td>`+
    `<td data-label="Tür">${esc(r.species||"—")}<br><span class="mono dg-sub">${esc((typeof LATIN!=="undefined"&&LATIN[r.species])||"")}</span></td>`+
    `<td data-label="Grup">${esc(r.grp||"—")}</td>`+
    `<td data-label="Çap">${r.dbh_cm??"—"}</td>`+
    `<td data-label="Boy">${r.height_m??"—"}</td>`+
    `<td data-label="Karbon kg"><b>${(Number(r.carbon_kg)||0).toFixed(1)}</b></td>`+
    `<td data-label="Foto">${dgThumb(r.photo_url)}</td>`+
    `<td data-label="Durum">${dgBadge(st)}</td>`+
    `<td data-label="Tarih" class="mono dg-sub">${d?d.toLocaleDateString("tr-TR"):"—"}</td>`+
    `<td data-label="İşlem"><div class="dg-act">${act}<button class="btn sm red" onclick="delMeas(${r.id})">🗑️</button></div></td>`+
  `</tr>`;
}

function dgTreeUserHTML(U){
  const open=DG_TREE_OPEN.has(U.key)?" open":"";
  return `<details class="dg-tree-user"${open} ontoggle="dgTreeToggle('${U.key}',this.open)">`+
    `<summary>👤 <b>${esc(U.name)}</b>`+
      dgBekRozet(U.beklemede)+
      `<span class="dg-tree-meta">${U.n} kayıt · ${dgTon(U.c)} · ${dgDurumOzet(U)}</span>`+
    `</summary>`+
    `<div class="dg-tree-body tblwrap"><table class="dg-cards">`+
      `<thead><tr><th>Nokta</th><th>Tür</th><th>Grup</th><th>Çap</th><th>Boy</th><th>Karbon kg</th><th>Foto</th><th>Durum</th><th>Tarih</th><th>İşlem</th></tr></thead>`+
      `<tbody>${U.rows.map(dgTreeRowHTML).join("")}</tbody>`+
    `</table></div>`+
  `</details>`;
}

function dgTreeProjectHTML(P,J){
  const open=DG_TREE_OPEN.has(J.key)?" open":"";
  return `<details class="dg-tree-proj"${open} ontoggle="dgTreeToggle('${J.key}',this.open)">`+
    `<summary>📁 <b>${esc(J.name)}</b>`+
      dgBekRozet(J.beklemede)+
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
      dgBekRozet(P.beklemede)+
      `<span class="dg-tree-meta">${esc(P.city||"")}${ha} · ${projN} proje · ${userN} kullanıcı · ${P.n} kayıt · ${dgTon(P.c)}${perHa}</span>`+
      (P.pending?`<button class="btn sm ghost dg-tree-act" onclick="dgTreePendingScan(event)">🌳 Park Algıla</button>`:"")+
    `</summary>`+
    `<div class="dg-tree-body">${P.projects.map(J=>dgTreeProjectHTML(P,J)).join("")}</div>`+
  `</details>`;
}

/* ONAY KUYRUĞU ÖZETİ (kullanıcı isteği 2026-09-24):
 * "hangi parktan/projeden/kullanıcıdan onaya veri gelirse yanında bildirim
 * simgesi yansın, ben kontrol edip onaylayım". Rozetler üç seviyede de var
 * (park/proje/kullanıcı summary'sinde 🔴 N); buradaki kutu genel özet +
 * kısayollar, yan menüdeki 🔐 Ölçüm Yönetimi öğesinde de sayı rozeti yanar. */
function dgRenderPendingSummary(){
  const box=$("adminPending");
  const all=dgTreeGroup(DG_TREE_ROWS);
  const wait=all.reduce((a,P)=>a+(P.beklemede||0),0);
  dgUpdateSidebarBadge(wait);
  if(!box||!box.style)return;

  if(!wait){
    box.style.display="none";
    box.innerHTML="";
    return;
  }
  const parkN=all.filter(P=>P.beklemede>0).length;
  const projN=all.reduce((a,P)=>a+P.projects.filter(J=>J.beklemede>0).length,0);
  const userN=all.reduce((a,P)=>a+P.projects.reduce((b,J)=>b+J.users.filter(U=>U.beklemede>0).length,0),0);

  box.style.display="block";
  box.className="alert warn";
  box.innerHTML=
    `<b>⏳ ${wait} kayıt onay bekliyor</b> · 🌳 ${parkN} park · 📁 ${projN} proje · 👤 ${userN} kullanıcı`+
    `<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">`+
      `<button class="btn sm amber" onclick="dgTreeOnlyPending()">🔴 Sadece bekleyenler</button>`+
      `<button class="btn sm ghost" onclick="dgTreeOpenPending()">Bekleyen düğümleri aç</button>`+
    `</div>`;
}

function dgUpdateSidebarBadge(n){
  const b=$("adminPendingBadge");
  if(!b||!b.style)return;
  if(n>0){
    b.style.display="inline-block";
    b.textContent=n>99?"99+":String(n);
  }else{
    b.style.display="none";
    b.textContent="";
  }
}

/* Yan menü rozeti, yönetim sekmesi AÇILMADAN da güncel olsun diye ayrı bir
 * hafif sorgu (head:true → yalnız sayı, satır çekilmez). */
async function dgRefreshPendingBadge(){
  try{
    const{count,error}=await sb.from("measurements")
      .select("*",{count:"exact",head:true}).eq("status","Beklemede");
    if(!error)dgUpdateSidebarBadge(count||0);
  }catch(e){}
}

function dgTreeOnlyPending(){
  DG_TREE_STATUS="Beklemede";
  const sel=$("treeStatus");
  if(sel)sel.value="Beklemede";
  dgTreeDraw();
}

/* Yalnız onay bekleyen kayıt içeren düğümleri açar (kuyrukta hızlı gezinme). */
function dgTreeOpenPending(){
  const rows=dgTreeFilterRows(DG_TREE_ROWS,DG_TREE_STATUS,DG_TREE_QUERY);
  const tree=dgTreeGroup(rows);
  tree.forEach(P=>{
    if(!(P.beklemede>0))return;
    DG_TREE_OPEN.add(P.key);
    P.projects.forEach(J=>{
      if(!(J.beklemede>0))return;
      DG_TREE_OPEN.add(J.key);
      J.users.forEach(U=>{if(U.beklemede>0)DG_TREE_OPEN.add(U.key);});
    });
  });
  dgTreeRender(tree);
}

function dgTreeRender(tree){
  const el=$("adminTree");
  if(!el)return;

  dgRenderPendingSummary();

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

  /* ⚠ "YÜKLENIYOR"DA ASILI KALMA KORUMASI (canlıda yaşandı 2026-09-24):
   * sorgu PostgREST hatası DEĞİL de bir JS istisnası fırlatırsa await reddedilir
   * ve kutu sonsuza dek "⏳ Ölçümler yükleniyor…"da kalırdı. Artık her yol
   * ya veri ya da SEBEP gösterir. */
  let res=null;
  try{
    res=await dgTreeFetch();
  }catch(e){
    DG_TREE_ROWS=[];
    DG_TREE_ERR="beklenmedik sorgu hatası: "+((e&&e.message)||String(e));
    dgTreeDraw();
    return;
  }

  DG_TREE_ROWS=res.rows||[];
  DG_TREE_ERR=(res.error&&DG_TREE_ROWS.length)?null:res.error;

  if(res.mode!=="embed"&&res.error&&DG_TREE_ROWS.length){
    toast("⚠ Gömülü sorgu başarısız, yedek birleştirme kullanıldı: "+esc(res.error),"warn","🌳");
  }

  try{
    dgTreeDraw();
  }catch(e){
    DG_TREE_ERR="çizim hatası: "+((e&&e.message)||String(e));
    if(box)box.innerHTML=`<div class="alert err"><b>⚠ Ağaç çizilemedi</b> `+
      `<span class="mono" style="font-size:.72rem">${esc(DG_TREE_ERR)}</span> `+
      `<button class="btn sm blue" onclick="loadAdminTree()">🔄 Yeniden dene</button></div>`;
  }
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
window.dgRefreshPendingBadge=dgRefreshPendingBadge;
window.dgTreeOnlyPending=dgTreeOnlyPending;
window.dgTreeOpenPending=dgTreeOpenPending;
window.dgTreeSetStatus=dgTreeSetStatus;
window.dgTreeSetQuery=dgTreeSetQuery;
window.dgTreeToggle=dgTreeToggle;
window.dgTreeExpand=dgTreeExpand;
window.dgTreePendingScan=dgTreePendingScan;
