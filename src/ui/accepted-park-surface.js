"use strict";
/* A read-only map layer; never imports another account's editable review record. */
(function(root){
 function create({load,getMap,leaflet,escape,translate}){
  let epoch=0,layer=null,currentHost=null;
  function clear(){epoch++;if(layer)getMap()?.removeLayer(layer);layer=null;if(currentHost){currentHost.hidden=true;currentHost.replaceChildren();}currentHost=null;}
  async function show({parkId,host,outer,holes,isCurrent}){
   clear();const job=epoch;if(!parkId||!host)return;
   try{
    const result=await load(parkId);
    if(job!==epoch||!isCurrent()||!host.isConnected)return;
    if(!result||result.schema!=="dendrogeo-surface/2"||String(result.parkId)!==String(parkId)||!Array.isArray(result.features)||!result.acceptedAt)return;
    if(JSON.stringify(result.outer)!==JSON.stringify(outer)||JSON.stringify(result.holes||[])!==JSON.stringify(holes||[]))return;
    const colors={green:"#22c55e",hard:"#64748b",building:"#475569",water:"#3b82f6",bare:"#8b5a2b"};
    const labels={green:"Yeşil alan",hard:"Sert zemin",building:"Bina",water:"Su",bare:"Çıplak zemin"};
    currentHost=host;host.hidden=false;
    host.innerHTML='<b>'+escape(translate("Kayıtlı park haritası"))+'</b><p class="dg-meta">'+escape(translate("Yetkili incelemesiyle kaydedilmiş yüzey haritası. Yeni analiz ayrı bir önizleme oluşturur."))+'</p><div class="project-card-meta">'+Object.keys(labels).map(key=>'<span>'+escape(translate(labels[key]))+' · '+escape((Number(result.areas?.[key]||0)/10000).toFixed(3))+' ha</span>').join('')+'</div>';
    layer=leaflet.geoJSON({type:"FeatureCollection",features:result.features},{interactive:false,style:feature=>({stroke:false,fillColor:colors[feature.properties?.class]||"#94a3b8",fillOpacity:.78,interactive:false})}).addTo(getMap());
    return result;
   }catch(error){if(job===epoch&&isCurrent()){host.hidden=false;host.textContent=translate("Kayıtlı park haritası yüklenemedi. Yeni analiz başlatabilirsiniz.");currentHost=host;}}
  }
  return Object.freeze({show,clear});
 }
 root.DG_ACCEPTED_PARK_SURFACE_UI=Object.freeze({create});
})(window);
