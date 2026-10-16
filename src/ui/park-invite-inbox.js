"use strict";
(function(root){
 function sharedBanner(parks,escape){
  return '<div class="project-member-banner-icon">🤝</div><div><b>Ortak çalışma erişimin var</b><span>'+parks.map(park=>escape(park.name)+(park.city?" · "+escape(park.city):"")).join(" · ")+'</span><small>Bu projelerde ölçüm girebilirsin. Proje düzenleme, ekip daveti ve erişim yönetimi proje sahibinde kalır.</small></div>';
 }
 function invites(rows,escape){
  return '<div class="project-section-head"><div><span class="project-step">📬</span><div><h3>Sana gelen davetler</h3><p>Burada yalnız sana gönderilen çalışma davetleri görünür.</p></div></div><span class="badge admin">DAVET EDİLEN</span></div>'+
   '<div class="project-invite-list">'+rows.map(row=>`<article class="project-invite-item"><div class="project-invite-main"><b translate="no">🌳 ${escape(row.parks&&row.parks.name?row.parks.name:("Park #"+row.park_id))}</b><span>${row.parks&&row.parks.city?escape(row.parks.city):""}</span>${row.note?`<small><span>Not:</span> <span translate="no">${escape(row.note)}</span></small>`:""}</div><div class="project-invite-meta"><span class="mono">${new Date(row.created_at).toLocaleDateString("tr-TR")}</span><div><button class="btn sm" data-dg-park-invites-action="respond" data-invite-id="${escape(String(row.id))}" data-accept="true">✓ Kabul et</button><button class="btn sm ghost" data-dg-park-invites-action="respond" data-invite-id="${escape(String(row.id))}" data-accept="false">Reddet</button></div></div></article>`).join("")+'</div>';
 }
 function hide(element){if(element)element.style.display="none";}
 function show(element){if(element)element.style.display="";}
 function setCount(getElement,id,value){const element=getElement(id);if(element)element.textContent=String(Number(value)||0);}
 function resetRecipient(getElement){
  hide(getElement("dgInvBox"));hide(getElement("dgSharedBox"));
  for(const id of ["projInviteCount","projSharedCount"]){const count=getElement(id);if(count)count.textContent="0";}
 }
 function presentRecipient({getElement,rows,shared,escape}){
  const inviteBox=getElement("dgInvBox"),sharedBox=getElement("dgSharedBox");
  const inviteCount=getElement("projInviteCount"),sharedCount=getElement("projSharedCount");
  if(inviteCount)inviteCount.textContent=String(rows.length);
  if(sharedCount)sharedCount.textContent=String(shared.length);
  hide(inviteBox);
  if(sharedBox){if(shared.length){show(sharedBox);sharedBox.innerHTML=sharedBanner(shared,escape);}else hide(sharedBox);}
  if(inviteBox&&rows.length){show(inviteBox);inviteBox.innerHTML=invites(rows,escape);}
 }
 root.DG_PARK_INVITE_INBOX_UI=Object.freeze({sharedBanner,invites,hide,show,setCount,resetRecipient,presentRecipient});
})(window);
