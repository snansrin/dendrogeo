"use strict";
/* Read-only presentation: real display paths, no analysis or persistence. */
(function(root){
 const colors={green:'#48a66a',hard:'#97a1a5',building:'#475569',water:'#65a9db',bare:'#b59a74',other:'#ddd',sparse:'#d9e7a4',moderate:'#75bb73',dense:'#236c40'};
 function render({data,mode,id}){
  const ndvi=mode==='ndvi',layers=ndvi?data.ndvi.features:data.surface,outline=ndvi?data.ndvi.outline:data.outline;
  const labels={green:'Yeşil alan',water:'Su',building:'Bina',hard:'Sert zemin',bare:'Çıplak zemin',sparse:'Seyrek',moderate:'Orta',dense:'Yoğun'},total=Object.values(data.areas).reduce((a,b)=>a+b,0),translate=text=>typeof root.dgT==='function'?root.dgT(text):text;
  const bars=mode==='analysis'?'<div class="dg-scene-analysis-bars">'+['green','hard','building','water','bare'].map(key=>'<button type="button" class="dg-scene-bar-button" data-scene-pick="'+key+'" aria-pressed="false"><span>'+translate(labels[key])+'</span><i style="--dg-share:'+100*data.areas[key]/total+'%;--dg-bar:'+colors[key]+'"></i><b>'+(100*data.areas[key]/total).toFixed(1)+'%</b></button>').join('')+'</div>':'';
  const demo=mode==='drawing'?'<path class="dg-scene-demo-boundary" d="M235 180L355 190L345 275L245 270Z" clip-path="url(#'+id+')" pathLength="100" aria-hidden="true"/>':'';
  return '<svg class="dg-scene-map" viewBox="0 0 600 460" role="group" aria-label="Göksu Parkı gerçek kayıt geometrisi"><defs><clipPath id="'+id+'"><path d="'+outline+'" fill-rule="evenodd"/></clipPath></defs><g class="dg-scene-geometries">'+layers.map(f=>'<path tabindex="0" role="button" aria-pressed="false" aria-label="'+translate(labels[f.class])+'" data-scene-class="'+f.class+'" d="'+f.path+'" fill="'+colors[f.class]+'" fill-rule="evenodd"/>').join('')+'</g><path class="dg-scene-outline" d="'+outline+'"/>'+demo+'<g data-scene-sketch clip-path="url(#'+id+')"></g><path class="dg-scene-trace" d="'+outline+'" pathLength="100"/><g class="dg-scene-crosshair" aria-hidden="true"><path d="M-10 0H10M0-10V10"/></g></svg>'+bars;
 }
 root.DG_RENDER_LANDING_SPATIAL_SCENE=Object.freeze({render});
})(window);
