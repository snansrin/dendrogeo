"use strict";
/* Export orchestration consumes the stable result; it never recomputes areas. */
window.DG_EXPORT_LANDCOVER_RESULT={run(kind,{last,resolutionM,classCsv,cellsGeoJson,download,notify}){
 if(!last)return notify("Önce arazi örtüsü analizini çalıştırın.","warn","🗺️");
 const year=last.report?.year||2021;
 if(kind==="csv"){download("dendrogeo_landcover_"+year+"_classes.csv","text/csv;charset=utf-8",classCsv(last.result,{year:last.report?.year,resolutionM,primaryLabel:last.report?.primaryLabel}));notify("✓ Sınıf arazi örtüsü CSV'si indirildi.","ok","📥");}
 else if(kind==="geojson"){download("dendrogeo_landcover_"+year+"_10m_cells.geojson","application/geo+json;charset=utf-8",JSON.stringify(cellsGeoJson(last.result),null,2));notify("✓ 10 m hücre GeoJSON'u indirildi.","ok","📍");}
}};
