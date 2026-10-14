"use strict";
/* Temporal policy and STAC access stay injected; empty evidence remains an error. */
window.DG_FIND_SENTINEL_PERIOD_SCENES={async find(bbox,year,mode,{seasonRange,findRange,maxScenes,maxCloud}){
 const range=seasonRange(year,mode),scenes=await findRange(bbox,range.start,range.end,maxScenes);
 if(!scenes.length)throw new Error("Sentinel-2: referans döneminde ("+range.label+") %"+maxCloud+" altı bulutlulukta sahne bulunamadı. Dönemi genişletin veya 'güncel sezon'u deneyin.");return{scenes,range};
}};
