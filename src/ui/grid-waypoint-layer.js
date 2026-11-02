"use strict";

/* Numbered field pins; edits are explicit and never touch measurement rows. */
function dgRenderGridWaypointLayer({map,previousLayer,rows,leaflet,onSave,onCreate,editable=false,canInteract=()=>true}){
  previousLayer?.dgDispose?.();
  if(previousLayer&&map){map.removeLayer(previousLayer);if(previousLayer.dgEditControl)map.removeControl(previousLayer.dgEditControl);}
  const layer=leaflet.layerGroup().addTo(map),markers=[];
  let editing=false,adding=false,busy=false;
  const host=typeof document.getElementById==="function"?document.getElementById("dgWaypointEditor"):null;
  const button=document.createElement("button"),add=document.createElement("button"),status=document.createElement("p");
  button.type=add.type="button";button.className=add.className="dg-png-btn sm";status.className="dg-meta";status.setAttribute("role","status");
  button.disabled=!editable||typeof onSave!=="function";add.disabled=!editable||typeof onCreate!=="function";
  add.textContent="＋ Haritaya nokta ekle";
  function setEditing(value){editing=!!value&&editable;button.textContent=editing?"✓ Düzenlemeyi bitir":"📍 Noktaları düzenle";button.setAttribute("aria-pressed",String(editing));for(const item of markers)if(item.editable){editing&&!item.pending?item.marker.dragging.enable():item.marker.dragging.disable();}}
  function setAdding(value){adding=!!value&&editable&&!busy;add.setAttribute("aria-pressed",String(adding));add.textContent=adding?"✕ Nokta eklemeyi bitir":"＋ Haritaya nokta ekle";status.textContent=adding?"Haritada noktayı yerleştirmek istediğiniz yere tıklayın. Kaydedilen yeni noktayı sürükleyebilirsiniz.":"Ölçüm geçmişi bulunan noktalar sabittir.";}
  setEditing(false);setAdding(false);
  const available=()=>{if(canInteract())return true;status.textContent="Önce açık çizim veya fırça işlemini bitirin.";return false;};
  button.addEventListener("click",()=>{if(!available())return;setAdding(false);setEditing(!editing);});
  add.addEventListener("click",()=>{if(!available())return;setEditing(false);setAdding(!adding);const menu=host?.closest("details");if(adding&&menu)menu.open=false;});
  host?.replaceChildren(button,add,status);
  const capture=async event=>{
    if(!adding||event.target.closest?.(".leaflet-control,.leaflet-marker-icon,.leaflet-popup"))return;
    if(!canInteract()){setAdding(false);available();return;}
    event.preventDefault();event.stopImmediatePropagation();if(busy)return;busy=true;add.disabled=button.disabled=true;
    try{const position=map.mouseEventToLatLng(event),row=await onCreate({lat:position.lat,lon:position.lng});rows.push(row);drawRow(row);setEditing(true);status.textContent="Yeni nokta kaydedildi: P"+row.wp_id+". Sürükleyerek yerini değiştirebilirsiniz.";}
    catch(error){status.textContent="Nokta eklenemedi: "+(error.message||"İzin veya bağlantıyı kontrol edin.");}
    finally{busy=false;adding=false;add.setAttribute("aria-pressed","false");add.textContent="＋ Haritaya nokta ekle";add.disabled=!editable;button.disabled=!editable;}
  };
  const container=map.getContainer?.(),attach=()=>{container?.addEventListener("click",capture,true);document.addEventListener?.("keydown",key);button.disabled=!editable||typeof onSave!=="function";add.disabled=!editable||typeof onCreate!=="function";};
  const detach=()=>{setAdding(false);setEditing(false);container?.removeEventListener("click",capture,true);document.removeEventListener?.("keydown",key);button.disabled=add.disabled=true;};
  const key=event=>{if(event.key==="Escape"){setAdding(false);setEditing(false);}};
  attach();layer.on?.("add",attach);layer.on?.("remove",detach);
  layer.dgDispose=()=>{detach();layer.off?.("add",attach);layer.off?.("remove",detach);document.removeEventListener?.("keydown",key);};
  layer.setEditing=setEditing;
  layer.isEditing=()=>editing||adding||busy;
  function drawRow(row){
    const editableRow=editable&&!row.hasMeasurement&&!row.visited;
    const icon=leaflet.divIcon({className:"",html:`<div class="wp-badge2 ${row.visited?"done":""}" style="--wpbg:${row.visited?"#16a34a":"#e11d48"}"><span>${Number(row.wp_id)}</span></div>`,iconSize:[28,28],iconAnchor:[14,24]});
    const marker=leaflet.marker([Number(row.lat),Number(row.lon)],{icon,draggable:false,keyboard:true,title:`P${Number(row.wp_id)}${editableRow?" · düzenlenebilir":" · sabit"}`}).addTo(layer);
    const item={marker,editable:editableRow,pending:false};
    marker.bindTooltip(`P${Number(row.wp_id)}${row.visited?" · ✓ Ölçüm yapıldı":""}`,{direction:"top",offset:[0,-22]});
    if(editableRow){
      marker.dragging.disable();
      marker.on("click",()=>{
        if(!editing||item.pending)return;
        const form=document.createElement("form"),label=document.createElement("label"),input=document.createElement("input"),save=document.createElement("button"),note=document.createElement("small");
        form.className="dg-nokta-edit-form";label.textContent="Nokta numarası";input.type="number";input.min="1";input.step="1";input.required=true;input.value=String(row.wp_id);input.setAttribute("aria-label","Nokta numarası");
        save.type="submit";save.className="dg-png-btn primary sm";save.textContent="Kaydet";note.textContent="Ölçümü olan noktalar sabittir.";form.append(label,input,save,note);
        form.addEventListener("submit",async event=>{
          event.preventDefault();if(item.pending)return;const next=Number(input.value);if(!Number.isSafeInteger(next)||next<1){input.focus();return;}
          save.disabled=true;item.pending=true;marker.dragging.disable();
          try{
            const p=marker.getLatLng();await onSave({id:row.id,projectId:row.project_id,oldWpId:Number(row.wp_id),wpId:next,lat:p.lat,lon:p.lng});
            row.wp_id=next;const nextIcon=leaflet.divIcon({className:"",html:`<div class="wp-badge2 ${row.visited?"done":""}" style="--wpbg:${row.visited?"#16a34a":"#e11d48"}"><span>${next}</span></div>`,iconSize:[28,28],iconAnchor:[14,24]});marker.setIcon(nextIcon);marker.setTooltipContent(`P${next}${row.visited?" · ✓ Ölçüm yapıldı":""}`);marker.closePopup();
            marker.options.title=`P${next} · düzenlenebilir`;marker.getElement?.()?.setAttribute("title",marker.options.title);
          }catch(error){save.disabled=false;note.textContent="Kaydedilemedi: "+(error.message||"İzin veya bağlantıyı kontrol edin.");}
          finally{item.pending=false;if(editing)marker.dragging.enable();}
        });marker.bindPopup(form).openPopup();
      });
      marker.on("dragend",async()=>{
        if(item.pending)return;item.pending=true;const element=marker.getElement?.();if(element)element.style.pointerEvents="none";
        const p=marker.getLatLng();
        try{await onSave({id:row.id,projectId:row.project_id,oldWpId:Number(row.wp_id),wpId:Number(row.wp_id),lat:p.lat,lon:p.lng});row.lat=p.lat;row.lon=p.lng;}
        catch(error){marker.setLatLng([row.lat,row.lon]);window.alert("Nokta kaydedilemedi: "+(error.message||"İzin veya bağlantıyı kontrol edin."));}
        finally{item.pending=false;if(element)element.style.pointerEvents="";}
        if(button)button.focus({preventScroll:true});
      });
    }
    markers.push(item);
  }
  rows.forEach(drawRow);
  return layer;
}

window.DG_GRID_WAYPOINT_LAYER=Object.freeze({render:dgRenderGridWaypointLayer});


