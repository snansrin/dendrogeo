"use strict";
/* DendroGeo · adapters/surface/result-exports.js
 * Serializes the stable land-cover result DTO into CSV and GeoJSON.
 * Class metadata is injected once at composition time; this adapter does not
 * read application globals during export or perform GIS calculations.
 */
window.DG_SURFACE_RESULT_EXPORTS=(({
  classes,esaCodes,lcCodes
})=>{
  function classCsv(result,meta){
    const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
    const m=meta||{};
    const rows=[["CLASS","GROUP","SOURCE_CELL_COUNT","AREA_HA","PERCENT_OF_ANALYSIS_AREA","YEAR","RESOLUTION_M","SOURCE"]];
    const denominator=result.assignedAreaM2;
    const groupOrder=["green","water","hard","bare","other"];
    for(const key of groupOrder){
      const cls=classes.find(c=>c.key===key);
      const count=result.groupCounts?.[key]||0;
      const area=result.groupAreas?.[key]||0;
      if(!count&&!area)continue;
      rows.push([
        q(cls.label),q(key),count,
        (area/10000).toFixed(4),
        denominator>0?(area/denominator*100).toFixed(4):"0",
        m.year||"",m.resolutionM||10,q(m.primaryLabel||"")
      ]);
    }
    /* Ham kaynak kod kırılımı — bilimsel şeffaflık */
    for(const code of Object.keys(result.rawCounts||{}).sort((a,b)=>Number(a)-Number(b))){
      const count=result.rawCounts[code];
      if(!count)continue;
      rows.push([
        q("RAW kod "+code),q("raw"),count,
        ((result.rawAreas?.[code]||0)/10000).toFixed(4),
        denominator>0?((result.rawAreas?.[code]||0)/denominator*100).toFixed(4):"0",
        m.year||"",m.resolutionM||10,q(m.primaryLabel||"")
      ]);
    }
    rows.push([
      q("MASKELİ / NODATA"),q("masked"),result.maskedCount||0,
      (result.maskedAreaM2/10000).toFixed(4),
      denominator>0?(result.maskedAreaM2/denominator*100).toFixed(4):"0",
      m.year||"",m.resolutionM||10,q(m.primaryLabel||"")
    ]);
    return"\uFEFF"+rows.map(r=>r.join(",")).join("\n")+"\n";
  }

  function cellsGeoJson(result){
    const features=(result.cells||[]).map((cell,index)=>{
      const ring=cell.quadWgs&&cell.quadWgs.length===4
        ?[...cell.quadWgs,cell.quadWgs[0]]
        :[[cell.center.lon,cell.center.lat],[cell.center.lon,cell.center.lat]];
      return{
        type:"Feature",
        properties:{
          cell_id:index+1,
          row:cell.row,
          column:cell.col,
          class_code:cell.classCode,
          class_name:(esaCodes[cell.classCode]||lcCodes[cell.classCode]||"Bilinmeyen"),
          group:cell.classKey,
          intersection_area_m2:+Number(cell.areaM2||0).toFixed(4),
          center_lat:+cell.center.lat.toFixed(7),
          center_lon:+cell.center.lon.toFixed(7),
          source:cell.source||""
        },
        geometry:{type:"Polygon",coordinates:[ring]}
      };
    });
    return{type:"FeatureCollection",name:"dendrogeo_10m_landcover",features};
  }

  return Object.freeze({classCsv,cellsGeoJson});
})({classes:DG_LC_CLASSES,esaCodes:DG_ESA_CODES,lcCodes:DG_LC_CODES});
