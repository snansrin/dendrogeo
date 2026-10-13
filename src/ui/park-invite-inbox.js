"use strict";
(function(root){
 function sharedBanner(parks,escape){
  return '<div class="project-member-banner-icon">🤝</div><div><b>Ortak çalışma erişimin var</b><span>'+parks.map(park=>escape(park.name)+(park.city?" · "+escape(park.city):"")).join(" · ")+'</span><small>Bu projelerde ölçüm girebilirsin. Proje düzenleme, ekip daveti ve erişim yönetimi proje sahibinde kalır.</small></div>';
 }
 function invites(rows,escape){
  return '<div class="project-section-head"><div><span class="project-step">📬</span><div><h3>Sana gelen davetler</h3><p>Burada yalnız sana gönderilen çalışma davetleri görünür.</p></div></div><span class="badge admin">DAVET EDİLEN</span></div>'+
   '<div class="project-invite-list">'+rows.map(row=>`<article class="project-invite-item"><div class="project-invite-main"><b>🌳 ${escape(row.parks&&row.parks.name?row.parks.name:("Park #"+row.park_id))}</b><span>${row.parks&&row.parks.city?escape(row.parks.city):""}</span>${row.note?`<small>Not: ${escape(row.note)}</small>`:""}</div><div class="project-invite-meta"><span class="mono">${new Date(row.created_at).toLocaleDateString("tr-TR")}</span><div><button class="btn sm" onclick="dgInviteRespond('${row.id}',true)">✓ Kabul et</button><button class="btn sm ghost" onclick="dgInviteRespond('${row.id}',false)">Reddet</button></div></div></article>`).join("")+'</div>';
 }
 root.DG_PARK_INVITE_INBOX_UI=Object.freeze({sharedBanner,invites});
})(window);
