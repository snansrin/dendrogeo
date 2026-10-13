"use strict";
(function(root){
 function render(response,rows,ports){
  if(response.error){
   ports.getElement("aMeasT").innerHTML=`<tr><td colspan=9><div class="alert err"><b>⚠ Ölçümler okunamadı (veri silinmedi, sorgu hata veriyor):</b> <span class="mono" style="font-size:.72rem">${ports.escape(response.error.message)}</span><br><span style="font-size:.8rem">Şema değişikliğinden sonra PostgREST önbelleği bayatlamış olabilir → Supabase'de birkaç dakika bekleyip 🔄 Yenile, ya da üstteki "Park → Proje → Kullanıcı" ağacının hata kutusundaki adımları izle.</span></div></td></tr>`;
   return;
  }
  ports.renderTable(rows);
 }
 root.DG_ADMIN_OVERVIEW_MEASUREMENTS_UI=Object.freeze({render});
})(window);
