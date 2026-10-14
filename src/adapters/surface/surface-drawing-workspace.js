"use strict";
/* Leaflet and DOM lifecycle are isolated from persisted draft geometry. */
(function(root){
 let active=null;
 function stop(){if(!active)return;const a=active;active=null;a.map.off("mousemove",a.move);a.map.off("resize",a.dock);a.observer?.disconnect();a.document.removeEventListener("keydown",a.key);a.panel.remove();}
 function open(ports){
  if(active){active.update();return;}if(!ports.state.draw)return;
  const {state,map,leaflet,document,createMenu,buildShape,forward,inverse,render,apply,end,back,setType,translate,types}=ports;
  const container=map.getContainer(),ui=createMenu({document,types,translate});container.append(ui.panel);leaflet.DomEvent.disableClickPropagation(ui.panel);leaflet.DomEvent.disableScrollPropagation(ui.panel);
  let shape="polygon",first=null,last=null;
  const blocked=()=>state.rawView||state.busy||state.saving||state.exporting;
  const dock=()=>ui.dock(container);
  const update=()=>{ui.update({shape,type:state.draw?.type||state.drawType,ready:(state.draw?.ring.length||0)>=3,busy:blocked()});dock();};
  const geometry=point=>buildShape({shape,first,last:point,forward,inverse});
  const move=event=>{if(blocked()||!state.draw||!first||shape==="polygon")return;last=[event.latlng.lng,event.latlng.lat];state.draw.ring=geometry(last);render();update();};
  const reset=()=>{first=null;last=null;if(state.draw)state.draw.ring=[];render();update();};
  const point=event=>{if(!state.draw||blocked())return true;if(shape==="polygon"){setTimeout(update,0);return false;}const p=[event.latlng.lng,event.latlng.lat];if(!first){first=p;state.draw.ring=[p];render();update();return true;}last=p;state.draw.ring=geometry(p);render();update();if(state.draw.ring.length>=3)apply();return true;};
  const key=event=>{if(!state.draw||event.target.closest?.("input,select,textarea,button")||blocked())return;if(event.key==="Enter"){event.preventDefault();event.shiftKey?end():apply();}else if(event.key==="Backspace"){event.preventDefault();if(shape==="polygon")back();else reset();}};
  ui.panel.addEventListener("click",event=>{const button=event.target.closest("button");if(!button||blocked())return;if(button.dataset.shape){shape=button.dataset.shape;reset();return;}if(button.dataset.action==="apply")apply();if(button.dataset.action==="end")end();if(button.dataset.action==="back"){if(shape==="polygon")back();else reset();update();}});
  ui.select.addEventListener("change",()=>{setType(ui.select.value);render();update();});
  const observer=typeof root.ResizeObserver==="function"?new root.ResizeObserver(dock):null;observer?.observe(container);const rail=document.getElementById("surfaceMapTools");if(rail)observer?.observe(rail);
  active={map,document,panel:ui.panel,move,dock,observer,key,point,reset,update};map.on("mousemove",move);map.on("resize",dock);document.addEventListener("keydown",key);update();
 }
 root.DG_SURFACE_DRAWING_WORKSPACE=Object.freeze({open,stop,point:event=>active?active.point(event):false,reset:()=>active?.reset(),update:()=>active?.update()});
})(window);
