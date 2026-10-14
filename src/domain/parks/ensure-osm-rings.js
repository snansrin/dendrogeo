"use strict";

/* Supply the same ring contract if a stale/partial offline shell misses its domain script. */
function dgOsmFallbackJoinWaysToRings(ways){
  const source=Array.isArray(ways)?ways:[],rings=[],remaining=source.map(way=>way.slice()),equal=(a,b)=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6;
  while(remaining.length){const chain=remaining.shift().slice();let merged=true,guard=remaining.length*remaining.length+source.length+100;
    while(merged&&guard-- >0){merged=false;for(let i=0;i<remaining.length;i++){const way=remaining[i],head=chain[0],tail=chain.at(-1);
      if(equal(tail,way[0]))chain.push(...way.slice(1));else if(equal(tail,way.at(-1)))chain.push(...way.slice().reverse().slice(1));else if(equal(head,way.at(-1)))chain.unshift(...way.slice(0,-1));else if(equal(head,way[0]))chain.unshift(...way.slice().reverse().slice(0,-1));else continue;
      remaining.splice(i,1);merged=true;break;
    }}
    if(chain.length>2){if(!equal(chain[0],chain.at(-1)))chain.push([...chain[0]]);rings.push(chain);}
  }
  return rings;
}
function dgOsmFallbackExtractRings(element){
  if(element?.type==="way"&&Array.isArray(element.geometry)){const ring=element.geometry.filter(point=>Number.isFinite(Number(point?.lat))&&Number.isFinite(Number(point?.lon))).map(point=>[Number(point.lat),Number(point.lon)]);if(ring.length<3)return null;if(Math.abs(ring[0][0]-ring.at(-1)[0])>1e-7||Math.abs(ring[0][1]-ring.at(-1)[1])>1e-7)ring.push([...ring[0]]);return ring.length>=4?[ring]:null;}
  if(element?.type!=="relation"||!Array.isArray(element.members))return null;
  const collect=role=>element.members.filter(member=>member?.role===role&&Array.isArray(member.geometry)&&member.geometry.length>=2).map(member=>member.geometry.filter(point=>Number.isFinite(Number(point?.lat))&&Number.isFinite(Number(point?.lon))).map(point=>[Number(point.lat),Number(point.lon)])).filter(way=>way.length>=2);
  const outer=dgOsmFallbackJoinWaysToRings(collect("outer")),inner=dgOsmFallbackJoinWaysToRings(collect("inner"));return outer.length?{outer:outer.filter(ring=>ring.length>=4),inner:inner.filter(ring=>ring.length>=4)}:null;
}
window.DG_PARK_OSM_RINGS=window.DG_PARK_OSM_RINGS||Object.freeze({extractRings:dgOsmFallbackExtractRings,joinWaysToRings:dgOsmFallbackJoinWaysToRings});
