"use strict";
/* Build the same filtered, sorted and paged waypoint list presentation. */
(function(root){
  const bindings=new WeakSet(),actionsByElement=new WeakMap();
  function bindWaypointListActions(element,actions){
    if(!element||typeof element.addEventListener!=="function")return;
    actionsByElement.set(element,actions||{});
    if(bindings.has(element))return;
    bindings.add(element);
    element.addEventListener("click",event=>{
      const control=event.target?.closest?.("[data-waypoint-action]");
      if(!control||!element.contains(control))return;
      const handler=actionsByElement.get(element)?.[control.dataset.waypointAction];
      if(typeof handler==="function")handler(control);
    });
  }
  function render({waypoints,gps,projectId,search,filter,sort,page,signature,selectedId,distance,setPage,setSignature}){
    const done=waypoints.filter(point=>point.visited).length;
    const query=(search||"").trim().toLowerCase().replace(/^p/,"");
    const rows=waypoints.filter(point=>String(point.wp_id).includes(query)&&(filter==="all"||(filter==="done"?point.visited:!point.visited)));
    if(sort==="distance"&&gps)rows.sort((a,b)=>distance(gps.latitude,gps.longitude,a.lat,a.lon)-distance(gps.latitude,gps.longitude,b.lat,b.lon)||a.wp_id-b.wp_id);
    else rows.sort((a,b)=>a.wp_id-b.wp_id);
    const nextSignature=String(projectId)+":"+query+":"+filter+":"+(sort||"id");
    if(nextSignature!==signature){page=0;setSignature(nextSignature);}
    const pages=Math.max(1,Math.ceil(rows.length/8));
    page=Math.max(0,Math.min(pages-1,page));
    setPage(page);
    const visible=rows.slice(page*8,(page+1)*8);
    const pager=`<button type="button" class="btn sm ghost" data-waypoint-action="page" data-page-delta="-1" ${page===0?"disabled":""}>←</button><span>${rows.length?page*8+1:0}–${Math.min(rows.length,(page+1)*8)} / ${rows.length}</span><button type="button" class="btn sm ghost" data-waypoint-action="page" data-page-delta="1" ${page===pages-1?"disabled":""}>→</button>`;
    const html=rows.length?visible.map(point=>`<li class="waypoint-point ${point.visited?'done':''}"${selectedId===point.id?' aria-current="true"':''}><div class="waypoint-point-main"><b>P${Number(point.wp_id)}</b><span class="mono waypoint-distance">${gps?Math.round(distance(gps.latitude,gps.longitude,point.lat,point.lon))+" m":"—"}</span></div><div class="waypoint-point-actions"><span class="waypoint-state ${point.visited?'done':'pending'}">${point.visited?'✓ Yapıldı':'Bekliyor'}</span>${point.visited?'':`<button type="button" class="btn sm blue waypoint-target-btn" data-waypoint-action="select" data-waypoint-id="${Number(point.id)}">🎯 Hedef</button>`}</div></li>`).join(""):'<li class="waypoint-empty">'+(waypoints.length?"Aramaya uygun nokta yok.":(Number(projectId)?"Bu projede ölçüm noktası yok. CSV yükleyin.":"Önce proje seçin."))+"</li>";
    return{done,info:waypoints.length+" nokta · "+(waypoints.length-done)+" bekleyen · "+done+" tamamlanan",pager,html,page,signature:nextSignature};
  }
  function renderTo({getElement,actions,...input}){
    const result=render(input),waypoints=input.waypoints;
    getElement("dWp").textContent=waypoints.length;
    getElement("dVisit").textContent=result.done;
    getElement("navInfo").textContent=result.info;
    const pager=getElement("wpPager");if(pager)pager.innerHTML=result.pager;
    const list=getElement("wpListTable");list.innerHTML=result.html;
    const handlers={page:control=>actions?.page?.(Number(control.dataset.pageDelta)),select:control=>actions?.select?.(Number(control.dataset.waypointId))};
    bindWaypointListActions(pager,handlers);bindWaypointListActions(list,handlers);
    return result;
  }
  root.DG_WAYPOINT_LIST_UI=Object.freeze({render,renderTo,bind:bindWaypointListActions});
})(window);
