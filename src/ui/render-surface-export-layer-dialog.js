"use strict";
/* Stable layer selector markup for the verified PNG export. */
(function(root){
 function render({grid,waypoints,escape,translate}){
  return'<h3>'+escape(translate("Harita katmanları"))+'</h3><p class="dg-meta">'+escape(translate("İndirmek istediğiniz katmanları seçin."))+'</p>'+[['park','Park alanı',true],['surface','Park analizi',true],['grid','Gridler',grid],['waypoints','Waypointler',waypoints]].map(([id,label,available])=>'<label class="measure-share"><input class="dg-switch" type="checkbox" name="'+id+'" '+(available?'checked':'disabled')+'><span>'+escape(translate(label))+(available?'':'<small>'+escape(translate("Bu park için henüz oluşturulmadı."))+'</small>')+'</span></label>').join('')+'<p class="dg-meta" id="dgExportError" role="status"></p><div class="dg-sens-actions"><button type="button" class="dg-png-btn ghost" id="dgExportCancel">'+escape(translate("Vazgeç"))+'</button><button type="button" class="dg-png-btn primary" id="dgExportDownload">'+escape(translate("PNG indir"))+'</button></div>';
 }
 root.DG_RENDER_SURFACE_EXPORT_LAYER_DIALOG=Object.freeze({render});
})(window);
