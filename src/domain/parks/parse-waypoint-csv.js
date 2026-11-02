"use strict";

/* Read DendroGeo, Google Maps/My Maps and common GIS CSV coordinate columns. */
window.DG_PARSE_WAYPOINT_CSV={
  analyze(text){
    const source=String(text).replace(/^\uFEFF/,"").replace(/^\uFFFE/,"");
    const sample=source.slice(0,Math.min(source.length,12000)).split(/\r?\n/,12).find(line=>line.trim())||"";
    const candidates=[",",";","\t"],delimiter=candidates.map(value=>({value,count:(()=>{let quoted=false,n=0;for(let i=0;i<sample.length;i++){if(sample[i]==='"'){if(quoted&&sample[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&sample[i]===value)n++;}return n;})()})).sort((a,b)=>b.count-a.count)[0].value;
    const readRecords=()=>{
      const records=[];let row=[],cell="",quoted=false;
      for(let i=0;i<source.length;i++){
        const char=source[i];
        if(char==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;continue;}
        if(!quoted&&char===delimiter){row.push(cell);cell="";continue;}
        if(!quoted&&(char==="\n"||char==="\r")){if(char==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(value=>value.trim()))records.push(row);row=[];cell="";continue;}
        cell+=char;
      }
      if(cell.length||row.length){row.push(cell);if(row.some(value=>value.trim()))records.push(row);}
      return records;
    };
    const records=readRecords();if(!records.length)return{rows:[],delimiter,format:"empty"};
    const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
    const longitude=new Set(["lon","lng","long","longitude","longitudee","x","boylam","boylamderece","xcoord","xcoordinate"]);
    const latitude=new Set(["lat","latitude","enlem","enlemderece","y","ycoord","ycoordinate"]);
    const identifiers=new Set(["id","wpid","waypointid","pointid","pointno","pointnumber","number","no","nokta","noktano","olcumno","sira","index"]);
    const names=new Set(["name","title","label","placename","marker","markername","waypoint","noktaadi","measurementpoint"]);
    const geometry=new Set(["wkt","geometry","geom","coordinates","coordinate","coords","position"]);
    const header=records[0].map(normalize);
    let lonIndex=header.findIndex(value=>longitude.has(value)),latIndex=header.findIndex(value=>latitude.has(value));
    let idIndex=header.findIndex(value=>identifiers.has(value)),nameIndex=header.findIndex(value=>names.has(value)),geometryIndex=header.findIndex(value=>geometry.has(value));
    const hasHeader=lonIndex>=0&&latIndex>=0||geometryIndex>=0;
    const data=hasHeader?records.slice(1):records;
    if(!hasHeader){lonIndex=0;latIndex=1;idIndex=2;nameIndex=-1;geometryIndex=-1;}
    const decimal=value=>{const raw=String(value??"").trim().replace(/[\u2212\u2013]/g,"-");if(!raw)return NaN;const normalized=delimiter!==","&&/^[-+]?\d+,\d+(?:[eE][-+]?\d+)?$/.test(raw)?raw.replace(",","."):raw;return Number(normalized);};
    const pointFromGeometry=value=>{
      const raw=String(value||"").trim();let match=raw.match(/\bPOINT\s*(?:Z|M|ZM)?\s*\(\s*([-+\d.eE,]+)[\s,]+([-+\d.eE,]+)(?:\s+[-+\d.eE,]+)?\s*\)/i);
      if(match)return[decimal(match[1]),decimal(match[2])];
      match=raw.match(/^\s*\[?\s*\[?\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*\]?\s*\]?\s*$/);if(match)return[decimal(match[1]),decimal(match[2])];
      return null;
    };
    const rows=[];let generatedId=0,invalidShape=0;
    for(const cells of data){
      if(!cells.some(value=>String(value).trim()))continue;
      let lon=lonIndex>=0?decimal(cells[lonIndex]):NaN,lat=latIndex>=0?decimal(cells[latIndex]):NaN;
      if((!Number.isFinite(lon)||!Number.isFinite(lat))&&geometryIndex>=0){const point=pointFromGeometry(cells[geometryIndex]);if(point){[lon,lat]=point;}}
      if(!Number.isFinite(lon)||!Number.isFinite(lat)){rows.push(["","", "", "invalid"]);invalidShape++;continue;}
      let id=idIndex>=0?decimal(cells[idIndex]):NaN,generated=false;
      if(idIndex>=0&&String(cells[idIndex]||"").trim()&&(!Number.isInteger(id)||id<=0)){rows.push(["","", "", "invalid"]);invalidShape++;continue;}
      if(!Number.isInteger(id)||id<=0){
        const label=nameIndex>=0?String(cells[nameIndex]||""):"";
        const match=label.match(/(?:^|\D)(?:p|wp|waypoint|point|nokta)?\s*#?\s*(\d+)\s*$/i);
        if(match)id=Number(match[1]);
        else{id=++generatedId;generated=true;}
      }
      rows.push([String(lon),String(lat),String(id),generated?"generated":""]);
    }
    const format=hasHeader?(geometryIndex>=0&&lonIndex<0?"wkt-or-coordinate-header":"header-coordinates"):"coordinate-columns";
    return{rows,delimiter,format,invalidShape,hasHeader};
  },
  parse(text){return window.DG_PARSE_WAYPOINT_CSV.analyze(text).rows;}
};
