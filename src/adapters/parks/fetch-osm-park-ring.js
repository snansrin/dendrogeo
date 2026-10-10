"use strict";
/* Fetch and decode the closed boundary for an OSM way or relation key. */
(function(root){
  function create({fetch,joinWaysToRings}){
    return async function fetchOsmParkRing(osmKey){
      const match=String(osmKey||"").match(/^(way|relation)\/(\d+)$/);
      if(!match)return null;
      const response=await fetch("https://api.openstreetmap.org/api/0.6/"+match[1]+"/"+match[2]+"/full.json",{headers:{"Accept":"application/json"}});
      if(!response.ok)throw new Error("OSM HTTP "+response.status);
      const json=await response.json();
      if(match[1]==="way"){
        const ring=json.elements.filter(element=>element.type==="node").map(node=>[node.lat,node.lon]);
        return ring.length>=4?{outer:[ring],inner:[]}:null;
      }
      const nodes={};
      for(const element of json.elements)if(element.type==="node")nodes[element.id]=[element.lat,element.lon];
      const ways=json.elements.filter(element=>element.type==="way").map(way=>(way.nodes||[]).map(id=>nodes[id]).filter(Boolean));
      const rings=typeof joinWaysToRings==="function"?joinWaysToRings(json.elements.filter(element=>element.type==="way")):null;
      if(rings&&rings.length)return{outer:[rings[0]],inner:rings.slice(1)};
      const outer=ways.filter(way=>way.length>3&&way[0][0]===way[way.length-1][0]&&way[0][1]===way[way.length-1][1]).sort((a,b)=>b.length-a.length)[0];
      return outer?{outer:[outer],inner:[]}:null;
    };
  }
  root.DG_OSM_PARK_RING_ADAPTER=Object.freeze({create});
})(window);
