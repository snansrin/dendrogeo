/* Browser adapter for GIS PNG controls, Canvas allocation and notices. */
(function(root){
 "use strict";
 function create({document,getToast}){
  const read=id=>document.getElementById(id);
  function options(){return {cover:read("chkPngCover")?.checked!==false,grid:read("chkPngGrid")?.checked!==false,wp:read("chkPngWp")?.checked!==false};}
  function canvas(width,height){
   const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
   return {canvas,context:canvas.getContext("2d")};
  }
  function notify(message,type="info"){const toast=getToast();if(typeof toast==="function")toast(message,type,"🖼️");}
  return Object.freeze({read,options,canvas,notify});
 }
 root.DG_GIS_EXPORT_PLATFORM=Object.freeze({create});
})(window);
