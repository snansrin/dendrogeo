"use strict";
/* Derive stable menu and rail state from the active LULC editor session. */
(function(root){
  function build({record,busy,saving,exporting,rawView,brush,draw,objectPick,objectPreview,vegetationCount,brushType,brushDiameter,drawType,base,sections,showCand,vegetationView,translate,format}){
    const viewDisabled=!!(busy||saving||exporting),disabled=viewDisabled||!!rawView,scanned=!!record?.profile?.cells,vegetationReady=scanned&&vegetationCount>=9;
    const activeType=brush?.type||brushType,label=root.DG_SURFACE_REVIEW?.types?.[activeType]?.label||activeType,activeDrawLabel=root.DG_SURFACE_REVIEW?.types?.[drawType]?.label||label;
    const mode=draw?format("Sınır çizimi · {class}",{class:translate(activeDrawLabel)}):brush?format("Fırça · {class} · {size} m",{class:translate(label),size:brush.diameter}):objectPick?translate("Haritadan nesne seç"):objectPreview?format("Nesne önizlemesi · {class}",{class:translate(activeDrawLabel)}):translate("Haritayı kaydır");
    return{viewDisabled,disabled,scanned,vegetationReady,activeType,label,drawLabel:activeDrawLabel,base,rawView:!!rawView,brush,draw,objectPick,objectPreview,brushDiameter:brush?.diameter||brushDiameter,drawType,sections,showCand:!!showCand,vegetationView:!!vegetationView,mode};
  }
  root.DG_BUILD_SURFACE_TOOLBAR_MODEL=Object.freeze({build});
})(window);
