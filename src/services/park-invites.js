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
const DG_PARK_INVITE_STATE_STORE=window.DG_PARK_INVITE_STATE.create();
const DG_INV={...DG_PARK_INVITE_STATE_STORE.getState()};
DG_PARK_INVITE_STATE_STORE.subscribe(state=>Object.assign(DG_INV,state));
function dgInviteStateUpdate(patch){return DG_PARK_INVITE_STATE_STORE.setState(patch);}
const DG_PARK_INVITE_MODULE_STORE=window.DG_PARK_INVITE_STORE.create(()=>sb);
let DG_INVITE_BADGE_EPOCH=0;

function dgInvSetCount(id,n){return window.DG_PARK_INVITE_INBOX_UI.setCount($,id,n);}
function dgOwnedParks(rows){return window.DG_PARK_INVITE_ACCESS.owned(rows);}
function dgSharedParks(rows){return window.DG_PARK_INVITE_ACCESS.shared(rows);}
function dgCanManagePark(pid){return window.DG_PARK_INVITE_ACCESS.canManage(pid,DG_INV.mine);}

/* v_my_parks: sahibi VEYA ortağı olduğum parklar (view auth.uid() süzer) */
async function dgMyParks(force){
 return window.DG_LOAD_OWNED_INVITE_PARKS.execute(DG_PARK_INVITE_STATE_STORE,force,{
  hasClient:()=>typeof sb!=="undefined"&&!!sb,
  load:()=>DG_PARK_INVITE_MODULE_STORE.myParks(),
  onMissingSchema:()=>dgInvitesNote("0025_park_invites.sql çalıştırılmalı (v_my_parks yok)")
 });
}

/* ---------------- 📬 DAVETLERİN (Projeler sekmesi · herkes) ---------------- */
/* Hafif, salt-okunur rozet sorgusu: Projeler ekranına girmeden de yeni davet görülür.
 * RLS bütün sonuçları sınırlar; sahip/yönetici satırları e-postaya göre ayrıca ayıklanır. */
async function dgInvitesRefreshBadge(){
 const epoch=++DG_INVITE_BADGE_EPOCH;
 if(typeof USER==="undefined"||!USER||typeof sb==="undefined"||!sb){window.DG_PARK_INVITE_INBOX_UI.resetRecipient($);return;}
 const userId=USER.id,email=String((PROFILE&&PROFILE.email)||USER.email||"").trim().toLowerCase();
 if(!email){window.DG_PARK_INVITE_INBOX_UI.setInviteBadge($,0);return;}
 try{
  const{data,error}=await DG_PARK_INVITE_MODULE_STORE.pendingBadge();
  if(error)throw error;
  if(epoch!==DG_INVITE_BADGE_EPOCH||!USER||USER.id!==userId||String((PROFILE&&PROFILE.email)||USER.email||"").trim().toLowerCase()!==email)return;
  const count=(data||[]).filter(row=>String(row.email||"").trim().toLowerCase()===email).length;
  window.DG_PARK_INVITE_INBOX_UI.setCount($,"projInviteCount",count);
  window.DG_PARK_INVITE_INBOX_UI.setInviteBadge($,count);
 }catch(error){/* Ağ/RLS hatasında mevcut sayı kalsın; yanlışlıkla sıfırlama. */}
}
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function dgInvitesLoadMine(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await dgInvitesLoadMine__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function dgInvitesLoadMine__scroll(){
 const epoch=++DG_INVITE_BADGE_EPOCH;
 if(typeof USER==="undefined"||!USER){window.DG_PARK_INVITE_INBOX_UI.resetRecipient($);return;}
 const userId=USER.id;
 const email=String((PROFILE&&PROFILE.email)||USER.email||"").toLowerCase();
 const rows=await window.DG_LOAD_RECIPIENT_PARK_INVITES.execute(email,()=>DG_PARK_INVITE_MODULE_STORE.inbox(),DG_PARK_INVITE_STATE_STORE);
 const parks=await dgMyParks(),shared=dgSharedParks(parks);
 if(epoch!==DG_INVITE_BADGE_EPOCH||!USER||USER.id!==userId||String((PROFILE&&PROFILE.email)||USER.email||"").toLowerCase()!==email)return;
 window.DG_PARK_INVITE_INBOX_UI.presentRecipient({getElement:$,rows,shared,escape:esc});
}
async function dgInviteRespond(id,accept){
 return window.DG_MANAGE_PARK_INVITES.respond(id,accept,{
  authenticated:()=>typeof USER!=="undefined"&&!!USER,
  store:DG_PARK_INVITE_MODULE_STORE,
  onUnauthenticated:()=>toast("Önce giriş yap.","err","📬"),
  onFailure:error=>toast(dgCf("İşlenemedi: ")+(error.message||"").slice(0,90),"err","📬"),
  onSuccess:accepted=>toast(accepted?"Davet kabul edildi — proje listene bak 🌳":"Davet reddedildi","ok","📬"),
  onAccepted:()=>{dgInviteStateUpdate({mine:null});if(typeof loadProjects==="function")loadProjects();},
  onComplete:()=>dgInvitesLoadMine()
 });
}

/* ---------------- 👥 ÇALIŞMA ARKADAŞLARI (Yönetim sekmesi · sahip/admin) ---------------- */
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function dgCollabLoad(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await dgCollabLoad__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function dgCollabLoad__scroll(){
 return window.DG_LOAD_OWNER_PARK_COLLABORATIONS.execute({
  getSelect:()=>$("dgInvPark"),isAuthenticated:()=>typeof USER!=="undefined"&&!!USER,
  hideCard:()=>window.DG_OWNER_PARK_OPTIONS_UI.setVisibility($("dgOwnerCollabCard"),false),
  showCard:()=>window.DG_OWNER_PARK_OPTIONS_UI.setVisibility($("dgOwnerCollabCard"),true),
  loadParks:dgMyParks,owned:dgOwnedParks,shared:dgSharedParks,
  updateOwnedCount:count=>dgInvSetCount("projOwnCount",count),updateSharedCount:count=>dgInvSetCount("projSharedCount",count),
  state:DG_PARK_INVITE_STATE_STORE,clearCollaborations:()=>dgInviteStateUpdate({invites:[],collabs:[]}),render:dgCollabRender,
  renderOptions:(parks,selected)=>window.DG_OWNER_PARK_OPTIONS_UI.render(parks,selected,esc),
  setEmptyOptions:(select,label)=>window.DG_OWNER_PARK_OPTIONS_UI.setEmpty(select,label),
  setOptions:(select,parks,selected)=>window.DG_OWNER_PARK_OPTIONS_UI.setOptions(select,parks,selected,esc),refresh:dgCollabRefresh
 });
}
async function dgCollabRefresh(){
 return window.DG_REFRESH_PARK_COLLABORATIONS.execute(DG_PARK_INVITE_STATE_STORE,{
  getSelect:()=>$("dgInvPark"),canManage:dgCanManagePark,
   load:parkId=>DG_PARK_INVITE_MODULE_STORE.collaborations(parkId),
  onMissingSchema:()=>dgInvitesNote("0025_park_invites.sql çalıştırılmalı (park_invites yok)"),render:dgCollabRender
 });
}
/* 0040: kaydırma koruma sarmalı. */
function dgCollabRender(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgCollabRender__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgCollabRender__scroll(){
 const box=$("dgInvList");if(!box)return;
 const sel=$("dgInvPark");
  window.DG_PARK_COLLABORATION_PANEL_UI.mount({element:box,invites:DG_INV.invites||[],collabs:DG_INV.collabs||[],selected:!!(sel&&sel.value),canManage:!!(sel&&sel.value&&dgCanManagePark(Number(sel.value))),escape:esc});
}
async function dgInviteSend(){
 const sel=$("dgInvPark"),em=$("dgInvEmail"),nt=$("dgInvNote");
 if(!sel||!sel.value)return toast(_tinv("Önce sahibi olduğun projeyi seç."),"err","👥");
 if(!dgCanManagePark(Number(sel.value)))return toast(_tinv("Davet yetkisi yalnız proje sahibinde."),"err","👥");
 const email=(em&&em.value||"").trim();
 if(!email)return toast("E-posta gir.","err","👥");
 return window.DG_MANAGE_PARK_INVITES.send({parkId:Number(sel.value),email,note:(nt&&nt.value)||null},{store:DG_PARK_INVITE_MODULE_STORE,
  onFailure:error=>toast(dgCf("Davet gönderilemedi: ")+(error.message||"").slice(0,110),"err","👥"),
  onSuccess:()=>{if(em)em.value="";if(nt)nt.value="";toast("Davet açıldı — arkadaşın giriş yaptığında 📬 kartını görecek ✉️","ok","👥");dgCollabRefresh();}
 });
}

async function dgInviteRevoke(target,kind){
 const sel=$("dgInvPark");
 if(!sel||!sel.value)return;
 if(!dgCanManagePark(Number(sel.value)))return toast(_tinv("Ekip yönetimi yalnız proje sahibinde."),"err","👥");
 return window.DG_MANAGE_PARK_INVITES.revoke({parkId:Number(sel.value),target,kind},{store:DG_PARK_INVITE_MODULE_STORE,
  onFailure:error=>toast(dgCf("İşlenemedi: ")+(error.message||"").slice(0,90),"err","👥"),
  onSuccess:acceptedKind=>toast(acceptedKind==="collab"?"Ortak kaldırıldı":"Davet geri alındı","ok","👥"),
  onComplete:()=>{dgInviteStateUpdate({mine:null});dgCollabRefresh();}
 });
}

function dgInvitesNote(msg){
 const box=$("dgInvList");
  window.DG_PARK_COLLABORATION_PANEL_UI.prependNotice(box,msg,esc);
}

async function dgParkLeaveProject(projectId){
 const project=(typeof PROJ_LIST!=="undefined"?PROJ_LIST:[]).find(row=>row.shared&&Number(row.id)===Number(projectId));
 if(!project?.park_id)return;
 return window.DG_MANAGE_PARK_INVITES.leave(Number(project.park_id),{
  authenticated:()=>!!USER,store:DG_PARK_INVITE_MODULE_STORE,
  confirm:()=>window.confirm(_tinv("Bu parkın ortak çalışmasından ayrılmak istiyor musunuz? Parktaki tüm paylaşılan projelere erişiminiz kapanır. Kendi ölçümleriniz silinmez; yeniden katılmak için yeni davet gerekir.")),
  onUnauthenticated:()=>toast(_tinv("Önce giriş yap."),"err"),
  onFailure:error=>toast(_tinv("Ortak çalışmadan ayrılamadınız: ")+String(error.message||error),"err"),
  onSuccess:async()=>{dgInviteStateUpdate({mine:null});await loadProjects();await dgInvitesLoadMine();await dgCollabLoad();toast(_tinv("Ortak çalışmadan ayrıldınız. Ölçümleriniz korunuyor."),"ok");}
 });
}
