"use strict";

/* Compose the stable report shell from independently testable view pieces. */
window.DG_LANDCOVER_REPORT_COMPOSER=(()=>{
  const bindings=new WeakSet(),actionsByElement=new WeakMap();
  function bind(element,actions){
    if(!element||typeof element.addEventListener!=="function")return;
    actionsByElement.set(element,actions||{});if(bindings.has(element))return;bindings.add(element);
    element.addEventListener("click",event=>{
      const button=event.target?.closest?.("[data-landcover-report-action]");if(!button||!element.contains(button))return;
      const handlers=actionsByElement.get(element)||{};
      if(button.dataset.landcoverReportAction==="classCsv")handlers.classCsv?.();
      else if(button.dataset.landcoverReportAction==="cellsGeojson")handlers.cellsGeojson?.();
    });
  }
  function compose({metadata,rows}){
    return metadata.heading+"<div style='margin:6px 0 4px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg)'>"+rows+"</div>"+metadata.mask+metadata.coverage+metadata.sources+
      "<div style='display:flex;gap:7px;flex-wrap:wrap;margin-top:10px'><button class='btn sm ghost' data-landcover-report-action='classCsv'>📥 Sınıf CSV</button><button class='btn sm ghost' data-landcover-report-action='cellsGeojson'>📍 Hücre GeoJSON</button></div>";
  }
  return Object.freeze({compose,bind});
})();
