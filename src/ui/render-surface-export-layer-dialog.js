"use strict";
/* Stable layer selector markup for the verified PNG export. */
(function(root){
 function render({grid,waypoints,escape,translate}){
  const t=text=>escape(translate(text));
  const palette='<div class="dg-export-color-heading"><label class="lbl" for="dgExportBoundaryColor">'+t('Park sınırı rengi')+'</label><button type="button" class="dg-png-btn primary" id="dgExportColorDone">'+t('Tamam')+'</button></div><input id="dgExportBoundaryColor" name="boundaryColor" type="color" value="#111827">';
  return'<h3>'+t("Harita katmanları")+'</h3><label class="measure-share"><input class="dg-switch" type="checkbox" name="mapOnly"><span>'+t('Sadece harita')+'<small>'+t('Rapor başlığı ve alan özeti olmadan indir.')+'</small></span></label><p class="dg-meta">'+t("İndirmek istediğiniz katmanları seçin.")+'</p>'+[['park','Park alanı',true],['surface','Park analizi',true],['grid','Gridler',grid],['waypoints','Waypointler',waypoints]].map(([id,label,available])=>'<label class="measure-share"><input class="dg-switch" type="checkbox" name="'+id+'" '+(available?(id==='grid'?'':'checked'):'disabled')+'><span>'+t(label)+(available?'':'<small>'+t("Bu park için henüz oluşturulmadı.")+'</small>')+'</span></label>').join('')+palette+'<p class="dg-meta">'+t('Harita altlığı ekrandaki görünümden alınır.')+'</p><p class="dg-meta" id="dgExportError" role="status"></p><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost" id="dgExportCancel">'+t("Vazgeç")+'</button><button type="button" class="dg-png-btn primary" id="dgExportDownload">'+t("PNG indir")+'</button></div>';
 }
 root.DG_RENDER_SURFACE_EXPORT_LAYER_DIALOG=Object.freeze({render});
})(window);
