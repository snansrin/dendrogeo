"use strict";
/* Render legacy park matching progress from supplied state. */
(function(root){
function render({box,index:i,total:n,label,escape:esc}){
  if(!box)return;
  const pct=Math.round((i/n)*100);
  box.style.display="block";
  box.innerHTML=
    `<div class="alert info" style="margin:6px 0">⏳ Park geri doldurma · <b>${i+1}/${n}</b> · ${esc(label)}<br>`+
    `<span style="font-size:.78rem">Her proje için ölçüm merkezi hesaplanıp OSM'de park aranıyor `+
    `(1500 m → 3500 m → ad araması). Overpass nezaketi için ~2 sn arayla.</span></div>`+
    `<div style="height:8px;background:var(--line);border-radius:5px;overflow:hidden">`+
    `<div style="height:100%;width:${pct}%;background:var(--green);transition:width .3s"></div></div>`;
}

  root.DG_PARK_BACKFILL_PROGRESS_UI=Object.freeze({render});
})(window);
