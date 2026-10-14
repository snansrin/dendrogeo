"use strict";
/* Reference-season and multi-season persistence windows for Sentinel-2. */
(function(root){
  function seasonRange(year,mode,nowValue){const y=Number(year)||2021;if(mode==="ytd"){const now=new Date(Number(nowValue)-1),currentYear=now.getUTCFullYear(),end=now.toISOString(),start=new Date(Date.UTC(currentYear,0,1)).toISOString();return{start,end,label:currentYear+" güncel yıl (1 Oca – "+end.slice(0,10)+")"};}if(mode==="latest"){const now=new Date(nowValue),end=now.toISOString(),start=new Date(now.getTime()-120*86400000).toISOString();return{start,end,label:start.slice(0,10)+" – "+end.slice(0,10)+" (güncel, son 120 gün)"};}return{start:y+"-06-01T00:00:00Z",end:y+"-09-30T23:59:59Z",label:y+" vejetasyon sezonu (1 Haz – 30 Eyl)"};}
  function waterWindows(year,mode,nowOverride){const now=new Date(nowOverride),y=(mode==="latest"||mode==="ytd")?now.getUTCFullYear():(Number(year)||2021),windows=[{start:y+"-02-01T00:00:00Z",end:y+"-05-31T23:59:59Z",max:3,label:y+" ilkbahar (yüksek su)"},{start:y+"-10-01T00:00:00Z",end:y+"-12-15T23:59:59Z",max:2,label:y+" sonbahar"}];if(mode!=="ytd")return windows;return windows.flatMap(w=>{const start=Date.parse(w.start),end=Math.min(Date.parse(w.end),now.getTime());return end<start?[]:[{...w,end:new Date(end).toISOString()}];});}
  root.DG_SENTINEL_TEMPORAL_WINDOWS=Object.freeze({seasonRange,waterWindows});
})(window);
