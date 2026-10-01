"use strict";
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
async function dgInvitesLoadMine(){
 const box=$("dgInvBox");
 if(box)box.style.display="none";
 if(typeof USER==="undefined"||!USER){const s=$("dgSharedBox");if(s)s.style.display="none";return;}
 const me=String((PROFILE&&PROFILE.email)||USER.email||"").toLowerCase();
 let rows=[];
 try{
  const{data,error}=await sb.from("park_invites").select("id,park_id,email,note,status,created_at,parks(id,name,city)").eq("status","Beklemede");
  if(!error)rows=(data||[]).filter(r=>String(r.email||"").toLowerCase()===me);
 }catch(e){/* tablo yok (0025 uygulanmamış) → sessiz: kart gizli kalır */}
 /* Paylaşılan parklar kutusu (kabul edilmiş üyelikler) */
 const shared=(await dgMyParks()).filter(p=>p.role==="collaborator");
 const sbox=$("dgSharedBox");
 if(sbox){
  if(shared.length){
   sbox.style.display="";
   sbox.innerHTML="<b>🌳 Paylaşılan parkların:</b> "+shared.map(p=>esc(p.name)+(p.city?" ("+esc(p.city)+")":"")).join(", ")+
    " <span style=\"font-size:.8rem\">— ölçüm sekmesindeki proje listesinde görünüyorlar; kayıtların <b>kendi adınla</b> girer, park sahibi onaylar.</span>";
  }else sbox.style.display="none";
 }
 if(!rows.length)return;
 if(box){
  box.style.display="";
  box.innerHTML='<div class="shead" style="margin-bottom:8px"><span class="no">📬</span><h2 style="font-size:1.05rem">Park davetlerin</h2><span class="rule"></span></div>'+
   rows.map(r=>`<div class="alert info" style="margin:6px 0">🌳 <b>${esc(r.parks&&r.parks.name?r.parks.name:("park #"+r.park_id))}</b> parkına çalışma arkadaşı davetin var${r.note?` · not: <i>${esc(r.note)}</i>`:""} <span class="mono" style="font-size:.72rem">(${new Date(r.created_at).toLocaleDateString("tr-TR")})</span>`+
    ` <span style="display:inline-flex;gap:6px;margin-left:6px"><button class="btn sm" onclick="dgInviteRespond('${r.id}',true)">✓ Kabul</button>`+
    `<button class="btn sm red" onclick="dgInviteRespond('${r.id}',false)">✖ Reddet</button></span></div>`).join("");
 }
}

async function dgInviteRespond(id,accept){
 if(typeof USER==="undefined"||!USER)return toast("Önce giriş yap.","err","📬");
 const{error}=await sb.rpc("dg_invite_respond",{p_invite:id,p_accept:!!accept});
 if(error){toast("İşlenemedi: "+(error.message||"").slice(0,90),"err","📬");return;}
 toast(accept?"Davet kabul edildi — proje listene bak 🌳":"Davet reddedildi","ok","📬");
 if(accept){
  DG_INV.mine=null;                       // ortak park listesi tazelensin
  if(typeof loadProjects==="function")loadProjects();
 }
 dgInvitesLoadMine();
}

/* ---------------- 👥 ÇALIŞMA ARKADAŞLARI (Yönetim sekmesi · sahip/admin) ---------------- */
async function dgCollabLoad(){
 const sel=$("dgInvPark");
 if(!sel)return;
 if(typeof USER==="undefined"||!USER){sel.innerHTML='<option value="">Giriş gerekli</option>';return;}
 const parks=await dgMyParks(true);
 if(!parks.length){sel.innerHTML='<option value="">Paylaşılabilecek parkın yok</option>';dgCollabRender();return;}
 const keep=sel.value;
 sel.innerHTML=parks.map(p=>`<option value="${p.id}">${esc(p.name)}${p.city?" ("+esc(p.city)+")":""}${p.role==="collaborator"?" · ortak":""}</option>`).join("");
 if(keep&&[...sel.options].some(o=>o.value===keep))sel.value=keep;
 await dgCollabRefresh();
}

async function dgCollabRefresh(){
 const sel=$("dgInvPark");if(!sel||!sel.value)return dgCollabRender();
 const pid=Number(sel.value);
 const[inv,col]=await Promise.all([
  sb.from("park_invites").select("id,email,note,status,created_at,invited_by").eq("park_id",pid).order("created_at",{ascending:false}).limit(50),
  sb.from("park_collaborators").select("user_id,added_at,profiles(id,full_name,email)").eq("park_id",pid).limit(50),
 ]);
 DG_INV.invites=inv.error?null:(inv.data||[]);
 DG_INV.collabs=col.error?null:(col.data||[]);
 if(inv.error&&/42P01|relation/i.test(inv.error.message||""))dgInvitesNote("0025_park_invites.sql çalıştırılmalı (park_invites yok)");
 dgCollabRender();
}

function dgCollabRender(){
 const box=$("dgInvList");if(!box)return;
 const sel=$("dgInvPark");
 if(!sel||!sel.value){box.innerHTML='<div class="alert info">Park seç — davetleri ve ortakları burada görürsün.</div>';return;}
 const inv=DG_INV.invites||[], col=DG_INV.collabs||[];
 const badge=s=>s==="Beklemede"?'<span class="badge admin">Bekliyor</span>':s==="Kabul"?'<span class="badge on">Kabul</span>':s==="Red"?'<span class="badge off">Red</span>':'<span class="badge off">İptal</span>';
 const invRows=inv.map(r=>`<tr><td>${esc(r.email)}</td><td>${badge(r.status)}</td><td class="mono dg-sub">${new Date(r.created_at).toLocaleDateString("tr-TR")}</td><td>${r.status==="Beklemede"?`<button class="btn sm red" onclick="dgInviteRevoke('${r.id}','invite')">Geri al</button>`:"—"}</td></tr>`).join("");
 const colRows=col.map(c=>{const p=c.profiles||{};return `<tr><td>${esc(p.full_name||"—")} <span class="mono dg-sub">${esc(p.email||c.user_id.slice(0,8))}</span></td><td class="mono dg-sub">${new Date(c.added_at).toLocaleDateString("tr-TR")}</td><td><button class="btn sm red" onclick="dgInviteRevoke('${c.user_id}','collab')">Kaldır</button></td></tr>`;}).join("");
 box.innerHTML=
  `<div class="grid g3" style="align-items:end;gap:8px;margin-bottom:10px">`+
   `<div><label class="lbl" for="dgInvEmail">Arkadaşın e-postası</label><input id="dgInvEmail" type="email" placeholder="ornek@eposta.com"></div>`+
   `<div><label class="lbl" for="dgInvNote">Not (opsiyonel)</label><input id="dgInvNote" placeholder="örn. cumartesi saha ölçümü"></div>`+
   `<div><button class="btn sm blue" onclick="dgInviteSend()">✉️ Davet gönder</button></div></div>`+
  `<div class="lbl">Ortaklar (${col.length})</div>`+
  (colRows?`<div class="tblwrap"><table><thead><tr><th scope='col'>Kişi</th><th scope='col'>Eklenme</th><th scope='col'>İşlem</th></tr></thead><tbody>${colRows}</tbody></table></div>`:'<div class="alert info">Henüz ortak yok.</div>')+
  `<div class="lbl" style="margin-top:10px">Davetler (${inv.length})</div>`+
  (invRows?`<div class="tblwrap"><table><thead><tr><th scope='col'>E-posta</th><th scope='col'>Durum</th><th scope='col'>Tarih</th><th scope='col'>İşlem</th></tr></thead><tbody>${invRows}</tbody></table></div>`:'<div class="alert info">Davet yok.</div>')+
  `<p class="mono dg-sub" style="margin-top:8px">Davet e-postası kimlik doğrulamaz; kabul yalnız arkadaşın KENDİ hesabıyla olur. Ortak ölçümleri kendi adıyla girer, konum çiti ve onay akışı aynen geçerlidir.</p>`;
}

async function dgInviteSend(){
 const sel=$("dgInvPark"),em=$("dgInvEmail"),nt=$("dgInvNote");
 if(!sel||!sel.value)return toast("Önce park seç.","err","👥");
 const email=(em&&em.value||"").trim();
 if(!email)return toast("E-posta gir.","err","👥");
 const{data,error}=await sb.rpc("dg_invite_send",{p_park:Number(sel.value),p_email:email,p_note:(nt&&nt.value)||null});
 if(error){toast("Davet gönderilemedi: "+(error.message||"").slice(0,110),"err","👥");return;}
 if(em)em.value="";if(nt)nt.value="";
 toast("Davet açıldı — arkadaşın giriş yaptığında 📬 kartını görecek ✉️","ok","👥");
 dgCollabRefresh();
}

async function dgInviteRevoke(target,kind){
 const sel=$("dgInvPark");
 if(!sel||!sel.value)return;
 const{error}=await sb.rpc("dg_invite_revoke",{p_park:Number(sel.value),p_target:target,p_kind:kind});
 if(error){toast("İşlenemedi: "+(error.message||"").slice(0,90),"err","👥");return;}
 toast(kind==="collab"?"Ortak kaldırıldı":"Davet geri alındı","ok","👥");
 DG_INV.mine=null;
 dgCollabRefresh();
}

function dgInvitesNote(msg){
 const box=$("dgInvList");
 if(box&&!box.innerHTML.includes(msg))box.innerHTML='<div class="alert warn">'+esc(msg)+'</div>'+box.innerHTML;
}
