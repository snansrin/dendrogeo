"use strict";
/* 0035c: EN modu çeviri yardımcısı. */
const _ta=(s)=>(typeof dgT==="function"?dgT(s):s);
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

/* Veri çekme admin adapter'ında yürür. Korunan sorgu sözleşmesi:
 * .select(DG_TREE_SEL_FULL,{count:"exact"}).order("created_at",{ascending:false}).limit(1000)
 * adapter profiles!measurements_owner_fkey(full_name) ilişki adını ve mode:"join"/mode:"fail" yedeğini korur. */
/* Sorgu alanı adapter'da tutulur; kaynak sözleşmesi:
const DG_TREE_SEL_FULL=
  "id,point_id,measurement_no,species,grp,dbh_cm,girth_cm,height_m,carbon_kg,"
*/
async function dgTreeFetch(){return window.DG_ADMIN_TREE_STORE.fetchRows(sb,dgWarnIfTruncated);}

/* =========================================================
   2. SAF GRUPLAMA (birim testlenebilir — DOM yok)
========================================================= */

/* Satırları park → proje → kullanıcı ağacına dizer.
 * Parkı olmayan kayıtlar TEK "Park algılanmamış" düğümünde toplanır
 * (karşılaştırma sayfasındaki park_pending mantığıyla aynı).
 * Sıralama: her seviyede karbon azalan. */
function dgTreeGroup(rows){
  /* Her kullanıcının kayıtları nokta/ölçüm sırasıyla kalır: U2.rows.sort((a,b)=>(+a.point_id||0)-(+b.point_id||0)). */
  return window.DG_GROUP_MEASUREMENT_TREE.group(rows);
}

/* Filtre: durum + serbest metin (kullanıcı, tür, proje, nokta) */
function dgTreeFilterRows(rows,status,query){
  return window.DG_FILTER_MEASUREMENT_TREE.filter(rows,status,query);
}

/* =========================================================
   3. ÇİZİM
========================================================= */

const dgTon=kg=>window.DG_ADMIN_TREE_FORMATTERS.tons(kg);

/* Onay bekleyen rozeti: 🔴 + sayı. Sıfırsa hiç basılmaz (gürültü olmasın). */
const dgBekRozet=n=>window.DG_ADMIN_TREE_FORMATTERS.pendingBadge(n,typeof dgTfs==="function"?dgTfs:null);
const dgDurumOzet=o=>window.DG_ADMIN_TREE_FORMATTERS.statusSummary(o);
const dgBadge=st=>window.DG_ADMIN_TREE_FORMATTERS.badge(st,esc);

function dgTreeRowHTML(r){
  const st=r.status||"Beklemede";
  const act=st==="Onaylı"
    ? `<button class="btn sm red" onclick="rejectMeas(${r.id})">🚫 Reddet</button>`
    : `<button class="btn sm" onclick="approveMeas(${r.id})">✓ Onayla</button>`;
  const d=r.created_at?new Date(r.created_at):null;
  /* data-label: 640px altında tablo kart düzenine döner (css/style.css .dg-cards)
   * data-mid: 0043 — satırı kayıt kimliğiyle bul (iyimser onay/red güncellemesi). */
  return `<tr data-mid="${esc(r.id)}">`+
    `<td data-label="Nokta"><b>P${esc(r.point_id)}</b>${r.measurement_no>1?`<span class="mono dg-sub"> /M${r.measurement_no}</span>`:""}</td>`+
    `<td data-label="Tür">${esc(r.species||"—")}<br><span class="mono dg-sub">${esc((typeof LATIN!=="undefined"&&LATIN[r.species])||"")}</span></td>`+
    `<td data-label="Grup">${esc(r.grp||"—")}</td>`+
    `<td data-label="DBH">${Number.isFinite(+r.dbh_cm)?(+r.dbh_cm).toFixed(1):"—"}${r.girth_cm!=null&&Number(r.girth_cm)>0?`<br><span class="mono dg-sub" title="Sahada ölçülen ham göğüs çevresi">çevre: ${(+r.girth_cm).toFixed(1)} cm</span>`:""}</td>`+
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
      `<span class="dg-tree-meta">${U.n} ${_ta("kayıt")} · ${dgTon(U.c)} · ${dgDurumOzet(U)}</span>`+
    `</summary>`+
    `<div class="dg-tree-body tblwrap"><table class="dg-cards">`+
      `<thead><tr><th scope='col'>Nokta</th><th scope='col'>Tür</th><th scope='col'>Grup</th><th scope='col'>Çap</th><th scope='col'>Boy</th><th scope='col'>Karbon kg</th><th scope='col'>Foto</th><th scope='col'>Durum</th><th scope='col'>Tarih</th><th scope='col'>İşlem</th></tr></thead>`+
      `<tbody>${U.rows.map(dgTreeRowHTML).join("")}</tbody>`+
    `</table></div>`+
  `</details>`;
}

function dgTreeProjectHTML(P,J){
  const open=DG_TREE_OPEN.has(J.key)?" open":"";
  return `<details class="dg-tree-proj"${open} ontoggle="dgTreeToggle('${J.key}',this.open)">`+
    `<summary>📁 <b>${esc(J.name)}</b>`+
      dgBekRozet(J.beklemede)+
      `<span class="dg-tree-meta">${J.users.length} ${_ta("kullanıcı")} · ${J.n} ${_ta("kayıt")} · ${dgTon(J.c)}</span>`+
      /* 0036 (T2): proje silme — yalnız yönetici/kurucu görür; RLS sunucuda
       * ayrıca zorlar (owner veya is_owner). Cascade: measurements+waypoints. */
      ((typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.role==="owner"||PROFILE.role==="admin")&&J.project_id)
        ?`<button class="btn sm red dg-tree-act" onclick="dgTreeDeleteProject(event,${J.project_id})" title="${_ta("Projeyi kalıcı olarak sil (ölçümler + waypoint'ler dahil)")}">🗑</button>`:"")+
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
      `<span class="dg-tree-meta">${esc(P.city||"")}${ha} · ${projN} ${_ta("proje")} · ${userN} ${_ta("kullanıcı")} · ${P.n} ${_ta("kayıt")} · ${dgTon(P.c)}${perHa}</span>`+
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
  return window.DG_ADMIN_TREE_PENDING_SUMMARY.render({box:$("adminPending"),rows:DG_TREE_ROWS,
    group:dgTreeGroup,updateSidebarBadge:dgUpdateSidebarBadge,translate:_ta});
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
    el.innerHTML=`<div class="alert info">${_ta("Bu filtreye uyan kayıt yok.")} `+
      `(${_ta("Toplam")} ${DG_TREE_ROWS.length} ${_ta("kayıt çekildi")}${DG_TREE_STATUS?" · "+_ta("durum")+": "+esc(DG_TREE_STATUS):""}${DG_TREE_QUERY?" · "+_ta("arama")+": "+esc(DG_TREE_QUERY):""})</div>`;
    return;
  }

  const parkN=tree.filter(P=>!P.pending).length;
  const projN=tree.reduce((a,P)=>a+P.projects.length,0);
  const recN=tree.reduce((a,P)=>a+P.n,0);
  const carb=tree.reduce((a,P)=>a+P.c,0);

  el.innerHTML=
    `<div class="dg-tree-sum mono">🌳 ${parkN} ${_ta("park")} · 📁 ${projN} ${_ta("proje")} · 📋 ${recN} ${_ta("kayıt")} · ⚖ ${dgTon(carb)}`+
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
  /* ═══ 0043 · KAYDIRMA SIÇRAMASININ KÖK NEDENİ BURADAYDI ═══
   * ESKİ davranış: her yenilemede (onay/red sonrası loadAdmin→loadAdminTree,
   * sekme açılışı, 🔄 Yenile) ağaç KOŞULSUZ tek satır "⏳ Ölçümler yükleniyor…"
   * ile eziliyordu. Yüzlerce satırlık ağaç bir anda ~40px'e çökünce toplam
   * belge yüksekliği aniden küçülüyor, tarayıcı window.scrollY'yi yeni (küçük)
   * azami değere KIRPIYORDU → ekran yukarı fırlıyordu ("sıçrama"). dgTreeDraw
   * sonra ağacı yeniden çizse de kaydırma çoktan kaybolmuş oluyordu; 0040/0041
   * sarmalları bu ÇÖKMEYİ yakalayamadı çünkü konum, yükleme mesajı basılırken
   * (await'ten ÖNCE, sarmal dışında) sıfırlanıyordu.
   * ÇÖZÜM: "yükleniyor" mesajı YALNIZ ilk yüklemde (kutu boşken). Yenilemede
   * mevcut ağaç ekranda KALIR → yükseklik çökmez → kırpma yok → sıçrama yok.
   * Yeni veri gelince dgTreeDraw onu YERİNDE çizer. Ek güvence: kaydırma
   * konumu işlemin BAŞINDA yakalanıp SONUNDA (çizimden sonra) geri yazılır. */
  const hasTree=box&&box.querySelector&&box.querySelector(".dg-tree-park,.dg-tree-sum,.alert.err,.alert.info");
  if(box&&!hasTree)box.innerHTML=`<div class="alert info">⏳ ${_ta("Ölçümler yükleniyor…")}</div>`;
  const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);

  /* ⚠ "YÜKLENIYOR"DA ASILI KALMA KORUMASI (canlıda yaşandı 2026-09-24):
   * sorgu PostgREST hatası DEĞİL de bir JS istisnası fırlatırsa await reddedilir
   * ve kutu sonsuza dek "⏳ Ölçümler yükleniyor…"da kalırdı. Artık her yol
   * ya veri ya da SEBEP gösterir. */
  let res=null;
  try{
    res=await dgTreeFetch();
  }catch(e){
    DG_TREE_ROWS=[];
    DG_TREE_ERR=_ta("beklenmedik sorgu hatası: ")+((e&&e.message)||String(e));
    dgTreeDraw();
    if(typeof dgScrollRestore==="function")dgScrollRestore(_y);
    return;
  }

  DG_TREE_ROWS=res.rows||[];
  DG_TREE_ERR=(res.error&&DG_TREE_ROWS.length)?null:res.error;

  if(res.mode!=="embed"&&res.error&&DG_TREE_ROWS.length){
    toast(dgCf("⚠ Gömülü sorgu başarısız, yedek birleştirme kullanıldı: ")+esc(res.error),"warn","🌳");
  }

  try{
    dgTreeDraw();
  }catch(e){
    DG_TREE_ERR=_ta("çizim hatası: ")+((e&&e.message)||String(e));
    if(box)box.innerHTML=`<div class="alert err"><b>⚠ Ağaç çizilemedi</b> `+
      `<span class="mono" style="font-size:.72rem">${esc(DG_TREE_ERR)}</span> `+
      `<button class="btn sm blue" onclick="loadAdminTree()">🔄 Yeniden dene</button></div>`;
  }
  /* 0043: çizim bittikten SONRA kaydırmayı geri koy (ağaç yenilenirken bel
   * yüksekliği değişmiş olabilir; sarmal tek başına yetmez, çünkü yükleniyor
   * çökmesi eskiden sarmalın DIŞINDAYDI). */
  if(typeof dgScrollRestore==="function")dgScrollRestore(_y);
}

/* Filtrelenmiş ağacı çiz (veri zaten DG_TREE_ROWS'ta) */
/* 0040: kaydırma koruma sarmalı. */
function dgTreeDraw(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgTreeDraw__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgTreeDraw__scroll(){
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

/* =========================================================
   5. 0043 · İYİMSER ONAY/RED/SİL (ağdan YENİDEN ÇEKME YOK)
   Kullanıcı "3-4 kaydı onaylarken sıçrama yaşıyorum, bir sürü veri
   girilecek" dedi. Eski akış her onayda loadAdmin→loadAdminTree ile TÜM
   ağacı sunucudan yeniden çekiyordu; bu hem yavaş (çift ağ turu) hem de
   ağacı "⏳ yükleniyor"a çökertip kaydırmayı fırlatıyordu.
   Yeni akış: DB yazımı BAŞARILI olunca ilgili satırın durumu YEREL önbellekte
   (DG_TREE_ROWS) güncellenir ve ağaç YERİNDE yeniden çizilir. dgTreeDraw
   zaten kaydırma korumalı + çökertmesiz → tık anında, ekran kımıldamaz,
   sayaçlar/rozetler (✓N ⏳N 🚫N, 🔴 bekleyen) doğru kalır. Düz liste de aynı
   önbellekten tazelenir (admin.js:dgRenderFlatTable). Sunucu ile tam mutabakat
   için admin.js ayrıca SEKMELİ (debounced) bir arka plan loadAdmin çalıştırır.
========================================================= */
function dgTreeRows(){return DG_TREE_ROWS;}

/* Satırın durumunu yerel önbellekte güncelle + ağacı ve düz listeyi yerinde
 * yeniden çiz. Satır önbellekte yoksa false döner (çağıran tam loadAdmin'e
 * düşer — örn. düz listeden, ağaç henüz yüklenmemişken onay). */
function dgTreeApplyStatus(id,status,shared){
  const row=DG_TREE_ROWS.find(r=>Number(r.id)===Number(id));
  if(!row)return false;
  row.status=status;
  if(shared!=null)row.shared=shared;
  try{dgTreeDraw();}catch(e){}
  try{if(typeof dgRenderFlatTable==="function")dgRenderFlatTable(DG_TREE_ROWS);}catch(e){}
  return true;
}

/* Satırı yerel önbellekten sil (delMeas) + yerinde yeniden çiz. */
function dgTreeRemoveRow(id){
  const i=DG_TREE_ROWS.findIndex(r=>Number(r.id)===Number(id));
  if(i<0)return false;
  DG_TREE_ROWS.splice(i,1);
  try{dgTreeDraw();}catch(e){}
  try{if(typeof dgRenderFlatTable==="function")dgRenderFlatTable(DG_TREE_ROWS);}catch(e){}
  return true;
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
/* 0043: iyimser onay/red/sil — admin.js bunları çağırır (ağaç önbelleğine erişir). */
window.dgTreeApplyStatus=dgTreeApplyStatus;
window.dgTreeRemoveRow=dgTreeRemoveRow;
window.dgTreeRows=dgTreeRows;

/* 0036 (T2) · PROJEYİ TAMAMEN SİL (yönetim ağacından).
 * RLS: projects_delete = owner veya is_owner() → sunucu kararı kesindir;
 * istemci düğmeyi admin/owner'a gösterir, yetki yoksa hata toast'ı düşer.
 * FK'ler on delete cascade → projenin ölçümleri ve waypoint'leri birlikte gider.
 * Park kimliği (parks) SİLİNMEZ — karşılaştırma bütünlüğü korunur. */
async function dgTreeDeleteProject(ev,pid){
 if(ev){ev.preventDefault();ev.stopPropagation();}
 const msg=_ta("Proje TÜM ölçüm ve waypoint'leriyle kalıcı olarak silinsin mi? Bu işlem geri alınamaz (park kimliği kalır).");
 if(!confirm(msg))return;
 try{
  const{error}=await sb.from("projects").delete().eq("id",pid);
  if(error){toast(_ta("Proje silinemedi: ")+error.message,"err","🗑");return;}
  try{DG_LIVE_DIRTY=true;}catch(e){}
  toast(_ta("✓ Proje silindi (ölçümler + waypoint'ler cascade ile kaldırıldı)"),"ok","🗑");
  if(typeof dgTreeDraw==="function")dgTreeDraw();
  if(typeof loadAdmin==="function")loadAdmin();
 }catch(e){toast(_ta("Proje silinemedi: ")+(e&&e.message||e),"err","🗑");}
}
