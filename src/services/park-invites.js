"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar. */
const _tinv=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tinvf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));

/* park-invites.js — Park Çalışma Arkadaşı (0025 · 2026-09-29)
 *
 * Kullanıcı isteği: "park çalışma arkadaşı daveti — beraber aynı projeye
 * veri girilmesini sağlasın."
 *
 * Akış:
 *   1) Park SAHİBİ (veya yönetici) 👥 kartından e-posta ile davet açar
 *      → dg_invite_send RPC (yetki SUNUCUDA denetlenir: proje sahibi/admin).
 *   2) Davetli, kendi hesabıyla Projeler sekmesinde 📬 kartını görür →
 *      Kabul/Red (dg_invite_respond). E-posta kimlik DOĞRULAMAZ; kabul
 *      yalnız auth.uid() ↔ profiles.email eşleşmesiyle olur (RPC denetler).
 *   3) Kabul → park_collaborators üyeliği: ölçüm sekmesindeki proje
 *      listesinde paylaşılan parkın projeleri görünür (loadProjects birleşimi),
 *      ölçümler HER ZAMANKİ gibi owner=auth.uid() ile girer (kim ölçtü belli;
 *      RLS meas_insert değişmedi). Konum çiti (0007) ve park bağı kilidi
 *      (0006) aynen geçerli — işbirliği hiçbir sunucu kapısını gevşetmez.
 *   4) Park sahibi, ortağın BEKLEYEN kayıtlarını Ölçüm Yönetimi'nde görür
 *      (genişletilmiş meas_select: ortak park kayıtları) ve onaylar.
 *
 * Yazma YOLU yalnız RPC'dir: tablolara insert/update/delete grant'i yok.
 * Bu modül klasik <script> global düzenindedir (proje mimarisi): DOM'a
 * yalnız kendi kartlarından dokunur, yeni CSS sınıfı ailesi YOKTUR
 * (mevcut card/shead/badge/btn/alert aileleri kullanılır — ui-standard).
 */

/* ---------------- ortak durum ---------------- */
const DG_INV={parks:null,invites:null,collabs:null,mine:null,loading:false};

function dgInvSetCount(id,n){const el=$(id);if(el)el.textContent=String(Number(n)||0);}
function dgOwnedParks(rows){return (rows||[]).filter(p=>p.role==="owner");}
function dgSharedParks(rows){return (rows||[]).filter(p=>p.role==="collaborator");}
function dgCanManagePark(pid){
 return dgOwnedParks(DG_INV.mine).some(p=>Number(p.id)===Number(pid));
}

/* v_my_parks: sahibi VEYA ortağı olduğum parklar (view auth.uid() süzer) */
async function dgMyParks(force){
 if(!force&&DG_INV.mine)return DG_INV.mine;
 if(typeof sb==="undefined"||!sb)return [];
 try{
  const{data,error}=await sb.from("v_my_parks").select("*");
  if(error){
   if(/42P01|relation|view/i.test(error.message||""))dgInvitesNote("0025_park_invites.sql çalıştırılmalı (v_my_parks yok)");
   return [];
  }
  return DG_INV.mine=data||[];
 }catch(e){return [];}
}

/* ---------------- 📬 DAVETLERİN (Projeler sekmesi · herkes) ---------------- */
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function dgInvitesLoadMine(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await dgInvitesLoadMine__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function dgInvitesLoadMine__scroll(){
 const box=$("dgInvBox");
 if(box)box.style.display="none";
 if(typeof USER==="undefined"||!USER){
  const sh=$("dgSharedBox");if(sh)sh.style.display="none";
  dgInvSetCount("projInviteCount",0);dgInvSetCount("projSharedCount",0);
  return;
 }
 const me=String((PROFILE&&PROFILE.email)||USER.email||"").toLowerCase();
 let rows=[];
 try{
  const{data,error}=await sb.from("park_invites").select("id,park_id,email,note,status,created_at,invited_by,parks(id,name,city)").eq("status","Beklemede");
  if(!error)rows=(data||[]).filter(r=>String(r.email||"").toLowerCase()===me);
 }catch(e){/* tablo yok → sessiz geri dönüş */}
 dgInvSetCount("projInviteCount",rows.length);

 const parks=await dgMyParks();
 const shared=dgSharedParks(parks);
 dgInvSetCount("projSharedCount",shared.length);
 const sbox=$("dgSharedBox");
 if(sbox){
  if(shared.length){
   sbox.style.display="";
   sbox.innerHTML='<div class="project-member-banner-icon">🤝</div><div><b>Ortak çalışma erişimin var</b><span>'+
    shared.map(p=>esc(p.name)+(p.city?" · "+esc(p.city):"")).join(" · ")+
    '</span><small>Bu projelerde ölçüm girebilirsin. Proje düzenleme, ekip daveti ve erişim yönetimi proje sahibinde kalır.</small></div>';
  }else sbox.style.display="none";
 }

 if(!rows.length)return;
 if(box){
  box.style.display="";
  box.innerHTML='<div class="project-section-head"><div><span class="project-step">📬</span><div><h3>Sana gelen davetler</h3><p>Burada yalnız sana gönderilen çalışma davetleri görünür.</p></div></div><span class="badge admin">DAVET EDİLEN</span></div>'+
   '<div class="project-invite-list">'+rows.map(r=>`<article class="project-invite-item"><div class="project-invite-main"><b>🌳 ${esc(r.parks&&r.parks.name?r.parks.name:("Park #"+r.park_id))}</b><span>${r.parks&&r.parks.city?esc(r.parks.city):""}</span>${r.note?`<small>Not: ${esc(r.note)}</small>`:""}</div><div class="project-invite-meta"><span class="mono">${new Date(r.created_at).toLocaleDateString("tr-TR")}</span><div><button class="btn sm" onclick="dgInviteRespond('${r.id}',true)">✓ Kabul et</button><button class="btn sm ghost" onclick="dgInviteRespond('${r.id}',false)">Reddet</button></div></div></article>`).join("")+'</div>';
 }
}
async function dgInviteRespond(id,accept){
 if(typeof USER==="undefined"||!USER)return toast("Önce giriş yap.","err","📬");
 const{error}=await sb.rpc("dg_invite_respond",{p_invite:id,p_accept:!!accept});
 if(error){toast(dgCf("İşlenemedi: ")+(error.message||"").slice(0,90),"err","📬");return;}
 toast(accept?"Davet kabul edildi — proje listene bak 🌳":"Davet reddedildi","ok","📬");
 if(accept){
  DG_INV.mine=null;                       // ortak park listesi tazelensin
  if(typeof loadProjects==="function")loadProjects();
 }
 dgInvitesLoadMine();
}

/* ---------------- 👥 ÇALIŞMA ARKADAŞLARI (Yönetim sekmesi · sahip/admin) ---------------- */
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function dgCollabLoad(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await dgCollabLoad__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function dgCollabLoad__scroll(){
 const sel=$("dgInvPark"), card=$("dgOwnerCollabCard");
 if(!sel)return;
 if(typeof USER==="undefined"||!USER){
  if(card)card.style.display="none";
  sel.innerHTML='<option value="">Giriş gerekli</option>';return;
 }
 const parks=await dgMyParks(true);
 const owned=dgOwnedParks(parks);
 dgInvSetCount("projOwnCount",owned.length);
 dgInvSetCount("projSharedCount",dgSharedParks(parks).length);
 if(!owned.length){
  if(card)card.style.display="none";
  sel.innerHTML='<option value="">Sahibi olduğun proje yok</option>';
  DG_INV.invites=[];DG_INV.collabs=[];
  dgCollabRender();
  return;
 }
 if(card)card.style.display="";
 const keep=sel.value;
 sel.innerHTML=owned.map(p=>`<option value="${p.id}">${esc(p.name)}${p.city?" · "+esc(p.city):""}</option>`).join("");
 if(keep&&[...sel.options].some(o=>o.value===keep))sel.value=keep;
 await dgCollabRefresh();
}
async function dgCollabRefresh(){
 const sel=$("dgInvPark");if(!sel||!sel.value)return dgCollabRender();
 const pid=Number(sel.value);
 if(!dgCanManagePark(pid)){
  DG_INV.invites=[];DG_INV.collabs=[];
  sel.value="";
  dgCollabRender();
  return;
 }
 const[inv,col]=await Promise.all([
  sb.from("park_invites").select("id,email,note,status,created_at,invited_by").eq("park_id",pid).order("created_at",{ascending:false}).limit(50),
  sb.from("park_collaborators").select("user_id,added_at,profiles(id,full_name,email)").eq("park_id",pid).limit(50),
 ]);
 DG_INV.invites=inv.error?null:(inv.data||[]);
 DG_INV.collabs=col.error?null:(col.data||[]);
 if(inv.error&&/42P01|relation/i.test(inv.error.message||""))dgInvitesNote("0025_park_invites.sql çalıştırılmalı (park_invites yok)");
 dgCollabRender();
}
/* 0040: kaydırma koruma sarmalı. */
function dgCollabRender(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgCollabRender__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgCollabRender__scroll(){
 const box=$("dgInvList");if(!box)return;
 const sel=$("dgInvPark");
 if(!sel||!sel.value||!dgCanManagePark(Number(sel.value))){
  box.innerHTML='<div class="project-empty"><b>Ekip yönetimi proje sahibine özeldir.</b><span>Sahibi olduğun bir proje varsa burada davet ve ortak yönetimi açılır.</span></div>';return;
 }
 const inv=DG_INV.invites||[], col=DG_INV.collabs||[];
 const badge=s=>s==="Beklemede"?'<span class="badge admin">Bekliyor</span>':s==="Kabul"?'<span class="badge on">Kabul</span>':s==="Red"?'<span class="badge off">Red</span>':'<span class="badge off">İptal</span>';
 const collabs=col.length?col.map(c=>{const p=c.profiles||{};return `<div class="project-person"><div class="project-avatar">👤</div><div class="project-person-copy"><b>${esc(p.full_name||"Çalışma arkadaşı")}</b><span>${esc(p.email||String(c.user_id).slice(0,8))}</span><small>${new Date(c.added_at).toLocaleDateString("tr-TR")} tarihinden beri ortak</small></div><button class="btn sm ghost" onclick="dgInviteRevoke('${c.user_id}','collab')">Erişimi kaldır</button></div>`;}).join(""):'<div class="project-empty"><span>Henüz aktif çalışma arkadaşı yok.</span></div>';
 const invites=inv.length?inv.map(r=>`<div class="project-invite-row"><div><b>${esc(r.email)}</b>${r.note?`<small>${esc(r.note)}</small>`:""}</div><div>${badge(r.status)}<span class="mono">${new Date(r.created_at).toLocaleDateString("tr-TR")}</span>${r.status==="Beklemede"?`<button class="btn sm ghost" onclick="dgInviteRevoke('${r.id}','invite')">Geri al</button>`:""}</div></div>`).join(""):'<div class="project-empty"><span>Bu proje için davet geçmişi yok.</span></div>';
 box.innerHTML=
  '<div class="project-owner-note"><b>✉️ Yeni çalışma arkadaşı davet et</b><span>Davet yetkisi yalnız proje sahibinde. Davet edilen kişi proje yönetemez; kendi ölçümlerini kendi hesabıyla girer.</span></div>'+
  '<div class="project-invite-form"><div><label class="lbl" for="dgInvEmail">E-posta</label><input id="dgInvEmail" type="email" autocomplete="email" placeholder="arkadas@kurum.edu.tr"></div><div><label class="lbl" for="dgInvNote">Kısa not <span class="project-optional">opsiyonel</span></label><input id="dgInvNote" placeholder="örn. kuzey bölüm saha çalışması"></div><button class="btn sm" onclick="dgInviteSend()">✉️ Davet gönder</button></div>'+
  '<div class="project-team-grid"><section><div class="project-subhead"><b>Aktif ortaklar</b><span>'+col.length+'</span></div>'+collabs+'</section><section><div class="project-subhead"><b>Davet geçmişi</b><span>'+inv.length+'</span></div>'+invites+'</section></div>';
}
async function dgInviteSend(){
 const sel=$("dgInvPark"),em=$("dgInvEmail"),nt=$("dgInvNote");
 if(!sel||!sel.value)return toast(_tinv("Önce sahibi olduğun projeyi seç."),"err","👥");
 if(!dgCanManagePark(Number(sel.value)))return toast(_tinv("Davet yetkisi yalnız proje sahibinde."),"err","👥");
 const email=(em&&em.value||"").trim();
 if(!email)return toast("E-posta gir.","err","👥");
 const{data,error}=await sb.rpc("dg_invite_send",{p_park:Number(sel.value),p_email:email,p_note:(nt&&nt.value)||null});
 if(error){toast(dgCf("Davet gönderilemedi: ")+(error.message||"").slice(0,110),"err","👥");return;}
 if(em)em.value="";if(nt)nt.value="";
 toast("Davet açıldı — arkadaşın giriş yaptığında 📬 kartını görecek ✉️","ok","👥");
 dgCollabRefresh();
}

async function dgInviteRevoke(target,kind){
 const sel=$("dgInvPark");
 if(!sel||!sel.value)return;
 if(!dgCanManagePark(Number(sel.value)))return toast(_tinv("Ekip yönetimi yalnız proje sahibinde."),"err","👥");
 const{error}=await sb.rpc("dg_invite_revoke",{p_park:Number(sel.value),p_target:target,p_kind:kind});
 if(error){toast(dgCf("İşlenemedi: ")+(error.message||"").slice(0,90),"err","👥");return;}
 toast(kind==="collab"?"Ortak kaldırıldı":"Davet geri alındı","ok","👥");
 DG_INV.mine=null;
 dgCollabRefresh();
}

function dgInvitesNote(msg){
 const box=$("dgInvList");
 if(box&&!box.innerHTML.includes(msg))box.innerHTML='<div class="alert warn">'+esc(msg)+'</div>'+box.innerHTML;
}
