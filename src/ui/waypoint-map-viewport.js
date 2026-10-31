"use strict";
/* Focus one waypoint or fit every waypoint while preserving map panel behavior. */
(function(root){
  // The navigation map has a historical Göksu initial view. The selected
  // project's park is the source of truth for the first frame, not that view.
  const requests=new WeakMap(),pending=new WeakMap();
  function valid(point){
    if(!Array.isArray(point)||point.length<2||point[0]==null||point[1]==null||point[0]===''||point[1]==='')return false;
    const lat=Number(point[0]),lon=Number(point[1]);
    return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&(lat!==0||lon!==0);
  }
  function collectRing(value,result){
    if(!Array.isArray(value))return;
    if(valid(value)){result.push([Number(value[0]),Number(value[1])]);return;}
    for(const part of value)collectRing(part,result);
  }
  function projectFrame(park,waypoints,projectId){
    let geometry=park?.geom_json;
    if(typeof geometry==='string'){try{geometry=JSON.parse(geometry);}catch(error){geometry=null;}}
    const points=[];
    collectRing(geometry?.outer,points);
    if(points.length>1)return {points};
    const lat=Number(park?.centroid_lat),lon=Number(park?.centroid_lon);
    if(park?.centroid_lat!=null&&park?.centroid_lon!=null&&valid([lat,lon])){
      const area=Number(park?.area_m2);
      return {center:[lat,lon],zoom:area>500000?14:area>50000?15:16};
    }
    const selected=(waypoints||[]).filter(point=>Number(point.project_id)===projectId).map(point=>[point.lat,point.lon]).filter(valid);
    if(selected.length>1)return {points:selected};
    return selected.length?{center:[Number(selected[0][0]),Number(selected[0][1])],zoom:16}:null;
  }
  function applyProject({map,panel,projectId}){
    if(!map||panel&&!panel.open)return false;
    const entry=pending.get(map);
    if(!entry||entry.projectId!==Number(projectId))return false;
    if(typeof map.invalidateSize==='function')map.invalidateSize();
    if(entry.frame.points)map.fitBounds(entry.frame.points,{padding:[32,32],maxZoom:17,animate:false});
    else map.setView(entry.frame.center,entry.frame.zoom,{animate:false});
    pending.delete(map);
    return true;
  }
  async function autoProject({map,panel,projectId,parkId,waypoints,readPark,isSelected}){
    if(!map)return false;
    const id=Number(projectId),parkKey=Number(parkId),ticket=(requests.get(map)||0)+1;
    requests.set(map,ticket);
    pending.delete(map);
    if(!Number.isSafeInteger(id)||id<=0)return false;
    let park=null;
    if(Number.isSafeInteger(parkKey)&&parkKey>0&&typeof readPark==='function'){
      // Never retain park rows across project/account changes: permissions and
      // park geometry can change during the same browser session.
      try{park=await readPark(parkKey);}catch(error){park=null;}
    }
    if(requests.get(map)!==ticket||typeof isSelected==='function'&&!isSelected(id))return false;
    const frame=projectFrame(park,waypoints,id);
    if(!frame)return false;
    pending.set(map,{projectId:id,frame});
    return applyProject({map,panel,projectId:id});
  }
  function stopAuto(map){if(map){requests.set(map,(requests.get(map)||0)+1);pending.delete(map);}}
  function focus({showMap,map,target,gps,panel}){
    stopAuto(map);
    if(showMap){if(panel)panel.open=true;if(map?.invalidateSize)map.invalidateSize();}
    if(!target||!map)return;
    const point=[target.lat,target.lon];
    if(gps)map.fitBounds([[gps.latitude,gps.longitude],point],{padding:[36,36],maxZoom:18});
    else map.setView(point,18);
  }
  function fit({showMap,map,waypoints,gps,panel}){
    stopAuto(map);
    if(showMap){if(panel)panel.open=true;if(map?.invalidateSize)map.invalidateSize();}
    if(!map||!waypoints.length)return;
    const points=waypoints.map(point=>[point.lat,point.lon]);
    if(gps)points.push([gps.latitude,gps.longitude]);
    map.fitBounds(points,{padding:[36,36],maxZoom:18});
  }
  root.DG_WAYPOINT_MAP_VIEWPORT=Object.freeze({focus,fit,autoProject,applyProject});
})(window);
