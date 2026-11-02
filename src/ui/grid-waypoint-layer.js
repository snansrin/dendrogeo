"use strict";

/* Numbered field pins; edits are explicit and never touch measurement rows. */
function dgRenderGridWaypointLayer({map,previousLayer,rows,leaflet,onSave,editable=true}){
  if(previousLayer&&map){map.removeLayer(previousLayer);if(previousLayer.dgEditControl)map.removeControl(previousLayer.dgEditControl);}
  const layer=leaflet.layerGroup().addTo(map),markers=[];
  let editing=false;
  if(!rows?.length)return layer;
  const control=leaflet.control({position:"topright"});
  control.onAdd=()=>{
    const box=leaflet.DomUtil.create("div","leaflet-bar dg-nokta-edit-control");
    const button=leaflet.DomUtil.create("button","dg-png-btn sm",box);button.type="button";button.textContent="📍 Noktaları düzenle";
    button.setAttribute("aria-pressed","false");button.title="Ölçümü olmayan waypointleri taşıyın veya yeniden numaralandırın";button.disabled=!editable;
    if(!editable)button.textContent="🔒 Noktalar salt okunur";
    leaflet.DomEvent.disableClickPropagation(box);leaflet.DomEvent.disableScrollPropagation(box);
    button.addEventListener("click",()=>{editing=!editing;button.setAttribute("aria-pressed",String(editing));button.classList.toggle("primary",editing);button.textContent=editing?"✓ Düzenlemeyi bitir":"📍 Noktaları düzenle";for(const item of markers)if(item.editable){editing?item.marker.dragging.enable():item.marker.dragging.disable();}});
    return box;
  };
  control.addTo(map);
  layer.dgEditControl=control;
  rows.forEach(row=>{
    const editableRow=editable&&!row.hasMeasurement&&!row.visited;
    const icon=leaflet.divIcon({className:"",html:`<div class="wp-badge2 ${row.visited?"done":""}" style="--wpbg:${row.visited?"#16a34a":"#e11d48"}"><span>${Number(row.wp_id)}</span></div>`,iconSize:[28,28],iconAnchor:[14,24]});
    const marker=leaflet.marker([Number(row.lat),Number(row.lon)],{icon,draggable:false,keyboard:true,title:`P${Number(row.wp_id)}${editableRow?" · düzenlenebilir":" · sabit"}`}).addTo(layer);
    marker.bindTooltip(`P${Number(row.wp_id)}${row.visited?" · ✓ Ölçüm yapıldı":""}`,{direction:"top",offset:[0,-22]});
    if(editableRow){
      marker.dragging.disable();
      marker.on("click",()=>{
        if(!editing)return;
        const form=document.createElement("form"),label=document.createElement("label"),input=document.createElement("input"),save=document.createElement("button"),note=document.createElement("small");
        form.className="dg-nokta-edit-form";label.textContent="Nokta numarası";input.type="number";input.min="1";input.step="1";input.required=true;input.value=String(row.wp_id);input.setAttribute("aria-label","Nokta numarası");
        save.type="submit";save.className="dg-png-btn primary sm";save.textContent="Kaydet";note.textContent="Ölçümü olan noktalar sabittir.";form.append(label,input,save,note);
        form.addEventListener("submit",async event=>{
          event.preventDefault();const next=Number(input.value);if(!Number.isSafeInteger(next)||next<1){input.focus();return;}
          save.disabled=true;
          try{
            const p=marker.getLatLng();await onSave({id:row.id,projectId:row.project_id,oldWpId:Number(row.wp_id),wpId:next,lat:p.lat,lon:p.lng});
            row.wp_id=next;const nextIcon=leaflet.divIcon({className:"",html:`<div class="wp-badge2 ${row.visited?"done":""}" style="--wpbg:${row.visited?"#16a34a":"#e11d48"}"><span>${next}</span></div>`,iconSize:[28,28],iconAnchor:[14,24]});marker.setIcon(nextIcon);marker.setTooltipContent(`P${next}${row.visited?" · ✓ Ölçüm yapıldı":""}`);marker.closePopup();
          }catch(error){save.disabled=false;note.textContent="Kaydedilemedi: "+(error.message||"İzin veya bağlantıyı kontrol edin.");}
        });marker.bindPopup(form).openPopup();
      });
      marker.on("dragend",async()=>{
        const p=marker.getLatLng(),button=control.getContainer()?.querySelector("button");
        try{await onSave({id:row.id,projectId:row.project_id,oldWpId:Number(row.wp_id),wpId:Number(row.wp_id),lat:p.lat,lon:p.lng});row.lat=p.lat;row.lon=p.lng;}
        catch(error){marker.setLatLng([row.lat,row.lon]);window.alert("Nokta kaydedilemedi: "+(error.message||"İzin veya bağlantıyı kontrol edin."));}
        if(button)button.focus({preventScroll:true});
      });
    }
    markers.push({marker,editable:editableRow});
  });
  return layer;
}

window.DG_GRID_WAYPOINT_LAYER=Object.freeze({render:dgRenderGridWaypointLayer});


