"use strict";
(function(root){
 function render(bar,info,{bytes,count,quota,format}){
  const mb=bytes/1048576,ratio=mb/quota;
  bar.style.width=Math.min(100,ratio*100)+"%";
  bar.style.background=ratio>0.8?"var(--red)":(ratio>0.6?"var(--amber)":"var(--green)");
  info.textContent=format("{n} fotoğraf · {mb} MB / {q} MB",{n:count,mb:mb.toFixed(1),q:quota});
 }
 root.DG_ADMIN_STORAGE_USAGE_UI=Object.freeze({render});
})(window);
