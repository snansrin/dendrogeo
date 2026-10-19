"use strict";
/* Convert raw OSM elements into clipped surface review features. */
(function(root){
 function create({projectRing,unprojectGeometry,parkGeometry,clip,gridLineMask,extractRings}){
  return function objects(elements,epsg){
   const out=[];const paved=/^(asphalt|paved|concrete|paving_stones|sett|cobblestone|bricks|concrete:plates|concrete:lanes)$/;
   const roadKinds=new Set(["motorway","trunk","primary","secondary","tertiary","unclassified","residential","living_street","service","track","pedestrian","footway","path","cycleway","steps","bridleway"]);
   const roadEstimate=t=>{
    const estimate=root.DG_OSM_ROAD_POLICY?.width?.(t);
    if(Number.isFinite(estimate?.metres)&&estimate.metres>0&&estimate.metres<=60)return estimate;
    const number=v=>{const n=parseFloat(String(v??"").replace(",",".").replace(/[^0-9.+-]/g,""));return Number.isFinite(n)&&n>0?n:null;};
    for(const key of["width","width:carriageway","est_width"]){const metres=number(t[key]);if(metres&&metres<=60)return{metres,source:key==="est_width"?"osm-estimated-width":"osm-width"};}
    const lanes=number(t.lanes);if(lanes&&lanes<10)return{metres:Math.max(3,lanes*3),source:"lane-count-estimate"};
    const highway=String(t.highway||"").toLowerCase(),footway=String(t.footway||"").toLowerCase(),metres={motorway:14,trunk:13,primary:12,secondary:11,tertiary:10,unclassified:9,residential:9,living_street:8,service:8,track:6,pedestrian:6,footway:footway==="sidewalk"?2.5:5,path:4,cycleway:4.5,steps:3,bridleway:3}[highway]||4;
    return{metres,source:"highway-class-estimate"};
   };
   for(const el of elements||[]){
    const t=el.tags||{};let type=null;const deck=/^(pier|bridge)$/.test(t.man_made||"")||t.bridge==="yes";
    // OSM ways are lines by default, even when their first and last nodes match.
    // Filling a closed footpath loop turns the lawn inside it into hard surface.
    const isArea=t.area==="yes"||(!!t["area:highway"]&&t["area:highway"]!=="no"),isLinearHighway=!!t.highway&&t.highway!=="no";
    if((t.building&&t.building!=="no")||(t["building:part"]&&t["building:part"]!=="no"))type="building";
    else if(t.leisure==="swimming_pool"||t.amenity==="fountain"||t.water==="reflecting_pool")type="water";
    else if(t.natural==="water"||t.water||t.landuse==="reservoir"||t.landuse==="basin"||t.waterway==="riverbank")type="water";
    else if(deck||paved.test(t.surface||"")||t.amenity==="parking"||(isLinearHighway&&roadKinds.has(String(t.highway).toLowerCase())))type="hard";
    if(!type)continue;
    let geom=[];
    if(el.type==="relation"&&/^(multipolygon|boundary)$/.test(t.type||"")&&typeof extractRings==="function"){
     const rs=extractRings(el);if(rs){const outer=Array.isArray(rs)?rs:rs.outer,holes=Array.isArray(rs)?[]:rs.inner||[];if(outer?.length)geom=parkGeometry(outer,holes,epsg);}
    }else if(el.geometry?.length>=2){
     const pts=el.geometry.map(p=>[p.lon,p.lat]),a=pts[0],b=pts.at(-1);
     if(pts.length>=4&&a[0]===b[0]&&a[1]===b[1]&&(!isLinearHighway||(isArea&&t.area!=="no")))geom=[[projectRing(pts,epsg)]];
     else if(type==="hard"&&isLinearHighway&&roadKinds.has(String(t.highway).toLowerCase())){
      const estimate=roadEstimate(t),roadWidthM=estimate.metres;
      const masks=gridLineMask({pts:pts.map(p=>[p[1],p[0]]),w:roadWidthM/2},epsg);
      if(masks.length)geom=clip("union",...masks);
     }else if(type==="hard"&&(deck||paved.test(t.surface||""))){
      const width=Number(t.width);if(Number.isFinite(width)&&width>0&&width<=40){
       const xy=projectRing(pts,epsg),segments=[];
       for(let i=1;i<xy.length;i++){const a=xy[i-1],b=xy[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;const ox=-dy/len*width/2,oy=dx/len*width/2;segments.push([[[a[0]+ox,a[1]+oy],[b[0]+ox,b[1]+oy],[b[0]-ox,b[1]-oy],[a[0]-ox,a[1]-oy],[a[0]+ox,a[1]+oy]]]);}
       if(segments.length)geom=clip("union",...segments);
      }
     }
    }
    if(geom.length){const estimate=isLinearHighway?roadEstimate(t):null,roadWidthM=estimate?.metres||null;out.push({type,method:"osm-boundary",osmId:el.type+"/"+el.id,priority:deck?4:null,...(roadWidthM?{roadWidthM,widthSource:estimate.source}:{}),geometry:{type:"MultiPolygon",coordinates:unprojectGeometry(geom,epsg)}});}
   }
   const priority={hard:0,water:1,pool:2,building:3};return out.sort((a,b)=>(a.priority??priority[a.type])-(b.priority??priority[b.type]));
  };
 }
 root.DG_SURFACE_OSM_REVIEW_ADAPTER=Object.freeze({create});
})(window);
