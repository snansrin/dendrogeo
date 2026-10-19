"use strict";
/* User-supplied metric width for a selected OSM centreline; never infer a measured width. */
window.DG_OSM_ROAD_WIDTH_PREVIEW=Object.freeze({
 attach(preview,elements){
  if(!preview||preview.type!=="hard")return preview;
  const source=(elements||[]).find(element=>element.type==="way"&&"way/"+element.id===preview.osmId);
  const tags=source?.tags||{};
  if(!tags.highway||tags.highway==="no"||tags.area==="yes"||(tags["area:highway"]&&tags["area:highway"]!=="no")||source.geometry?.length<2)return preview;
  return{...preview,roadSource:source};
 },
 build({preview,width,epsg,park,objects,geometry,clip,area,unproject}){
  const metres=Number(String(width).replace(",","."));
  if(!preview?.roadSource||!Number.isFinite(metres)||metres<.5||metres>60)throw Error("Yol genişliği 0,5–60 m arasında olmalıdır.");
  const source=preview.roadSource;
  const feature=objects([{...source,tags:{...source.tags,width:String(metres)}}],epsg).find(item=>item.osmId===preview.osmId&&item.type==="hard");
  if(!feature)throw Error("Yol geometrisi oluşturulamadı.");
  const next=clip("intersection",geometry(feature,epsg),park);
  if(!next.length||area(next)<.1)throw Error("Yol geometrisi park sınırıyla kesişmiyor.");
  const original=clip("intersection",geometry({geometry:preview.originalRoadGeometry||preview.geometry},epsg),park);
  if(area(clip("difference",original,next))>.1)throw Error("Bu araç yolu genişletir. Daraltmak veya değişken genişlik çizmek için Sınır çiz aracını kullanın.");
  return{...preview,originalRoadGeometry:preview.originalRoadGeometry||preview.geometry,roadWidthM:metres,geometry:{type:"MultiPolygon",coordinates:unproject(next,epsg)}};
 },
 decision(feature,preview){return preview?.roadWidthM?{...feature,source:"user-road-width",roadWidthM:preview.roadWidthM}:feature;}
});
