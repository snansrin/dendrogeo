"use strict";

/* Render the transient visitor roster; access, filtering and map state stay in the service. */
(function(root){
 function render(box,rows,{state="idle",allCount=rows.length,viewLabels={},actionLabels={},hasLocation=()=>false,deviceLabel=row=>row.p.dev,translate=value=>value,escape=value=>String(value)}={}){
  if(!box)return;
  if(!rows.length){
   const stt=state;
   box.textContent=stt==="on"?translate(allCount?"Seçili filtrelere uyan kullanıcı yok. Filtreleri temizleyebilirsiniz.":"Şu an bağlı kullanıcı yok.")
    :stt==="connecting"?translate("⏳ gerçek zamanlı katmana bağlanılıyor…")
    :translate("Canlı bağlantı yeniden kuruluyor. Yenile düğmesiyle tekrar bağlanabilirsiniz.");
  }else{
   box.innerHTML=rows.map(r=>{
    const device=deviceLabel(r);
    const lbl=(viewLabels[r.p.v]||r.p.v||"?");
    const ageTxt=r.age<60?r.age+" "+translate("sn"):Math.round(r.age/60)+" "+translate("dk");
    const hasLoc=hasLocation(r.p);
    const role=r.p.r==="owner"?"KURUCU":(r.p.r==="admin"?"DENETÇİ":"KULLANICI");
    const rc=r.p.r==="owner"?"on":(r.p.r==="admin"?"admin":"off");
    const ses=r.p.st?Math.max(0,Math.round((Date.now()-r.p.st)/60000)):null;
    const chain=(Array.isArray(r.p.vh)?r.p.vh:[]).slice(-3).map(h=>escape(translate(viewLabels[h.v]||h.v))).join(" → ");
    const actTxt=r.p.act?translate(actionLabels[r.p.act.k]||r.p.act.k)+(r.p.act.d?" · "+escape(r.p.act.d):""):"";
    return '<div class="dg-vis-person" style="padding:6px 0;border-bottom:1px solid var(--line)'+(hasLoc?";cursor:pointer":"")+'"'+
     (hasLoc?' onclick="dgVisFocus('+Number(r.p.la)+','+Number(r.p.lo)+')" title="'+translate("Haritada odaklan")+'"':'')+'>'+
     '<div style="display:flex;gap:8px;align-items:center">'+
     '<span style="width:9px;height:9px;border-radius:50%;background:var(--green);flex:0 0 auto"></span>'+
     '<b>'+escape(r.p.n||"?")+'</b>'+(r.p.hidden||r.age>120?'<span class="badge off">ARKA PLAN</span>':'')+
     '<span class="badge '+rc+'" style="font-size:.6rem">'+role+'</span>'+
     '<span style="color:var(--mut)">· '+escape(translate(lbl))+(hasLoc?" 📍":"")+'</span>'+
     '<span class="dg-meta" style="margin-left:auto;white-space:nowrap">'+ageTxt+" "+translate("önce")+'</span></div>'+
     '<div class="dg-meta" style="margin:3px 0 0 17px">'+
     (device?"🖥 "+escape(device)+" · ":"")+
     (ses!=null?translate("oturum")+" "+ses+" "+translate("dk")+" · ":"")+
     (chain?translate("gezinti")+": "+chain:"")+
     (actTxt?" · "+translate("son eylem")+": "+actTxt:"")+
     (r.p.lh&&r.p.lh.length>1?" · 🧭 "+translate("iz")+" ("+r.p.lh.length+")":"")+
     '</div></div>';
   }).join("");
  }
 }
 root.DG_VISITOR_ROSTER_UI=Object.freeze({render});
})(window);
