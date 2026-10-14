"use strict";
/* Full and split recovery requests cover exactly the same OSM tag families. */
(function(root){
 const groups={
  water:['nwr["natural"="water"]','nwr["water"]','nwr["waterway"="riverbank"]','nwr["landuse"~"reservoir|basin"]','nwr["leisure"="swimming_pool"]','nwr["amenity"="fountain"]'],
  buildings:['nwr["building"]','nwr["building:part"]'],
  surfaces:['way["highway"]','way["area:highway"]','nwr["landuse"="highway"]','nwr["leisure"~"pitch|track|playground"]','nwr["amenity"~"parking|bicycle_parking|motorcycle_parking"]','nwr["surface"~"asphalt|paved|concrete|paving_stones|sett|concrete:plates|concrete:lanes|cobblestone|bricks|metal"]','nwr["man_made"~"pier|bridge"]','nwr["bridge"="yes"]']
 };
 function build(bounds,group){const selectors=group?groups[group]:Object.values(groups).flat();if(!selectors)throw Error('Unknown OSM coverage group');return '[out:json][timeout:20];('+selectors.map(selector=>selector+'('+bounds+');').join('')+');out geom;';}
 root.DG_OSM_SURFACE_QUERY=Object.freeze({build,groups:Object.freeze(Object.keys(groups))});
})(window);
