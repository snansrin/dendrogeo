"use strict";
/* Prefer healthy mirrors, then those with the most recent successful response. */
(function(root){
  const regional="https://ovp.dresel.systems/api/interpreter";
  function forQuery(query,urls){
    const inside=(s,w,n,e)=>s>=49&&n<=61&&w>=-9&&e<=3&&s<=n&&w<=e;
    const boxes=[...String(query).matchAll(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/g)];
    const circles=[...String(query).matchAll(/\(around:(\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/g)];
    const eligible=boxes.length+circles.length>0&&boxes.every(m=>inside(...m.slice(1).map(Number)))&&circles.every(m=>{const r=Number(m[1]),lat=Number(m[2]),lon=Number(m[3]);return r<=10000&&inside(lat-.2,lon-.3,lat+.2,lon+.3);});
    return eligible?[regional,...urls]:urls;
  }
  function select(urls,health,now){
    return urls.map((url,index)=>{
      const status=health.get(url)||{};
      return {url,index,badUntil:status.badUntil||0,lastOk:status.lastOk||0};
    }).filter(item=>item.badUntil<=now).sort((a,b)=>{
      if(a.url===regional||b.url===regional)return a.url===regional?-1:1;
      if(a.lastOk!==b.lastOk)return b.lastOk-a.lastOk;
      return a.index-b.index;
    });
  }
  root.DG_SELECT_OVERPASS_MIRRORS=Object.freeze({select,forQuery});
})(window);
