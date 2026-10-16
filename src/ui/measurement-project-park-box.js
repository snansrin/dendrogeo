"use strict";

/* Existing park context shown above the project label form. */
window.DG_MEASUREMENT_PROJECT_PARK_BOX=(()=>{
  const bindings=new WeakSet(),actionsByBox=new WeakMap();
  function bind(box,actions){if(!box||typeof box.addEventListener!=="function")return;actionsByBox.set(box,actions||{});if(bindings.has(box))return;bindings.add(box);box.addEventListener("click",event=>{const button=event.target?.closest?.('[data-project-park-action="scan"]');if(button&&box.contains(button))actionsByBox.get(box)?.scan?.();});}
  function render({box,park,escape,formatArea,getElement,previewName,actions}){
    if(!box)return;
    bind(box,actions);
    if(park&&park.name){
      box.className="alert ok";
      box.innerHTML=`<b><span>🌳 Algılanan park:</span> <span translate="no">${escape(park.name)}</span></b>${park.area_m2?" · "+formatArea(park.area_m2):""}${park.osm_key?` · <span class="mono" style="font-size:.72rem">${escape(park.osm_key)}</span>`:""}`+
        `<br><span style="font-size:.8rem"><span>Proje adı:</span> <b translate="no">${escape(park.name)}</b> · <i>etiket</i><br><span>Aynı parkın çalışmaları ortak park kimliğiyle karşılaştırılır.</span></span>`;
      if(park.city&&getElement("pCity")&&getElement("pCity").value==="Ankara")getElement("pCity").value=park.city;
      if(park.country&&getElement("pCountry")&&getElement("pCountry").value==="Türkiye")getElement("pCountry").value=park.country;
    }else{
      box.className="alert err";
      box.innerHTML='<b>⛔ Park algılanmadı — proje oluşturulamaz.</b><br><span style="font-size:.8rem">Önce Canlı Harita → Park Algılama ekranında parkın içine tıkla. OSM\'de park yoksa "elle oluştur" ile kimlik açabilirsin.</span><div style="margin-top:10px"><button class="btn sm blue" data-project-park-action="scan">🌳 Park Algılama Ekranına Git</button></div>';
    }
    previewName();
  }
  return Object.freeze({render,bind});
})();
