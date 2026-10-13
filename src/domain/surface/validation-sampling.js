"use strict";
/* Deterministic stratified and park-wide reference-sample selection. */
(function(root){
  function rng(seed){let a=seed|0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
  function stratified(cells,opts,{defaults,classes}){
    const o=Object.assign({},defaults,opts||{}),random=rng(Number(o.seed)||defaults.seed),out=[];let id=0;
    for(const cls of classes){const pool=(cells||[]).filter(cell=>cell.classKey===cls&&Number(cell.areaM2||0)>=o.edgeAreaM2);if(!pool.length)continue;const indices=pool.map((_,i)=>i),n=Math.min(Number(o.perStratum)||10,indices.length);for(let k=0;k<n;k++){const j=k+Math.floor(random()*(indices.length-k));const t=indices[k];indices[k]=indices[j];indices[j]=t;}for(let k=0;k<n;k++){const cell=pool[indices[k]],ring=cell.quadWgs&&cell.quadWgs.length===4?cell.quadWgs:null;let lat=cell.center.lat,lon=cell.center.lon;if(ring){const lats=ring.map(point=>point[1]),lons=ring.map(point=>point[0]),la0=Math.min(...lats),la1=Math.max(...lats),lo0=Math.min(...lons),lo1=Math.max(...lons);lat=la0+(la1-la0)*(.15+.7*random());lon=lo0+(lo1-lo0)*(.15+.7*random());}out.push({id:"S"+String(++id).padStart(3,"0"),lat:+lat.toFixed(7),lon:+lon.toFixed(7),row:cell.row,col:cell.col,mapClass:cls,areaM2:+Number(cell.areaM2||0).toFixed(3),edge:Number(cell.areaM2||0)<o.edgeAreaM2,classCode:cell.classCode});}}
    return out;
  }
  function spatial(cells,opts,{defaults}){
    const o=Object.assign({count:20,seed:20261007,edgeAreaM2:defaults.edgeAreaM2},opts||{}),pool=(cells||[]).filter(cell=>Number(cell.areaM2||0)>=Number(o.edgeAreaM2)&&cell.center&&Number.isFinite(Number(cell.center.lat))&&Number.isFinite(Number(cell.center.lon))),indices=pool.map((_,i)=>i),requested=Number(o.count),seed=Number(o.seed),random=rng(Number.isFinite(seed)?seed:20261007),n=Math.min(Number.isFinite(requested)?Math.max(0,Math.floor(requested)):20,indices.length),out=[];
    for(let k=0;k<n;k++){const j=k+Math.floor(random()*(indices.length-k));[indices[k],indices[j]]=[indices[j],indices[k]];const cell=pool[indices[k]];out.push({id:"R"+String(k+1).padStart(3,"0"),lat:+Number(cell.center.lat).toFixed(7),lon:+Number(cell.center.lon).toFixed(7),row:cell.row,col:cell.col,mapClass:cell.classKey,areaM2:+Number(cell.areaM2||0).toFixed(3),classCode:cell.classCode,edge:false,frame:"park-random"});}
    return out;
  }
  root.DG_VALIDATION_SAMPLING=Object.freeze({rng,stratified,spatial});
})(window);
