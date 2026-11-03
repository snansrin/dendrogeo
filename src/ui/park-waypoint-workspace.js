"use strict";
/* Park-scoped planning points. This workspace has no database write port. */
(function(root){
 function create(ports){
  const plans=new Map();let active=null,layer=null,serial=0;
  const identity=()=>ports.key();
  function rows(){return active===identity()?plans.get(active)||[]:[];}
  function current(key){if(key!==identity()||!ports.canInteract())throw Error("Park değişti veya başka bir harita işlemi sürüyor.");}
  function nextNumber(list){let n=0;for(const row of list)n=Math.max(n,Number(row.wp_id)||0);return n+1;}
  function row(position,list){return{id:"park-draft-"+(++serial),draft:true,wp_id:nextNumber(list),lat:Number(position.lat),lon:Number(position.lon),visited:false,hasMeasurement:false};}
  function mount(){
   const key=identity();if(!key){if(layer){ports.removeLayer(layer);layer.dgDispose?.();}layer=null;active=null;return;}
   if(active===key&&layer){layer.dgMountControls?.();return;}
   if(layer){ports.removeLayer(layer);layer.dgDispose?.();}
   active=key;if(!plans.has(key))plans.set(key,[]);const list=plans.get(key);
   layer=ports.render({rows:list,editable:true,canInteract:ports.canInteract,onCreate:async position=>{current(key);return row(position,list);},onSave:async change=>{
    current(key);const point=list.find(item=>item.id===change.id);if(!point||point.visited||point.hasMeasurement)throw Error("Bu nokta taslağa ait değil veya ölçülmüş.");
    if(list.some(item=>item!==point&&Number(item.wp_id)===Number(change.wpId)))throw Error("Nokta numarası zaten kullanılıyor.");
   }});
  }
  function addGrid(mode){
   mount();const key=active;current(key);const input=ports.grid();
   if(!input.cells.length)throw Error("Önce grid oluşturun.");
   if(!input.current)throw Error("Yüzey değişti; önce gridi yeniden oluşturun.");
   const targets=ports.selectCells(input.cells,mode,input.selection);if(!targets.length)throw Error("Uygun veya seçilmiş hücre yok.");
   const list=rows(),batch=ports.buildRows(targets,nextNumber(list),null,null);
   for(const point of batch)list.push({...point,id:"park-draft-"+(++serial),draft:true,hasMeasurement:false});
   layer?.dgDispose?.();if(layer)ports.removeLayer(layer);layer=null;mount();ports.changed?.();return batch.length;
  }
  function suspend(){if(layer){ports.removeLayer(layer);layer.dgDispose?.();}layer=null;active=null;}
  function setVisible(value){if(!layer)return;if(value)ports.addLayer(layer);else ports.removeLayer(layer);}
  return Object.freeze({mount,rows,addGrid,suspend,setVisible});
 }
 root.DG_PARK_WAYPOINT_WORKSPACE_UI=Object.freeze({create});
})(window);
