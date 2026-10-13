"use strict";

/* Existing park context shown above the project label form. */
window.DG_MEASUREMENT_PROJECT_PARK_BOX={
  render({box,park,escape,formatArea,getElement,previewName}){
    if(!box)return;
    if(park&&park.name){
      box.className="alert ok";
      box.innerHTML=`<b>🌳 Algılanan park: ${escape(park.name)}</b>${park.area_m2?" · "+formatArea(park.area_m2):""}${park.osm_key?` · <span class="mono" style="font-size:.72rem">${escape(park.osm_key)}</span>`:""}`+
        `<br><span style="font-size:.8rem">Proje adı otomatik "<b>${escape(park.name)}</b> - <i>etiket</i>" olacak. Aynı parkı başkaları da algıladığında veriler karşılaştırmada tek satırda birleşir.</span>`;
      if(park.city&&getElement("pCity")&&getElement("pCity").value==="Ankara")getElement("pCity").value=park.city;
      if(park.country&&getElement("pCountry")&&getElement("pCountry").value==="Türkiye")getElement("pCountry").value=park.country;
    }else{
      box.className="alert err";
      box.innerHTML='<b>⛔ Park algılanmadı — proje oluşturulamaz.</b><br><span style="font-size:.8rem">Önce Canlı Harita → Park Algılama ekranında parkın içine tıkla. OSM\'de park yoksa "elle oluştur" ile kimlik açabilirsin.</span><div style="margin-top:10px"><button class="btn sm blue" onclick="startParkScan({returnTo:\'projects\'})">🌳 Park Algılama Ekranına Git</button></div>';
    }
    previewName();
  }
};
