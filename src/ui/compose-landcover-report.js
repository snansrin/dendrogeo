"use strict";

/* Compose the stable report shell from independently testable view pieces. */
window.DG_LANDCOVER_REPORT_COMPOSER={
  compose({metadata,rows}){
    return metadata.heading+"<div style='margin:6px 0 4px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg)'>"+rows+"</div>"+metadata.mask+metadata.coverage+metadata.sources+
      "<div style='display:flex;gap:7px;flex-wrap:wrap;margin-top:10px'><button class='btn sm ghost' onclick='downloadLandCoverClassCSV()'>📥 Sınıf CSV</button><button class='btn sm ghost' onclick='downloadLandCoverCellsGeoJSON()'>📍 Hücre GeoJSON</button></div>";
  }
};
